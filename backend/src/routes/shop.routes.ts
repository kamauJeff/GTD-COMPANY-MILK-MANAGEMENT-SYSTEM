import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// GET all shops
router.get('/', async (_req, res) => {
  const shops = await prisma.shop.findMany({
    include: { keeper: { select: { id: true, code: true, name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(shops);
});

// GET monthly sales grid
router.get('/monthly-grid', async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year  = Number(req.query.year)  || new Date().getFullYear();
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

  const shops = await prisma.shop.findMany({
    include: { keeper: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  });

  const sales = await prisma.shopSale.findMany({
    where: { saleDate: { gte: start, lt: end } },
    include: { shop: { select: { id: true } } },
  });

  const grid = shops.map(shop => {
    const days: Record<number, any> = {};
    sales.filter(s => s.shopId === shop.id).forEach(s => {
      const day = new Date(s.saleDate).getDate();
      days[day] = {
        litres:    Number(s.litresSold),
        cash:      Number(s.cashCollected),
        till:      Number(s.tillAmount || 0),
        expected:  Number(s.expectedRevenue),
        variance:  Number(s.variance),
      };
    });
    return { shop: { id: shop.id, name: shop.name, keeper: shop.keeper }, days };
  });

  res.json({ grid });
});

// PUT assign shopkeeper to shop (using keeperId field)
router.put('/:id/assign', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { keeperId } = req.body;
  try {
    const shop = await prisma.shop.update({
      where: { id: Number(req.params.id) },
      data: { keeperId: Number(keeperId) },
      include: { keeper: { select: { id: true, name: true, code: true } } },
    });
    res.json(shop);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to assign shopkeeper' });
  }
});

// GET daily summary
router.get('/daily-summary', async (req, res) => {
  const date = req.query.date ? new Date(String(req.query.date)) : new Date();
  date.setHours(0,0,0,0);
  const next = new Date(date); next.setDate(next.getDate() + 1);

  const sales = await prisma.shopSale.findMany({
    where: { saleDate: { gte: date, lt: next } },
    include: { shop: { select: { name: true } } },
  });

  res.json(sales);
});

export default router;
