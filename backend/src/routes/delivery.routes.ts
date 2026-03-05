// src/routes/delivery.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { date } = req.query;
  const where: any = {};
  if (date) { const d = new Date(String(date)); const n = new Date(d); n.setDate(n.getDate()+1); where.deliveredAt = { gte: d, lt: n }; }
  const deliveries = await prisma.deliveryToShop.findMany({
    where,
    include: {
      shop: { select: { id: true, name: true } },
      driver: { select: { id: true, name: true } },
      batch: { select: { id: true, batchNo: true } },
    },
    orderBy: { deliveredAt: 'desc' },
  });
  res.json(deliveries);
});

router.post('/', authorize('DRIVER', 'ADMIN'), async (req, res) => {
  const delivery = await prisma.deliveryToShop.create({
    data: { ...req.body, driverId: req.body.driverId ?? req.user!.sub, deliveredAt: new Date(req.body.deliveredAt) },
  });
  res.status(201).json(delivery);
});

export default router;

