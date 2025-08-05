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

// Verifica se JWT_SECRET está definido no .env
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não definido no arquivo .env');
}

// Configura a sessão (necessária pro Passport funcionar)
router.use(
    session({
        secret: process.env.JWT_SECRET,  // usa o secret do .env
        resave: false,
        saveUninitialized: true,
    })
);
router.use(passport.initialize());
router.use(passport.session());

// Serializa usuário na sessão (salva só o ID)
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Desserializa usuário da sessão
passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Configura a estratégia Google OAuth
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

// Rota para iniciar login com Google
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback do Google
router.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/login",
    }),
    (req, res) => {
        // Gera o JWT usando o secret garantido no começo
        const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
        
        // Manda o token no cookie HTTP-only (mais seguro, só backend acessa)
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // true só em produção com HTTPS
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        });

        // Redireciona para o front passando o token, ou guarda o token de outra forma
        res.redirect(`${process.env.FRONT_URL}/profile?token=${token}`);
    }
);

module.exports = router;
