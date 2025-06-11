import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// GET quests com dados formatados para front
app.get('/quests', async (req, res) => {
    const raw = await prisma.quest.findMany();
    const quests = raw.map(q => ({
        id: q.id,
        title: q.title,
        description: q.description,
        points: q.points,
        progress: q.progress,
        totalSteps: q.totalSteps,
        status: q.progress >= q.totalSteps ? 'complete' : 'in_progress',
        iconName: q.iconName,
        type: q.type || 'DAILY', // fallback se tiver dados antigos
    }));
    res.json(quests);
});

// POST quest com retorno formatado
app.post('/quests', async (req, res) => {
    const { title, description, points, progress, totalSteps, iconName, type } = req.body;

    if (
        !title ||
        !description ||
        points == null ||
        progress == null ||
        totalSteps == null ||
        !iconName ||
        !type
    ) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios, incluindo type.' });
    }

    if (!['DAILY', 'WEEKLY'].includes(type)) {
        return res.status(400).json({ error: 'O campo "type" deve ser DAILY ou WEEKLY.' });
    }

    try {
        const newQuest = await prisma.quest.create({
            data: { title, description, points, progress, totalSteps, iconName, type }
        });
        return res.status(201).json(newQuest);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao criar quest.' });
    }
});

app.put('/quests/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, points, progress, totalSteps, iconName, type } = req.body;

    // Validação básica
    if (
        !title ||
        !description ||
        points == null ||
        progress == null ||
        totalSteps == null ||
        !iconName ||
        !type
    ) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios, incluindo type.' });
    }

    if (!['DAILY', 'WEEKLY'].includes(type)) {
        return res.status(400).json({ error: 'O campo "type" deve ser DAILY ou WEEKLY.' });
    }

    try {
        const updatedQuest = await prisma.quest.update({
            where: { id },  // <-- Aqui, id é string, não converta
            data: { title, description, points, progress, totalSteps, iconName, type },
        });
        return res.json(updatedQuest);
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Quest não encontrada.' });
        }
        return res.status(500).json({ error: 'Erro ao atualizar quest.' });
    }
});


app.listen(4000, () => {
    console.log('Servidor backend rodando na porta 4000');
});
