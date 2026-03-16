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

// Monthly sales grid - like Excel Sales-Shops sheet
router.get('/monthly-grid', async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month as string) || new Date().getMonth() + 1;
  const y = parseInt(year as string) || new Date().getFullYear();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  const shops = await prisma.shop.findMany({
    include: { keeper: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });

  const sales = await prisma.shopSale.findMany({
    where: { saleDate: { gte: start, lte: end } },
    include: { shop: { select: { id: true, name: true, code: true } } },
    orderBy: { saleDate: 'asc' },
  });

  // Build grid
  const grid = shops.map(shop => {
    const days: Record<number, any> = {};
    const shopSales = sales.filter(s => s.shopId === shop.id);
    for (const s of shopSales) {
      const day = new Date(s.saleDate).getDate();
      days[day] = {
        id: s.id, litresSold: Number(s.litresSold),
        expectedRevenue: Number(s.expectedRevenue),
        cashCollected: Number(s.cashCollected),
        tillAmount: Number(s.tillAmount),
        variance: Number(s.variance),
        reconciled: s.reconciled,
      };
    }
    const totalLitres = shopSales.reduce((s, x) => s + Number(x.litresSold), 0);
    const totalRevenue = shopSales.reduce((s, x) => s + Number(x.cashCollected) + Number(x.tillAmount), 0);
    return { shop: { id: shop.id, name: shop.name, code: shop.code }, days, totalLitres, totalRevenue };
  });

  const grandTotal = grid.reduce((s, r) => s + r.totalLitres, 0);
  res.json({ grid, month: m, year: y, grandTotal });
});

router.get('/daily-summary', async (req, res) => {
  const date = req.query.date ? new Date(req.query.date as string) : new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  const sales = await prisma.shopSale.findMany({
    where: { saleDate: { gte: start, lte: end } },
    include: { shop: { select: { name: true } } },
  });
  res.json(sales);
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
