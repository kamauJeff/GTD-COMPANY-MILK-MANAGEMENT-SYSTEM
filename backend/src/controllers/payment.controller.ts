// src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

// ── Get payment summary for a month ─────────────────────────
export async function getMonthlyPayments(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 1);

  const where: any = { isActive: true };
  if (routeId) where.routeId = Number(routeId);

  const farmers = await prisma.farmer.findMany({
    where,
    include: {
      route: { select: { id: true, name: true } },
      collections: {
        where: { collectedAt: { gte: monthStart, lt: monthEnd } },
        select: { litres: true, collectedAt: true },
      },
      advances: {
        where: { advanceDate: { gte: monthStart, lt: monthEnd } },
        select: { amount: true, advanceDate: true, notes: true },
      },
      payments: {
        where: { periodMonth: m, periodYear: y },
        select: { id: true, isMidMonth: true, grossPay: true, totalAdvances: true, netPay: true, status: true, paidAt: true },
      },
    },
    orderBy: [{ route: { name: 'asc' } }, { name: 'asc' }],
  });

  // Compute payment data per farmer
  const result = farmers.map(farmer => {
    const totalLitres = farmer.collections.reduce((s, c) => s + Number(c.litres), 0);
    const grossPay = totalLitres * Number(farmer.pricePerLitre);

    // Advances by slot
    const advBySlot = { adv5: 0, adv10: 0, adv15: 0, adv20: 0, adv25: 0, emerAI: 0 };
    let totalAdvances = 0;
    farmer.advances.forEach(a => {
      const day = new Date(a.advanceDate).getDate();
      const amt = Number(a.amount);
      totalAdvances += amt;
      if (day <= 5)       advBySlot.adv5  += amt;
      else if (day <= 10) advBySlot.adv10 += amt;
      else if (day <= 15) advBySlot.adv15 += amt;
      else if (day <= 20) advBySlot.adv20 += amt;
      else if (day <= 25) advBySlot.adv25 += amt;
      else                advBySlot.emerAI += amt;
    });

    // Mid month (first 15 days)
    const midLitres = farmer.collections
      .filter(c => new Date(c.collectedAt).getDate() <= 15)
      .reduce((s, c) => s + Number(c.litres), 0);
    const midGross = midLitres * Number(farmer.pricePerLitre);
    const midAdvances = advBySlot.adv5 + advBySlot.adv10 + advBySlot.adv15;
    const midPayable = midGross - midAdvances;

    const netPay = grossPay - totalAdvances;

    const midPayment  = farmer.payments.find(p => p.isMidMonth);
    const endPayment  = farmer.payments.find(p => !p.isMidMonth);

    return {
      id: farmer.id,
      code: farmer.code,
      name: farmer.name,
      phone: farmer.phone,
      routeId: farmer.routeId,
      routeName: farmer.route.name,
      paymentMethod: farmer.paymentMethod,
      mpesaPhone: farmer.mpesaPhone,
      bankName: farmer.bankName,
      bankAccount: farmer.bankAccount,
      pricePerLitre: Number(farmer.pricePerLitre),
      paidOn15th: farmer.paidOn15th,
      totalLitres: Number(totalLitres.toFixed(1)),
      grossPay: Number(grossPay.toFixed(2)),
      ...advBySlot,
      totalAdvances: Number(totalAdvances.toFixed(2)),
      netPay: Number(netPay.toFixed(2)),
      midLitres: Number(midLitres.toFixed(1)),
      midGross: Number(midGross.toFixed(2)),
      midAdvances: Number(midAdvances.toFixed(2)),
      midPayable: Number(midPayable.toFixed(2)),
      midPayment:  midPayment  ? { id: midPayment.id,  status: midPayment.status,  paidAt: midPayment.paidAt  } : null,
      endPayment:  endPayment  ? { id: endPayment.id,  status: endPayment.status,  paidAt: endPayment.paidAt  } : null,
    };
  });

  // Route totals
  const totals = {
    farmers: result.length,
    totalLitres: result.reduce((s, f) => s + f.totalLitres, 0),
    grossPay: result.reduce((s, f) => s + f.grossPay, 0),
    totalAdvances: result.reduce((s, f) => s + f.totalAdvances, 0),
    netPay: result.reduce((s, f) => s + f.netPay, 0),
  };

  res.json({ farmers: result, totals });
}

