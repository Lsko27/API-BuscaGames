// backend/api/auth.js
require('dotenv').config();
const jwt = require("jsonwebtoken");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não definido no arquivo .env');
}

router.use(
    session({
        secret: process.env.JWT_SECRET,
        resave: false,
        saveUninitialized: true,
    })
);
router.use(passport.initialize());
router.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || `${profile.id}@google.com`;

                let user = await prisma.user.findUnique({ where: { email } });

                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            email,
                            name: profile.displayName,
                            googleId: profile.id,
                        },
                    });
                }

                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/login",
    }),
    (req, res) => {
        // Gera o token JWT com mesmo formato do login normal
        const tokenPayload = {
            userId: req.user.id,
            email: req.user.email,
            userName: req.user.userName || null,
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "7d" });

        // Envia o token num cookie HTTP-only (mais seguro)
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        });

        // Redireciona para front, sem token na URL
        res.redirect(`${process.env.FRONT_URL}/profile`);
    }
);

// Rota para logout — limpa o cookie JWT HTTP-only
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    });
    res.json({ message: 'Logout realizado com sucesso' });
});

module.exports = router;
