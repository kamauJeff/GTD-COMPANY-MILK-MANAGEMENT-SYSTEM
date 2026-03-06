// src/routes/shop.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// Get all shops, optionally grouped by unit
router.get('/', async (req, res) => {
  const { unit } = req.query;
  const where: any = {};
  if (unit) where.unit = String(unit);

  const shops = await prisma.shop.findMany({
    where,
    include: {
      keeper: { select: { id: true, name: true } },
      _count: { select: { sales: true } },
    },
    orderBy: [{ unit: 'asc' }, { name: 'asc' }],
  });
  res.json(shops);
});

// Get monthly sales grid for a month (all shops, daily litres)
router.get('/monthly-grid', async (req, res) => {
  const { month, year, unit } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year required' });

  const m = Number(month), y = Number(year);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 1);
  const daysInMonth = new Date(y, m, 0).getDate();

  const where: any = { saleDate: { gte: monthStart, lt: monthEnd } };
  const shopWhere: any = {};
  if (unit) shopWhere.unit = String(unit);

  const shops = await prisma.shop.findMany({
    where: shopWhere,
    orderBy: [{ unit: 'asc' }, { name: 'asc' }],
  });

  const sales = await prisma.shopSale.findMany({
    where,
    select: { shopId: true, saleDate: true, litresSold: true, cashCollected: true, expectedRevenue: true },
  });

  // Build daily grid per shop
  const salesByShop: Record<number, Record<number, number>> = {};
  sales.forEach(s => {
    const day = new Date(s.saleDate).getDate();
    if (!salesByShop[s.shopId]) salesByShop[s.shopId] = {};
    salesByShop[s.shopId][day] = (salesByShop[s.shopId][day] || 0) + Number(s.litresSold);
  });

  // Group by unit
  const unitMap: Record<string, any[]> = {};
  shops.forEach(shop => {
    const unitKey = shop.unit || 'OTHERS';
    if (!unitMap[unitKey]) unitMap[unitKey] = [];
    const daily = Array.from({ length: daysInMonth }, (_, i) =>
      salesByShop[shop.id]?.[i + 1] ?? 0
    );
    const total = daily.reduce((s, v) => s + v, 0);
    unitMap[unitKey].push({ id: shop.id, code: shop.code, name: shop.name, unit: unitKey, daily, total });
  });

  // Unit totals
  const unitTotals: Record<string, number[]> = {};
  Object.entries(unitMap).forEach(([unit, shopList]) => {
    unitTotals[unit] = Array.from({ length: daysInMonth }, (_, i) =>
      shopList.reduce((s, sh) => s + sh.daily[i], 0)
    );
  });

  res.json({ units: unitMap, unitTotals, daysInMonth });
});

// Daily summary across all shops
router.get('/daily-summary', async (req, res) => {
  const { date } = req.query;
  const d = date ? new Date(String(date)) : new Date();
  d.setHours(0, 0, 0, 0);
  const next = new Date(d); next.setDate(next.getDate() + 1);

  const sales = await prisma.shopSale.findMany({
    where: { saleDate: { gte: d, lt: next } },
    include: { shop: { select: { id: true, name: true, unit: true } } },
  });

  // Group by unit
  const byUnit: Record<string, { litres: number; shops: number; cash: number }> = {};
  sales.forEach(s => {
    const unit = s.shop.unit || 'OTHERS';
    if (!byUnit[unit]) byUnit[unit] = { litres: 0, shops: 0, cash: 0 };
    byUnit[unit].litres += Number(s.litresSold);
    byUnit[unit].shops++;
    byUnit[unit].cash += Number(s.cashCollected);
  });

  res.json({
    totalLitres: sales.reduce((s, x) => s + Number(x.litresSold), 0),
    totalCash: sales.reduce((s, x) => s + Number(x.cashCollected), 0),
    shopCount: sales.length,
    byUnit,
  });
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
