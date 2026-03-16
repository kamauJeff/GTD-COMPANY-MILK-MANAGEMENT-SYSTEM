import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// List payments with filters
router.get('/', async (req, res) => {
  const { month, year, isMidMonth, routeId, farmerId, status } = req.query;
  const where: any = {};
  if (month) where.periodMonth = Number(month);
  if (year) where.periodYear = Number(year);
  if (isMidMonth !== undefined) where.isMidMonth = isMidMonth === 'true';
  if (status) where.status = status;
  if (farmerId) where.farmerId = Number(farmerId);
  if (routeId) where.farmer = { routeId: Number(routeId) };

  const payments = await prisma.farmerPayment.findMany({
    where,
    include: { farmer: { include: { route: { select: { id: true, code: true, name: true } } } } },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { farmer: { name: 'asc' } }],
  });

  const totals = {
    count: payments.length,
    totalGross: payments.reduce((s, p) => s + Number(p.grossPay), 0),
    totalAdvances: payments.reduce((s, p) => s + Number(p.totalAdvances), 0),
    totalNet: payments.reduce((s, p) => s + Number(p.netPay), 0),
    negative: payments.filter(p => Number(p.netPay) < 0).length,
  };

  res.json({ payments, totals });
});

// Get routes list for payments
router.get('/routes', async (_req, res) => {
  const routes = await prisma.route.findMany({ orderBy: { code: 'asc' } });
  res.json(routes);
});

// Record advance
router.post('/advance', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerCode, farmerId, amount, notes, date } = req.body;
  let fId = farmerId;
  if (!fId && farmerCode) {
    const farmer = await prisma.farmer.findUnique({ where: { code: farmerCode.toUpperCase() } });
    if (!farmer) throw new AppError(404, `Farmer ${farmerCode} not found`);
    fId = farmer.id;
  }
  const advance = await prisma.farmerAdvance.create({
    data: { farmerId: Number(fId), amount: Number(amount), advanceDate: date ? new Date(date) : new Date(), notes: notes || null },
  });
  res.status(201).json(advance);
});

router.delete('/advance/:id', authorize('ADMIN'), async (req, res) => {
  await prisma.farmerAdvance.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

// Approve payments
router.post('/approve', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { periodMonth, periodYear, isMidMonth, routeId } = req.body;
  const where: any = { periodMonth: Number(periodMonth), periodYear: Number(periodYear), isMidMonth: !!isMidMonth, status: 'PENDING' };
  if (routeId) where.farmer = { routeId: Number(routeId) };
  const result = await prisma.farmerPayment.updateMany({ where, data: { status: 'APPROVED' } });
  res.json({ approved: result.count });
});

// Preview payment for a farmer
router.get('/preview', async (req, res) => {
  const { farmerId, month, year, isMidMonth } = req.query;
  if (!farmerId || !month || !year) throw new AppError(400, 'farmerId, month and year required');
  const m = Number(month); const y = Number(year);
  const isMid = isMidMonth === 'true';
  const start = new Date(y, m - 1, 1);
  const end = isMid ? new Date(y, m - 1, 15, 23, 59, 59) : new Date(y, m, 0, 23, 59, 59);

  const farmer = await prisma.farmer.findUnique({ where: { id: Number(farmerId) } });
  if (!farmer) throw new AppError(404, 'Farmer not found');

  const [collections, advances, deductions] = await Promise.all([
    prisma.milkCollection.findMany({ where: { farmerId: farmer.id, collectedAt: { gte: start, lte: end } } }),
    prisma.farmerAdvance.findMany({ where: { farmerId: farmer.id, advanceDate: { gte: start, lte: end } } }),
    prisma.farmerDeduction.findMany({ where: { farmerId: farmer.id, periodMonth: m, periodYear: y } }),
  ]);

  const totalLitres = collections.reduce((s, c) => s + Number(c.litres), 0);
  const grossPay = totalLitres * Number(farmer.pricePerLitre);
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
  const netPay = grossPay - totalAdvances - totalDeductions;

  res.json({ farmer, totalLitres, grossPay, totalAdvances, totalDeductions, netPay, collections, advances });
});

// Run/generate payment records
router.post('/run', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, isMidMonth, routeId } = req.body;
  const m = Number(month); const y = Number(year);
  const isMid = !!isMidMonth;
  const start = new Date(y, m - 1, 1);
  const end = isMid ? new Date(y, m - 1, 15, 23, 59, 59) : new Date(y, m, 0, 23, 59, 59);

  const farmerWhere: any = { isActive: true };
  if (routeId) farmerWhere.routeId = Number(routeId);
  const farmers = await prisma.farmer.findMany({ where: farmerWhere });

  let created = 0;
  for (const farmer of farmers) {
    const [collections, advances, deductions] = await Promise.all([
      prisma.milkCollection.findMany({ where: { farmerId: farmer.id, collectedAt: { gte: start, lte: end } } }),
      prisma.farmerAdvance.findMany({ where: { farmerId: farmer.id, advanceDate: { gte: start, lte: end } } }),
      prisma.farmerDeduction.findMany({ where: { farmerId: farmer.id, periodMonth: m, periodYear: y } }),
    ]);
    const totalLitres = collections.reduce((s, c) => s + Number(c.litres), 0);
    const grossPay = totalLitres * Number(farmer.pricePerLitre);
    const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
    const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
    const netPay = grossPay - totalAdvances - totalDeductions;

    await prisma.farmerPayment.upsert({
      where: { farmerId_periodMonth_periodYear_isMidMonth: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: isMid } },
      create: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: isMid, grossPay, totalAdvances, totalDeductions, netPay },
      update: { grossPay, totalAdvances, totalDeductions, netPay },
    });
    created++;
  }
  res.json({ created });
});

export default router;
