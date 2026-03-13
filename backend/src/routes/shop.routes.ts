// src/routes/shop.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const shops = await prisma.shop.findMany({
    include: { keeper: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(shops);
});

router.get('/:id', async (req, res) => {
  const shop = await prisma.shop.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      keeper: { select: { id: true, name: true, phone: true } },
      sales: { orderBy: { saleDate: 'desc' }, take: 30 },
    },
  });
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  res.json(shop);
});

router.post('/', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const shop = await prisma.shop.create({ data: req.body });
  res.status(201).json(shop);
});

router.put('/:id', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const shop = await prisma.shop.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  });
  res.json(shop);
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  await prisma.shop.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Shop deleted' });
});

export default router;
