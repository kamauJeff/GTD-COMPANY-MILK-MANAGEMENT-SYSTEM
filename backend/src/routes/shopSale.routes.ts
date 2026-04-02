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
    const n = new Date(d); n.setDate(n.getDate() + 1);
    where.saleDate = { gte: d, lt: n };
  }
  const sales = await prisma.shopSale.findMany({
    where, include: { shop: { select: { id: true, name: true } } }, orderBy: { saleDate: 'desc' },
  });
  res.json(sales);
});

router.post('/', async (req, res) => {
  const { shopId, saleDate, litresSold, cashCollected, tillAmount, expectedRevenue, variance } = req.body;
  const sale = await prisma.shopSale.create({
    data: { dairyId: req.dairyId!, shopId: Number(shopId),
      saleDate: new Date(saleDate),
      litresSold: Number(litresSold),
      expectedRevenue: Number(expectedRevenue || 0),
      cashCollected: Number(cashCollected || 0),
      tillAmount: Number(tillAmount || 0),
      variance: Number(variance || 0),
    },
    include: { shop: { select: { id: true, name: true } } },
  });
  res.status(201).json(sale);
});

router.post('/bulk', async (req, res) => {
  const { sales } = req.body;
  const created = await prisma.shopSale.createMany({ data: sales.map((s: any) => ({ ...s, saleDate: new Date(s.saleDate) })) });
  res.json(created);
});

router.delete('/:id', async (req, res) => {
  await prisma.shopSale.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

export default router;
