const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Middleware para garantir que o corpo da requisição seja JSON
router.use(express.json());

// Rota para login
router.post('/login', async (req, res) => {
  let { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  email = email.toLowerCase();  // força lowercase

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const senhaValida = await bcrypt.compare(password, user.password);

    if (!senhaValida) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    res.json({
      message: 'Login efetuado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        userName: user.userName,
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Rota para registro de usuário
router.post('/register', async (req, res) => {
  let { firstName, lastName, userName, email, password } = req.body;

  if (!firstName || !lastName || !userName || !email || !password) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  }

  userName = userName.toLowerCase();
  email = email.toLowerCase();

  try {
    // Verifica se já existe userName ou email cadastrado
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    const existingUserByUserName = await prisma.user.findUnique({
      where: { userName },
    });

    if (existingUserByUserName) {
      return res.status(409).json({ error: 'Nome de usuário já cadastrado' });
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
      message: 'Usuário criado com sucesso',
      user: {
        id: newUser.id,
        name: newUser.name,
        userName: newUser.userName,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Rota para listar todos os usuários
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        userName: true,
        email: true,
      },
    });

    
    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Rota para verificar se username já existe (GET)
router.get('/users/:userName', async (req, res) => {
  const { userName } = req.params;

  if (!userName) {
    return res.status(400).json({ error: 'Nome de usuário é obrigatório' });
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
    console.error('Erro ao verificar username:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

module.exports = router;
