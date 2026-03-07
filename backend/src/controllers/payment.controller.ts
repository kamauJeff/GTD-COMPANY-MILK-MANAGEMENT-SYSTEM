// src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

// ── Journal-style grid: daily litres + payment calc per farmer ──
export async function getPaymentJournal(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const monthStart  = new Date(y, m - 1, 1);
  const monthEnd    = new Date(y, m, 1);
  const daysInMonth = new Date(y, m, 0).getDate();

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
        select: { id: true, amount: true, advanceDate: true, notes: true },
      },
      payments: {
        where: { periodMonth: m, periodYear: y },
        select: { id: true, isMidMonth: true, netPay: true, status: true, paidAt: true },
      },
    },
    orderBy: [{ route: { name: 'asc' } }, { name: 'asc' }],
  });

  const result = farmers.map(farmer => {
    // Daily litres array [day1..dayN]
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

    const totalAdv   = Number(Object.values(adv).reduce((s, v) => s + v, 0).toFixed(2));
    const amtPayable = Number((grossPay - totalAdv).toFixed(2));

    // Mid-month (1-15)
    const midGross   = Number((totalLitres15 * price).toFixed(2));
    const midAdv     = Number((adv.adv5 + adv.adv10 + adv.adv15).toFixed(2));
    const midCf      = Number((midGross - midAdv).toFixed(2));
    const midPayable = midCf > 0 ? midCf : 0;

    // End-month payable
    const endCf      = amtPayable;
    const endPayable = amtPayable > 0 ? amtPayable : 0;

    const midPayment = farmer.payments.find(p => p.isMidMonth);
    const endPayment = farmer.payments.find(p => !p.isMidMonth);

    return {
      id: farmer.id, code: farmer.code, name: farmer.name, phone: farmer.phone,
      routeId: farmer.routeId, routeName: farmer.route.name,
      paymentMethod: farmer.paymentMethod, mpesaPhone: farmer.mpesaPhone,
      bankName: farmer.bankName, bankAccount: farmer.bankAccount,
      pricePerLitre: price, paidOn15th: farmer.paidOn15th,
      daily, daysInMonth,
      totalLitres15: Number(totalLitres15.toFixed(1)),
      totalLitres:   Number(totalLitres.toFixed(1)),
      grossPay,
      adv5: Number(adv.adv5.toFixed(2)), adv10: Number(adv.adv10.toFixed(2)),
      adv15: Number(adv.adv15.toFixed(2)), adv20: Number(adv.adv20.toFixed(2)),
      adv25: Number(adv.adv25.toFixed(2)), emerAI: Number(adv.emerAI.toFixed(2)),
      totalAdv, amtPayable,
      midGross, midAdv, midPayable, midCf,
      endCf, endPayable,
      midPayment: midPayment ? { id: midPayment.id, status: midPayment.status, paidAt: midPayment.paidAt } : null,
      endPayment: endPayment ? { id: endPayment.id, status: endPayment.status, paidAt: endPayment.paidAt } : null,
    };
  });

  const active = result.filter(f => f.totalLitres > 0);
  const dailyTotals = Array(daysInMonth).fill(0).map((_, i) =>
    Number(active.reduce((s, f) => s + (f.daily[i] || 0), 0).toFixed(1))
  );

  res.json({
    farmers: result, daysInMonth,
    totals: {
      farmers: active.length,
      totalLitres:  Number(active.reduce((s, f) => s + f.totalLitres, 0).toFixed(1)),
      grossPay:     Number(active.reduce((s, f) => s + f.grossPay, 0).toFixed(2)),
      totalAdv:     Number(active.reduce((s, f) => s + f.totalAdv, 0).toFixed(2)),
      amtPayable:   Number(active.reduce((s, f) => s + f.amtPayable, 0).toFixed(2)),
      midPayable:   Number(active.reduce((s, f) => s + f.midPayable, 0).toFixed(2)),
      endPayable:   Number(active.reduce((s, f) => s + f.endPayable, 0).toFixed(2)),
      dailyTotals,
    },
  });
}

// ── Record an advance ─────────────────────────────────────────
export async function recordAdvance(req: Request, res: Response) {
  const { farmerId, amount, advanceDate, notes } = req.body;
  if (!farmerId || !amount || !advanceDate) throw new AppError(400, 'farmerId, amount, advanceDate required');
  const advance = await prisma.farmerAdvance.create({
    data: { farmerId: Number(farmerId), amount, advanceDate: new Date(advanceDate), notes },
  });
  res.status(201).json(advance);
}

// ── Delete an advance ─────────────────────────────────────────
export async function deleteAdvance(req: Request, res: Response) {
  await prisma.farmerAdvance.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: 'Advance deleted' });
}

// ── Bulk approve payments ─────────────────────────────────────
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
      collections: { where: { collectedAt: { gte: monthStart, lt: monthEnd } }, select: { litres: true } },
      advances:    { where: { advanceDate:  { gte: monthStart, lt: monthEnd } }, select: { amount: true } },
    },
  });

  let processed = 0;
  for (const farmer of farmers) {
    const totalLitres = farmer.collections.reduce((s, c) => s + Number(c.litres), 0);
    if (totalLitres === 0) continue;
    const grossPay = totalLitres * Number(farmer.pricePerLitre);
    const totalAdv = farmer.advances.reduce((s, a) => s + Number(a.amount), 0);
    const netPay   = grossPay - totalAdv;
    await prisma.farmerPayment.upsert({
      where: { farmerId_periodMonth_periodYear_isMidMonth: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: Boolean(isMidMonth) } },
      update: { grossPay, totalAdvances: totalAdv, totalDeductions: 0, netPay, status: 'APPROVED' },
      create: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: Boolean(isMidMonth), grossPay, totalAdvances: totalAdv, totalDeductions: 0, netPay, status: 'APPROVED' },
    });
    processed++;
  }
  res.json({ message: `${processed} payments approved` });
}

// ── Get routes for filter ─────────────────────────────────────
export async function getRouteSummary(_req: Request, res: Response) {
  const routes = await prisma.route.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { farmers: { where: { isActive: true } } } } },
  });
  res.json(routes);
}
