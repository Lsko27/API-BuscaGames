const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

router.use(express.json());

// Listar todos usuários
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, userName: true, email: true },
    });
    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Verificar se username existe (exemplo de rota separada, evita conflito com busca por ID)
router.get('/check-username/:userName', async (req, res) => {
  const { userName } = req.params;
  if (!userName) {
    return res.status(400).json({ error: 'Nome de usuário é obrigatório' });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { userName: userName.toLowerCase() },
    });
    res.json({ exists: !!existingUser });
  } catch (error) {
    console.error('Erro ao verificar username:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Novo endpoint para obter o usuário logado
// Retorna os dados do usuário logado com base no token do cookie
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
      where: { id: decoded.userId }, // token tem userId
      select: { id: true, name: true, email: true, userName: true },
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
