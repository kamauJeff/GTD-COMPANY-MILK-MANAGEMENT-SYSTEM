// src/controllers/report.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

// Monthly grid: rows = farmers, columns = days 1-31, cells = litres
export async function collectionGrid(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');

  const m = Number(month);
  const y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const where: any = { collectedAt: { gte: start, lt: end } };
  if (routeId) where.routeId = Number(routeId);

  const collections = await prisma.milkCollection.findMany({
    where,
    select: { farmerId: true, litres: true, collectedAt: true },
  });

  const farmerIds = [...new Set(collections.map((c) => c.farmerId))];
  const farmers = await prisma.farmer.findMany({
    where: { id: { in: farmerIds } },
    select: { id: true, code: true, name: true, pricePerLitre: true },
    orderBy: { name: 'asc' },
  });

  // Build grid
  const daysInMonth = new Date(y, m, 0).getDate();
  const grid = farmers.map((farmer) => {
    const days: Record<number, number> = {};
    for (let d = 1; d <= daysInMonth; d++) days[d] = 0;

    collections
      .filter((c) => c.farmerId === farmer.id)
      .forEach((c) => {
        const day = new Date(c.collectedAt).getDate();
        days[day] = (days[day] ?? 0) + Number(c.litres);
      });

    const total = Object.values(days).reduce((a, b) => a + b, 0);
    return { farmer, days, total, grossPay: total * Number(farmer.pricePerLitre) };
  });

  res.json({ month: m, year: y, daysInMonth, data: grid });
}

export async function monthlyFarmerStatement(req: Request, res: Response) {
  const { farmerId } = req.params;
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');

  const m = Number(month);
  const y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const [farmer, collections, advances, deductions] = await Promise.all([
    prisma.farmer.findUnique({ where: { id: Number(farmerId) } }),
    prisma.milkCollection.findMany({ where: { farmerId: Number(farmerId), collectedAt: { gte: start, lt: end } }, orderBy: { collectedAt: 'asc' } }),
    prisma.farmerAdvance.findMany({ where: { farmerId: Number(farmerId), advanceDate: { gte: start, lt: end } } }),
    prisma.farmerDeduction.findMany({ where: { farmerId: Number(farmerId), periodMonth: m, periodYear: y } }),
  ]);

  if (!farmer) throw new AppError(404, 'Farmer not found');

  const totalLitres = collections.reduce((s, c) => s + Number(c.litres), 0);
  const grossPay = totalLitres * Number(farmer.pricePerLitre);
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
  const netPay = grossPay - totalAdvances - totalDeductions;

  res.json({ farmer, collections, advances, deductions, summary: { totalLitres, grossPay, totalAdvances, totalDeductions, netPay } });
}

export async function factoryEfficiency(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 1);

  const batches = await prisma.pasteurizationBatch.findMany({
    where: { processedAt: { gte: start, lt: end } },
  });

  const totalInput = batches.reduce((s, b) => s + Number(b.inputLitres), 0);
  const totalOutput = batches.reduce((s, b) => s + Number(b.outputLitres), 0);
  const totalLoss = batches.reduce((s, b) => s + Number(b.lossLitres), 0);
  const efficiencyPct = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(2) : '0';

  res.json({ batches, summary: { totalInput, totalOutput, totalLoss, efficiencyPct } });
}

