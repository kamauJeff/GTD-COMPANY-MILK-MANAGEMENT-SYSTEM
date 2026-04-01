// src/routes/route.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const routes = await prisma.route.findMany({ where: { dairyId: req.dairyId! }, include: { supervisor: { select: { id: true, name: true } } }, orderBy: { code: 'asc' } });
  res.json(routes);
});

router.post('/', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const route = await prisma.route.create({ data: { ...req.body, dairyId: req.dairyId! } });
  res.status(201).json(route);
});

router.put('/:id', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const route = await prisma.route.update({ where: { id: Number(req.params.id) }, data: req.body });
  res.json(route);
});

export default router;
