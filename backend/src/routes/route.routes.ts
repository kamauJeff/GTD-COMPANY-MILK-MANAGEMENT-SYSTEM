// src/routes/route.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const routes = await prisma.route.findMany({
    include: {
      supervisor: { select: { id: true, name: true } },
      _count: {
        select: {
          farmers: { where: { isActive: true } },
          collections: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  res.json(routes);
});

router.get('/:id', async (req, res) => {
  const route = await prisma.route.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      supervisor: { select: { id: true, name: true } },
      _count: {
        select: {
          farmers: { where: { isActive: true } },
          collections: true,
        },
      },
    },
  });
  if (!route) return res.status(404).json({ error: 'Route not found' });
  res.json(route);
});

router.post('/', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const route = await prisma.route.create({ data: req.body });
  res.status(201).json(route);
});

router.put('/:id', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const route = await prisma.route.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  });
  res.json(route);
});

export default router;
