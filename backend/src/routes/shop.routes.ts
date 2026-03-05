// src/routes/shop.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const shops = await prisma.shop.findMany({ include: { keeper: { select: { id: true, name: true } } } });
  res.json(shops);
});
router.post('/', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const shop = await prisma.shop.create({ data: req.body });
  res.status(201).json(shop);
});
router.put('/:id', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const shop = await prisma.shop.update({ where: { id: Number(req.params.id) }, data: req.body });
  res.json(shop);
});

export default router;

