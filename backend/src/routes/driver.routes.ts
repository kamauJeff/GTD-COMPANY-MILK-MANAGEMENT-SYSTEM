import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// GET all drivers
router.get('/', async (_req, res) => {
  const drivers = await prisma.employee.findMany({
    where: { role: 'DRIVER', isActive: true },
    select: { id: true, code: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  });
  res.json(drivers);
});

// GET all trips with drops
router.get('/trips', async (req, res) => {
  const { month, year, driverId, status } = req.query;
  const where: any = {};
  if (driverId) where.driverId = Number(driverId);
  if (status) where.status = status;
  if (month && year) {
    const m = Number(month); const y = Number(year);
    where.tripDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }

  const trips = await prisma.driverTrip.findMany({
    where,
    include: {
      driver: { select: { id: true, name: true, code: true } },
      shopDrops: {
        include: { shop: { select: { id: true, name: true, code: true } } },
        orderBy: { droppedAt: 'asc' },
      },
      expenses: true,
    },
    orderBy: { tripDate: 'desc' },
  });
  res.json(trips);
});

// GET single trip
router.get('/trips/:id', async (req, res) => {
  const trip = await prisma.driverTrip.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      driver: { select: { id: true, name: true, code: true } },
      shopDrops: {
        include: { shop: { select: { id: true, name: true, code: true } } },
      },
      expenses: true,
    },
  });
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  res.json(trip);
});

// POST create trip (factory dispatch)
router.post('/trips', authorize('ADMIN', 'OFFICE', 'DRIVER'), async (req, res) => {
  const { driverId, tripDate, totalLitres, notes, drops } = req.body;

  const trip = await prisma.driverTrip.create({
    data: {
      driverId:     Number(driverId),
      tripDate:     new Date(tripDate || Date.now()),
      totalLitres:  Number(totalLitres) || 0,
      notes:        notes || null,
      status:       'PENDING',
      shopDrops: drops?.length ? {
        create: drops.map((d: any) => ({
          shopId:    Number(d.shopId),
          litres:    Number(d.litres),
          droppedAt: new Date(d.droppedAt || tripDate || Date.now()),
        })),
      } : undefined,
    },
    include: {
      driver: { select: { id: true, name: true, code: true } },
      shopDrops: { include: { shop: { select: { id: true, name: true } } } },
    },
  });
  res.status(201).json(trip);
});

// PUT update trip (add drops, change status)
router.put('/trips/:id', authorize('ADMIN', 'OFFICE', 'DRIVER'), async (req, res) => {
  const { status, notes, totalLitres } = req.body;
  const trip = await prisma.driverTrip.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(totalLitres !== undefined ? { totalLitres: Number(totalLitres) } : {}),
    },
    include: {
      driver: { select: { id: true, name: true } },
      shopDrops: { include: { shop: { select: { id: true, name: true } } } },
    },
  });
  res.json(trip);
});

// POST add drop to trip (driver records delivery to each shop)
router.post('/trips/:id/drops', authorize('ADMIN', 'OFFICE', 'DRIVER'), async (req, res) => {
  const { shopId, litres } = req.body;
  const drop = await prisma.shopDrop.create({
    data: {
      tripId:    Number(req.params.id),
      shopId:    Number(shopId),
      litres:    Number(litres),
      droppedAt: new Date(),
    },
    include: { shop: { select: { id: true, name: true } } },
  });

  // Update trip total
  const all = await prisma.shopDrop.findMany({ where: { tripId: Number(req.params.id) } });
  const total = all.reduce((s, d) => s + Number(d.litres), 0);
  await prisma.driverTrip.update({ where: { id: Number(req.params.id) }, data: { totalLitres: total } });

  res.status(201).json(drop);
});

// DELETE drop
router.delete('/trips/:tripId/drops/:dropId', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  await prisma.shopDrop.delete({ where: { id: Number(req.params.dropId) } });
  res.json({ success: true });
});

// POST confirm trip (office confirms driver invoice)
router.post('/trips/:id/confirm', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const trip = await prisma.driverTrip.update({
    where: { id: Number(req.params.id) },
    data: { status: 'CONFIRMED' },
  });
  res.json(trip);
});

// GET daily summary — what was dispatched vs received per shop
router.get('/daily-summary', async (req, res) => {
  const date = req.query.date ? new Date(String(req.query.date)) : new Date();
  date.setHours(0, 0, 0, 0);
  const next = new Date(date); next.setDate(next.getDate() + 1);

  const drops = await prisma.shopDrop.findMany({
    where: { droppedAt: { gte: date, lt: next } },
    include: {
      shop: { select: { id: true, name: true, code: true } },
      trip: { include: { driver: { select: { name: true } } } },
    },
  });

  const sales = await prisma.shopSale.findMany({
    where: { saleDate: { gte: date, lt: next } },
    include: { shop: { select: { id: true, name: true } } },
  });

  // Group by shop
  const byShop: Record<number, any> = {};
  for (const d of drops) {
    if (!byShop[d.shopId]) byShop[d.shopId] = { shop: d.shop, delivered: 0, sold: 0, cash: 0, till: 0, drivers: [] };
    byShop[d.shopId].delivered += Number(d.litres);
    byShop[d.shopId].drivers.push(d.trip.driver.name);
  }
  for (const s of sales) {
    if (!byShop[s.shopId]) byShop[s.shopId] = { shop: s.shop, delivered: 0, sold: 0, cash: 0, till: 0, drivers: [] };
    byShop[s.shopId].sold += Number(s.litresSold);
    byShop[s.shopId].cash += Number(s.cashCollected);
    byShop[s.shopId].till += Number(s.tillAmount || 0);
  }

  const summary = Object.values(byShop).map((s: any) => ({
    ...s,
    unaccounted: s.delivered - s.sold,
    expectedRevenue: s.sold * 60,
    actualRevenue: s.cash + s.till,
    revenueVariance: (s.cash + s.till) - (s.sold * 60),
    drivers: [...new Set(s.drivers)],
  }));

  res.json({
    date: date.toISOString().split('T')[0],
    shops: summary,
    totals: {
      delivered: summary.reduce((s, r) => s + r.delivered, 0),
      sold:      summary.reduce((s, r) => s + r.sold, 0),
      cash:      summary.reduce((s, r) => s + r.cash, 0),
      till:      summary.reduce((s, r) => s + r.till, 0),
      revenue:   summary.reduce((s, r) => s + r.actualRevenue, 0),
    },
  });
});

export default router;
