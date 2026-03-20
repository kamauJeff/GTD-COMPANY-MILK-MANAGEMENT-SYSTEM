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
