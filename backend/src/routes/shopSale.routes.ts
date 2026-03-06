// src/routes/shopSale.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

const SELLING_PRICE = 65; // KES per litre — adjust as needed

router.get('/', async (req, res) => {
  const { shopId, date, month, year } = req.query;
  const where: any = {};
  if (shopId) where.shopId = Number(shopId);
  if (date) {
    const d = new Date(String(date));
    const n = new Date(d); n.setDate(n.getDate() + 1);
    where.saleDate = { gte: d, lt: n };
  }
  if (month && year) {
    const m = Number(month), y = Number(year);
    where.saleDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  const sales = await prisma.shopSale.findMany({
    where,
    include: { shop: { select: { id: true, name: true, unit: true } } },
    orderBy: { saleDate: 'desc' },
  });
  res.json(sales);
});

// Record a single shop sale
router.post('/', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { shopId, saleDate, litresSold, cashCollected, sellingPrice } = req.body;
  const price = sellingPrice ?? SELLING_PRICE;
  const expectedRevenue = Number(litresSold) * Number(price);
  const cash = Number(cashCollected ?? 0);
  const sale = await prisma.shopSale.upsert({
    where: {
      shopId_saleDate: { shopId: Number(shopId), saleDate: new Date(saleDate) },
    },
    update: { litresSold, cashCollected: cash, expectedRevenue, variance: expectedRevenue - cash },
    create: {
      shopId: Number(shopId), saleDate: new Date(saleDate),
      litresSold, cashCollected: cash,
      expectedRevenue, variance: expectedRevenue - cash,
      tillAmount: 0,
    },
  });
  res.status(201).json(sale);
});

// Bulk save daily litres for all shops in a month (from the grid)
router.post('/bulk', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, entries, sellingPrice } = req.body;
  // entries: [{ shopId, day, litres }]
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

  const price = sellingPrice ?? SELLING_PRICE;
  let saved = 0, skipped = 0;

  for (const e of entries) {
    if (!e.litres || Number(e.litres) <= 0) continue;
    try {
      const saleDate = new Date(Number(year), Number(month) - 1, Number(e.day));
      const litresSold = Number(e.litres);
      const expectedRevenue = litresSold * price;
      await prisma.shopSale.upsert({
        where: { shopId_saleDate: { shopId: Number(e.shopId), saleDate } },
        update: { litresSold, expectedRevenue, variance: expectedRevenue - 0 },
        create: { shopId: Number(e.shopId), saleDate, litresSold, cashCollected: 0, expectedRevenue, tillAmount: 0, variance: expectedRevenue },
      });
      saved++;
    } catch { skipped++; }
  }
  res.json({ saved, skipped });
});

export default router;
