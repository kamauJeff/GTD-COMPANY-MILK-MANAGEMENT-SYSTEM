// src/controllers/collection.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendCollectionSMS } from '../services/sms.service';

// ── Monthly journal grid for a route ─────────────────────────
// Returns: farmers × daily litres + deductions + carry-forward debt
export async function getCollectionJournal(req: Request, res: Response) {
  const { routeId, month, year } = req.query;
  if (!routeId || !month || !year) throw new AppError(400, 'routeId, month and year required');

  const m          = Number(month), y = Number(year);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 1);
  const daysInMonth = new Date(y, m, 0).getDate();

  // Previous month for carry-forward
  const prevM      = m === 1 ? 12 : m - 1;
  const prevY      = m === 1 ? y - 1 : y;

  const farmers = await prisma.farmer.findMany({
    where: { routeId: Number(routeId), isActive: true },
    include: {
      route: { select: { id: true, name: true } },
      collections: {
        where: { collectedAt: { gte: monthStart, lt: monthEnd } },
        select: { litres: true, collectedAt: true },
      },
      advances: {
        where: { advanceDate: { gte: monthStart, lt: monthEnd } },
        select: { id: true, amount: true, advanceDate: true, notes: true },
      },
      deductions: {
        where: { periodMonth: m, periodYear: y },
        select: { id: true, amount: true, reason: true, deductionDate: true },
      },
      // Previous month end-payment to get carry-forward debt
      payments: {
        where: { periodMonth: prevM, periodYear: prevY, isMidMonth: false },
        select: { id: true, netPay: true, status: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const result = farmers.map(farmer => {
    // Daily litres
    const daily = Array(daysInMonth).fill(0);
    farmer.collections.forEach(c => {
      const day = new Date(c.collectedAt).getDate();
      if (day >= 1 && day <= daysInMonth)
        daily[day - 1] = Number((daily[day - 1] + Number(c.litres)).toFixed(1));
    });

    const totalLitres15 = daily.slice(0, 15).reduce((s, v) => s + v, 0);
    const totalLitres   = daily.reduce((s, v) => s + v, 0);
    const price         = Number(farmer.pricePerLitre);
    const grossPay      = Number((totalLitres * price).toFixed(2));

    // Carry-forward: if previous month net pay was negative, that's the debt
    const prevPayment  = farmer.payments[0];
    const balBf        = prevPayment && Number(prevPayment.netPay) < 0
      ? Math.abs(Number(prevPayment.netPay))
      : 0;

    // Advances bucketed by slot
    const adv = { adv5: 0, adv10: 0, adv15: 0, adv20: 0, adv25: 0, emerAI: 0 };
    farmer.advances.forEach(a => {
      const day = new Date(a.advanceDate).getDate();
      const amt = Number(a.amount);
      if      (day <= 5)  adv.adv5   += amt;
      else if (day <= 10) adv.adv10  += amt;
      else if (day <= 15) adv.adv15  += amt;
      else if (day <= 20) adv.adv20  += amt;
      else if (day <= 25) adv.adv25  += amt;
      else                adv.emerAI += amt;
    });
    const totalAdv = Number(Object.values(adv).reduce((s, v) => s + v, 0).toFixed(2));

    // Other deductions
    const otherDeductions = farmer.deductions.map(d => ({
      id:     d.id,
      amount: Number(d.amount),
      reason: d.reason,
      date:   d.deductionDate,
    }));
    const totalOtherDeductions = Number(otherDeductions.reduce((s, d) => s + d.amount, 0).toFixed(2));

    // Payment calculations
    const totalDeductions = Number((balBf + totalAdv + totalOtherDeductions).toFixed(2));
    const netPay          = Number((grossPay - totalDeductions).toFixed(2));

    // Mid-month
    const midGross   = Number((totalLitres15 * price).toFixed(2));
    const midAdv     = Number((adv.adv5 + adv.adv10 + adv.adv15).toFixed(2));
    const midPayable = Number((midGross - midAdv).toFixed(2));

    // End-month
    const endPayable = netPay;

    // Debt alert: should we restrict further advances?
    const debtRisk = balBf > grossPay * 0.5; // debt > 50% of gross = flag

    return {
      id:            farmer.id,
      code:          farmer.code,
      name:          farmer.name,
      phone:         farmer.phone,
      paymentMethod: farmer.paymentMethod,
      pricePerLitre: price,
      daily,
      daysInMonth,
      totalLitres15: Number(totalLitres15.toFixed(1)),
      totalLitres:   Number(totalLitres.toFixed(1)),
      grossPay,
      // Carry-forward
      balBf,
      prevMonthStatus: prevPayment?.status ?? null,
      // Advances
      adv5:   Number(adv.adv5.toFixed(2)),
      adv10:  Number(adv.adv10.toFixed(2)),
      adv15:  Number(adv.adv15.toFixed(2)),
      adv20:  Number(adv.adv20.toFixed(2)),
      adv25:  Number(adv.adv25.toFixed(2)),
      emerAI: Number(adv.emerAI.toFixed(2)),
      totalAdv,
      // Other deductions
      otherDeductions,
      totalOtherDeductions,
      // Totals
      totalDeductions,
      midPayable,
      netPay,
      endPayable,
      debtRisk,
      hasDebt: netPay < 0,
    };
  });

  // Column totals
  const dailyTotals = Array(daysInMonth).fill(0).map((_, i) =>
    Number(result.reduce((s, f) => s + (f.daily[i] || 0), 0).toFixed(1))
  );

  const active = result.filter(f => f.totalLitres > 0);

  res.json({
    farmers: result,
    daysInMonth,
    totals: {
      farmers:            active.length,
      totalLitres:        Number(active.reduce((s, f) => s + f.totalLitres, 0).toFixed(1)),
      grossPay:           Number(active.reduce((s, f) => s + f.grossPay, 0).toFixed(2)),
      totalAdv:           Number(active.reduce((s, f) => s + f.totalAdv, 0).toFixed(2)),
      totalBalBf:         Number(active.reduce((s, f) => s + f.balBf, 0).toFixed(2)),
      totalOtherDed:      Number(active.reduce((s, f) => s + f.totalOtherDeductions, 0).toFixed(2)),
      netPay:             Number(active.reduce((s, f) => s + f.netPay, 0).toFixed(2)),
      midPayable:         Number(active.reduce((s, f) => s + f.midPayable, 0).toFixed(2)),
      farmersWithDebt:    result.filter(f => f.hasDebt).length,
      farmersAtRisk:      result.filter(f => f.debtRisk).length,
      dailyTotals,
    },
  });
}

// ── Record a deduction ────────────────────────────────────────
export async function recordDeduction(req: Request, res: Response) {
  const { farmerId, amount, reason, deductionDate, periodMonth, periodYear } = req.body;
  if (!farmerId || !amount || !reason || !periodMonth || !periodYear)
    throw new AppError(400, 'farmerId, amount, reason, periodMonth, periodYear required');

  const deduction = await prisma.farmerDeduction.create({
    data: {
      farmerId:      Number(farmerId),
      amount:        Number(amount),
      reason,
      deductionDate: new Date(deductionDate || new Date()),
      periodMonth:   Number(periodMonth),
      periodYear:    Number(periodYear),
    },
  });
  res.status(201).json(deduction);
}

// ── Delete a deduction ────────────────────────────────────────
export async function deleteDeduction(req: Request, res: Response) {
  await prisma.farmerDeduction.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Deduction deleted' });
}

// ── Get debt summary across all routes ────────────────────────
export async function getDebtSummary(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;

  // Find all end-month payments with negative net pay from prev month
  const debtPayments = await prisma.farmerPayment.findMany({
    where: { periodMonth: prevM, periodYear: prevY, isMidMonth: false },
    include: {
      farmer: {
        select: {
          id: true, code: true, name: true, phone: true,
          route: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { netPay: 'asc' },
  });

  const debtors = debtPayments
    .filter(p => Number(p.netPay) < 0)
    .map(p => ({
      farmerId:   p.farmer.id,
      code:       p.farmer.code,
      name:       p.farmer.name,
      phone:      p.farmer.phone,
      routeName:  p.farmer.route.name,
      debtAmount: Math.abs(Number(p.netPay)),
      fromMonth:  prevM,
      fromYear:   prevY,
    }));

  res.json({
    total:       debtors.length,
    totalDebt:   Number(debtors.reduce((s, d) => s + d.debtAmount, 0).toFixed(2)),
    debtors,
  });
}

// ── Existing endpoints ────────────────────────────────────────
export async function getCollections(req: Request, res: Response) {
  const { routeId, farmerId, date, page = '1', limit = '100' } = req.query;
  const where: any = {};
  if (routeId)  where.routeId  = Number(routeId);
  if (farmerId) where.farmerId = Number(farmerId);
  if (date) {
    const d = new Date(String(date));
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    where.collectedAt = { gte: d, lt: next };
  }

  const [total, collections] = await Promise.all([
    prisma.milkCollection.count({ where }),
    prisma.milkCollection.findMany({
      where,
      include: {
        farmer: { select: { id: true, code: true, name: true, phone: true, pricePerLitre: true } },
        route:  { select: { id: true, name: true } },
        grader: { select: { id: true, name: true } },
      },
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
      orderBy: { collectedAt: 'desc' },
    }),
  ]);

  res.json({ data: collections, total });
}

export async function createCollection(req: Request, res: Response) {
  const { farmerId, litres, collectedAt } = req.body;
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) throw new AppError(404, 'Farmer not found');

  const collection = await prisma.milkCollection.create({
    data: { farmerId, routeId: farmer.routeId, graderId: req.user!.sub, litres, collectedAt: new Date(collectedAt), synced: true },
  });

  sendCollectionSMS(farmer, collection).catch(() => {});
  res.status(201).json(collection);
}

export async function batchSync(req: Request, res: Response) {
  const records: any[] = req.body.records;
  if (!Array.isArray(records) || records.length === 0)
    throw new AppError(400, 'records array is required');

  const results = { created: 0, failed: 0, errors: [] as string[] };

  for (const r of records) {
    try {
      const farmer = await prisma.farmer.findUnique({ where: { id: r.farmerId } });
      if (!farmer) { results.failed++; results.errors.push(`Unknown farmer ${r.farmerId}`); continue; }
      await prisma.milkCollection.create({
        data: { farmerId: r.farmerId, routeId: farmer.routeId, graderId: req.user!.sub, litres: r.litres, collectedAt: new Date(r.collectedAt), receiptNo: r.receiptNo, synced: true },
      });
      results.created++;
      sendCollectionSMS(farmer, { litres: r.litres, collectedAt: r.collectedAt } as any).catch(() => {});
    } catch (e: any) {
      results.failed++;
      results.errors.push(e.message);
    }
  }
  res.json(results);
}

export async function getDailyRouteTotals(req: Request, res: Response) {
  const { date } = req.query;
  const d = date ? new Date(String(date)) : new Date();
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);

  const totals = await prisma.milkCollection.groupBy({
    by:    ['routeId'],
    where: { collectedAt: { gte: d, lt: next } },
    _sum:  { litres: true },
    _count:{ farmerId: true },
  });

  const routes    = await prisma.route.findMany({ select: { id: true, code: true, name: true } });
  const routeMap  = Object.fromEntries(routes.map(r => [r.id, r]));

  res.json(totals.map(t => ({
    route:       routeMap[t.routeId],
    totalLitres: t._sum.litres ?? 0,
    farmerCount: t._count.farmerId,
  })));
}