// ── Record an advance ────────────────────────────────────────
export async function recordAdvance(req: Request, res: Response) {
  const { farmerId, amount, advanceDate, notes } = req.body;
  if (!farmerId || !amount || !advanceDate) throw new AppError(400, 'farmerId, amount, advanceDate required');

  const advance = await prisma.farmerAdvance.create({
    data: { farmerId: Number(farmerId), amount, advanceDate: new Date(advanceDate), notes },
  });
  res.status(201).json(advance);
}

// ── Delete an advance ────────────────────────────────────────
export async function deleteAdvance(req: Request, res: Response) {
  await prisma.farmerAdvance.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Advance deleted' });
}

// ── Process payment for a farmer ─────────────────────────────
export async function processPayment(req: Request, res: Response) {
  const { farmerId, month, year, isMidMonth, grossPay, totalAdvances, netPay } = req.body;

  const payment = await prisma.farmerPayment.upsert({
    where: {
      farmerId_periodMonth_periodYear_isMidMonth: {
        farmerId: Number(farmerId),
        periodMonth: Number(month),
        periodYear: Number(year),
        isMidMonth: Boolean(isMidMonth),
      },
    },
    update: { grossPay, totalAdvances, totalDeductions: 0, netPay, status: 'PENDING' },
    create: {
      farmerId: Number(farmerId),
      periodMonth: Number(month),
      periodYear: Number(year),
      isMidMonth: Boolean(isMidMonth),
      grossPay, totalAdvances, totalDeductions: 0, netPay,
      status: 'PENDING',
    },
  });
  res.json(payment);
}

// ── Bulk approve payments for a route/month ──────────────────
export async function approvePayments(req: Request, res: Response) {
  const { month, year, routeId, isMidMonth } = req.body;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 1);

  const where: any = { isActive: true };
  if (routeId) where.routeId = Number(routeId);

  const farmers = await prisma.farmer.findMany({
    where,
    include: {
      collections: {
        where: { collectedAt: { gte: monthStart, lt: monthEnd } },
        select: { litres: true, collectedAt: true },
      },
      advances: {
        where: { advanceDate: { gte: monthStart, lt: monthEnd } },
        select: { amount: true, advanceDate: true },
      },
    },
  });

  let processed = 0;
  for (const farmer of farmers) {
    const totalLitres = farmer.collections.reduce((s, c) => s + Number(c.litres), 0);
    if (totalLitres === 0) continue;

    const grossPay = totalLitres * Number(farmer.pricePerLitre);
    let totalAdvances = 0;

    if (isMidMonth) {
      const midLitres = farmer.collections
        .filter(c => new Date(c.collectedAt).getDate() <= 15)
        .reduce((s, c) => s + Number(c.litres), 0);
      const midGross = midLitres * Number(farmer.pricePerLitre);
      farmer.advances.forEach(a => {
        const day = new Date(a.advanceDate).getDate();
        if (day <= 15) totalAdvances += Number(a.amount);
      });
      const netPay = midGross - totalAdvances;

      await prisma.farmerPayment.upsert({
        where: { farmerId_periodMonth_periodYear_isMidMonth: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: true } },
        update: { grossPay: midGross, totalAdvances, totalDeductions: 0, netPay, status: 'APPROVED' },
        create: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: true, grossPay: midGross, totalAdvances, totalDeductions: 0, netPay, status: 'APPROVED' },
      });
    } else {
      farmer.advances.forEach(a => { totalAdvances += Number(a.amount); });
      const netPay = grossPay - totalAdvances;
      await prisma.farmerPayment.upsert({
        where: { farmerId_periodMonth_periodYear_isMidMonth: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: false } },
        update: { grossPay, totalAdvances, totalDeductions: 0, netPay, status: 'APPROVED' },
        create: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: false, grossPay, totalAdvances, totalDeductions: 0, netPay, status: 'APPROVED' },
      });
    }
    processed++;
  }

  res.json({ message: `${processed} payments approved` });
}

// ── Get routes for filter dropdown ───────────────────────────
export async function getRouteSummary(req: Request, res: Response) {
  const { month, year } = req.query;
  const routes = await prisma.route.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { farmers: { where: { isActive: true } } } } },
  });
  res.json(routes);
}
