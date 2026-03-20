import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import { getCollections, createCollection, batchSync, getDailyRouteTotals, getGraderDailyTotal, getJournalGrid, exportJournalExcel, getJournalGridFull } from '../controllers/collection.controller';

const router = Router();
router.use(authenticate);

router.get('/', getCollections);
router.get('/daily-totals', getDailyRouteTotals);
router.get('/grader-total', getGraderDailyTotal);
router.get('/journal', getJournalGrid);
router.get('/journal-full', getJournalGridFull);
router.get('/export', exportJournalExcel);
router.post('/', authorize('GRADER', 'ADMIN'), createCollection);
router.post('/batch', authorize('GRADER', 'ADMIN'), batchSync);

export default router;

// Farmer monthly statement
router.get('/statement', async (req, res) => {
  const { farmerCode, month, year } = req.query;
  const m = Number(month); const y = Number(year);

  const farmer = await prisma.farmer.findFirst({
    where: { code: String(farmerCode).toUpperCase() },
    include: { route: { select: { name: true } } },
  });
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });

  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);

  const [collections, advances] = await Promise.all([
    prisma.milkCollection.findMany({ where: { farmerId: farmer.id, collectedAt: { gte: start, lt: end } } }),
    prisma.farmerAdvance.findMany({ where: { farmerId: farmer.id, advanceDate: { gte: start, lt: end } } }),
  ]);

  const dailyLitres: Record<number, number> = {};
  let totalLitres = 0;
  for (const c of collections) {
    const day = new Date(c.collectedAt).getDate();
    dailyLitres[day] = (dailyLitres[day] || 0) + Number(c.litres);
    totalLitres += Number(c.litres);
  }

  const grossPay = totalLitres * Number(farmer.pricePerLitre);
  const advancesMap: Record<string, number> = {};
  let totalAdvances = 0;
  for (const a of advances) {
    const key = new Date(a.advanceDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    advancesMap[key] = (advancesMap[key] || 0) + Number(a.amount);
    totalAdvances += Number(a.amount);
  }

  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear  = m === 1 ? y - 1 : y;
  const prevNeg = await prisma.farmerPayment.findFirst({
    where: { farmerId: farmer.id, periodMonth: prevMonth, periodYear: prevYear, netPay: { lt: 0 }, status: 'PAID' },
  });
  const bfBalance = prevNeg ? Math.abs(Number(prevNeg.netPay)) : 0;
  const netPay = grossPay - totalAdvances - bfBalance;

  res.json({
    farmer: { ...farmer, route: farmer.route },
    daysInMonth: new Date(y, m, 0).getDate(),
    dailyLitres, totalLitres, grossPay,
    advances: advancesMap, totalAdvances, bfBalance, netPay,
    month: m, year: y,
  });
});

// PUT /api/collections/correct-by-farmer — correct by farmer code + date
router.put('/correct-by-farmer', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerCode, collectedAt, litres } = req.body;
  if (!farmerCode || !collectedAt || !litres) return res.status(400).json({ error: 'farmerCode, collectedAt and litres are required' });

  const farmer = await prisma.farmer.findFirst({ where: { code: farmerCode.toUpperCase() } });
  if (!farmer) return res.status(404).json({ error: `Farmer ${farmerCode} not found` });

  const dayStart = new Date(collectedAt); dayStart.setHours(0,0,0,0);
  const dayEnd   = new Date(collectedAt); dayEnd.setHours(23,59,59,999);

  // Find the most recent collection for this farmer on that date
  const existing = await prisma.milkCollection.findFirst({
    where: { farmerId: farmer.id, collectedAt: { gte: dayStart, lte: dayEnd } },
    orderBy: { collectedAt: 'desc' },
  });

  if (!existing) return res.status(404).json({ error: `No collection found for ${farmerCode} on ${collectedAt}` });

  const updated = await prisma.milkCollection.update({
    where: { id: existing.id },
    data: { litres: Number(litres) },
    include: { farmer: { select: { code: true, name: true } }, route: { select: { name: true } } },
  });
  res.json({ ...updated, previousLitres: Number(existing.litres), corrected: true });
});

// PUT /api/collections/:id — correct by ID (admin)
router.put('/:id', authorize('ADMIN'), async (req, res) => {
  const { litres, collectedAt } = req.body;
  const collection = await prisma.milkCollection.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(litres !== undefined ? { litres: Number(litres) } : {}),
      ...(collectedAt ? { collectedAt: new Date(collectedAt) } : {}),
    },
    include: { farmer: { select: { code: true, name: true } }, route: { select: { name: true } } },
  });
  res.json(collection);
});

// DELETE /api/collections/:id — delete wrong entry (admin only)
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  await prisma.milkCollection.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

// POST /api/collections/manual — manual entry by office for a farmer
router.post('/manual', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerId, farmerCode, routeId, litres, collectedAt, graderId } = req.body;
  let fId = farmerId;
  if (!fId && farmerCode) {
    const farmer = await prisma.farmer.findFirst({ where: { code: farmerCode.toUpperCase() } });
    if (!farmer) return res.status(404).json({ error: `Farmer ${farmerCode} not found` });
    fId = farmer.id;
  }
  const farmer = await prisma.farmer.findUnique({
    where: { id: Number(fId) },
    include: { route: { select: { id: true } } },
  });
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });

  const collection = await prisma.milkCollection.create({
    data: {
      farmerId:    Number(fId),
      routeId:     routeId ? Number(routeId) : (farmer.route?.id || farmer.routeId),
      graderId:    graderId ? Number(graderId) : null,
      litres:      Number(litres),
      collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
    },
    include: { farmer: { select: { code: true, name: true } }, route: { select: { name: true } } },
  });
  res.status(201).json(collection);
});

// POST /api/collections/advance/correct — record advance or b/f correction
router.post('/advance/correct', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerId, farmerCode, amount, notes, advanceDate } = req.body;
  let fId = farmerId;
  if (!fId && farmerCode) {
    const farmer = await prisma.farmer.findFirst({ where: { code: farmerCode.toUpperCase() } });
    if (!farmer) return res.status(404).json({ error: `Farmer ${farmerCode} not found` });
    fId = farmer.id;
  }
  if (!fId) return res.status(400).json({ error: 'Farmer code required' });

  const isBfCorrection = notes?.toLowerCase().includes('b/f');

  if (isBfCorrection) {
    // Save as FarmerDeduction for b/f
    const result = await prisma.farmerDeduction.create({
      data: {
        farmerId:      Number(fId),
        amount:        Number(amount),
        reason:        notes || 'B/f correction',
        deductionDate: new Date(),
        periodMonth:   new Date().getMonth() + 1,
        periodYear:    new Date().getFullYear(),
      },
      include: { farmer: { select: { code: true, name: true } } },
    });
    res.status(201).json({ ...result, type: 'bf_correction' });
  } else {
    // Save as FarmerAdvance for advance correction
    const result = await prisma.farmerAdvance.create({
      data: {
        farmerId:    Number(fId),
        amount:      Number(amount),
        advanceDate: advanceDate ? new Date(advanceDate) : new Date(),
        notes:       notes || 'Office advance correction',
      },
      include: { farmer: { select: { code: true, name: true } } },
    });
    res.status(201).json({ ...result, type: 'advance' });
  }
});
