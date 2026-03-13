// src/routes/shopSale.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { shopId, date } = req.query;
  const where: any = {};
  if (shopId) where.shopId = Number(shopId);
  if (date) {
    const d = new Date(String(date));
    const n = new Date(d);
    n.setDate(n.getDate() + 1);
    where.saleDate = { gte: d, lt: n };
  }
  const sales = await prisma.shopSale.findMany({
    where,
    orderBy: { saleDate: 'desc' },
  });
  res.json(sales);
});

router.post('/', async (req, res) => {
  const { shopId, saleDate, litresSold, cashCollected, sellingPrice } = req.body;
  const expectedRevenue = Number(litresSold) * Number(sellingPrice);
  const sale = await prisma.shopSale.create({
    data: {
      shopId,
      saleDate: new Date(saleDate),
      litresSold,
      cashCollected,
      expectedRevenue,
      variance: expectedRevenue - Number(cashCollected),
    },
  });
  res.status(201).json(sale);
});

router.put('/:id', async (req, res) => {
  const sale = await prisma.shopSale.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  });
  res.json(sale);
});

router.delete('/:id', async (req, res) => {
  await prisma.shopSale.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Deleted' });
});

export default router;
