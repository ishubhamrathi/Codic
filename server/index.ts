import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '../src/generated/prisma';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/projects/:userId', async (req, res) => {
  try {
    const projects = await prisma.umlProject.findMany({
      where: { userId: req.params.userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { id, userId, name, nodes, edges } = req.body;
    const project = await prisma.umlProject.upsert({
      where: { id: id || '' },
      update: { name, nodes, edges, updatedAt: new Date() },
      create: { id, userId, name, nodes, edges },
    });
    res.json(project);
  } catch {
    res.status(500).json({ error: 'Failed to save project' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await prisma.umlProject.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
