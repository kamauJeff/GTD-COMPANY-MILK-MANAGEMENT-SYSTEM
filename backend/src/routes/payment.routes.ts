// src/routes/payment.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// Record advance
router.post('/advances', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const advance = await prisma.farmerAdvance.create({ data: { ...req.body, advanceDate: new Date(req.body.advanceDate) } });
  res.status(201).json(advance);
});

// Preview month-end payment for a farmer
router.get('/preview/:farmerId', async (req, res) => {
  const { month, year, isMidMonth } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');
  const m = Number(month); const y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const farmer = await prisma.farmer.findUnique({ where: { id: Number(req.params.farmerId) } });
  if (!farmer) throw new AppError(404, 'Farmer not found');

  const collections = await prisma.milkCollection.findMany({ where: { farmerId: farmer.id, collectedAt: { gte: start, lt: end } } });
  const advances = await prisma.farmerAdvance.findMany({ where: { farmerId: farmer.id, advanceDate: { gte: start, lt: end } } });
  const deductions = await prisma.farmerDeduction.findMany({ where: { farmerId: farmer.id, periodMonth: m, periodYear: y } });

  const totalLitres = collections.reduce((s, c) => s + Number(c.litres), 0);
  const grossPay = totalLitres * Number(farmer.pricePerLitre);
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
  const netPay = grossPay - totalAdvances - totalDeductions;

  res.json({ farmer, totalLitres, grossPay, totalAdvances, totalDeductions, netPay });
});

// Run payment (creates FarmerPayment record)
router.post('/run', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerIds, month, year, isMidMonth } = req.body;
  const created = [];
  for (const farmerId of farmerIds) {
    const m = Number(month); const y = Number(year);
    const start = new Date(y, m - 1, 1); const end = new Date(y, m, 1);
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) continue;
    const collections = await prisma.milkCollection.findMany({ where: { farmerId, collectedAt: { gte: start, lt: end } } });
    const advances = await prisma.farmerAdvance.findMany({ where: { farmerId, advanceDate: { gte: start, lt: end } } });
    const deductions = await prisma.farmerDeduction.findMany({ where: { farmerId, periodMonth: m, periodYear: y } });
    const totalLitres = collections.reduce((s, c) => s + Number(c.litres), 0);
    const grossPay = totalLitres * Number(farmer.pricePerLitre);
    const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
    const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
    const netPay = grossPay - totalAdvances - totalDeductions;
    const payment = await prisma.farmerPayment.upsert({
      where: { farmerId_periodMonth_periodYear_isMidMonth: { farmerId, periodMonth: m, periodYear: y, isMidMonth: !!isMidMonth } },
      create: { farmerId, periodMonth: m, periodYear: y, isMidMonth: !!isMidMonth, grossPay, totalAdvances, totalDeductions, netPay },
      update: { grossPay, totalAdvances, totalDeductions, netPay },
    });
    created.push(payment);
  }
  res.json({ created: created.length, records: created });
});

export default router;

