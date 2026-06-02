import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '../src/generated/prisma';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

type AuthRequest = Request & { userId?: string };

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = header.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = user.id;
  next();
}

app.get('/api/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.umlProject.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

app.post('/api/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, name, nodes, edges } = req.body;
    const project = await prisma.umlProject.upsert({
      where: { id: id || '' },
      update: { name, nodes, edges, updatedAt: new Date() },
      create: { id, userId: req.userId!, name, nodes, edges },
    });
    res.json(project);
  } catch {
    res.status(500).json({ error: 'Failed to save project' });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.umlProject.findUnique({ where: { id: req.params.id } });
    if (!project || project.userId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    await prisma.umlProject.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
