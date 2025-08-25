const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const prisma = new PrismaClient();
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "b7f3d2e9c8a41f6b9d0e57a3f18c94b2d6e07fae3b8c12f9a4d3e67b1c5f9a20";

router.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error:
      "Muitas tentativas de login. Por favor, tente novamente após 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// <------------------------------------------------ Rotas LOGIN E LOGOUT ------------------------------------------------->
//  login
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email ou nome de usuário e senha são obrigatórios",
    });
  }

  try {
    const identifier = email.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { userName: identifier }],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Usuário não encontrado",
      });
    }

    const senhaValida = await bcrypt.compare(password, user.password);

    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        error: "Senha incorreta",
      });
    }

    // Cria o token JWT com dados do usuário e tempo de expiração
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        userName: user.userName,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({
      success: true,
      message: "Login efetuado com sucesso",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        userName: user.userName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return res.status(200).json({ message: "Logout efetuado com sucesso" });
});

// Redefinir senha
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ error: "Token e nova senha são obrigatórios" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: "Senha atualizada com sucesso!" });
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    res.status(400).json({ error: "Token inválido ou expirado" });
  }
});

// Redefinição de senha
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "O e-mail é obrigatório" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "15m",
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: "gmail", // ou outro serviço SMTP
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Redefinição de Senha",
      html: `
        <p>Olá ${user.name || user.userName},</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p>Clique no link abaixo para criar uma nova senha (expira em 15 minutos):</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>Se você não solicitou, ignore este e-mail.</p>
      `,
    });

    return res.json({ message: "E-mail de redefinição enviado com sucesso!" });
  } catch (error) {
    console.error("Erro ao enviar e-mail de recuperação:", error);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// <------------------------------------------------ FIM Rotas LOGIN E LOGOUT ------------------------------------------------->

// <------------------------------------------------ EDITAR ROLE DO USUÁRIO ------------------------------------------------->
router.patch("/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = ["consumer", "moderator", "administrator"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Role inválida" });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: { role },
      select: { id: true, name: true, userName: true, email: true, role: true },
    });

    res.json({
      message: "Role atualizado com sucesso!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Erro ao atualizar role:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// <------------------------------------------------ FIM EDITAR ROLE DO USUÁRIO ------------------------------------------------->

// <------------------------------------------------ Rota CADASTRO ------------------------------------------------->
// registro de usuário
router.post("/register", async (req, res) => {
  let { firstName, lastName, userName, email, password } = req.body;

  if (!firstName || !lastName || !userName || !email || !password) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes" });
  }

  userName = userName.toLowerCase();
  email = email.toLowerCase();

  try {
    // Verifica se já existe userName ou email cadastrado
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      return res.status(409).json({ error: "Email já cadastrado" });
    }

    const existingUserByUserName = await prisma.user.findUnique({
      where: { userName },
    });

    if (existingUserByUserName) {
      return res.status(409).json({ error: "Nome de usuário já cadastrado" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        userName,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      message: "Usuário criado com sucesso",
      user: {
        id: newUser.id,
        name: newUser.name,
        userName: newUser.userName,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Erro no cadastro:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});
// <------------------------------------------------ FIM Rota CADASTRO ------------------------------------------------->

// Listar todos usuários
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, userName: true, email: true, role: true },
    });
    res.json(users);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// Rota para verificar se username já existe (GET)
router.get("/users/:userName", async (req, res) => {
  const { userName } = req.params;

  if (!userName) {
    return res.status(400).json({ error: "Nome de usuário é obrigatório" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { userName: userName.toLowerCase() },
    });

    if (existingUser) {
      return res.json({ exists: true });
    } else {
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error("Erro ao verificar username:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// Novo endpoint para obter o usuário logado - Retorna os dados do usuário logado com base no token do cookie
router.get("/me", async (req, res) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Token não encontrado" });
  }

  try {
    // Decodifica o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Busca usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, userName: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Retorna os dados do usuário
    res.json(user);
  } catch (error) {
    console.error("Erro ao verificar token:", error);
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
});

module.exports = router;
