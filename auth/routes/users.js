const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

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

module.exports = router;
