import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// ─── Date helpers ────────────────────────────────────────────────────────────
// PAYMENT RULES:
// paidOn15th=true  + isMidMonth=true  → litres 1-15,  advances 5+10,  b/f from prev end-month, other deductions
// paidOn15th=true  + isMidMonth=false → litres 16-end, advances 20+25, NO b/f (already deducted mid), other deductions
//   EXCEPTION: if farmer had negative mid-month (wasn't paid), treat as full-month at end-month
// paidOn15th=false + isMidMonth=false → litres 1-end,  all advances,   b/f from prev end-month, other deductions

function getDateRanges(month: number, year: number) {
  return {
    midStart:  new Date(year, month - 1, 1),
    midEnd:    new Date(year, month - 1, 16),  // exclusive → days 1-15
    endStart:  new Date(year, month - 1, 16),
    fullEnd:   new Date(year, month, 1),        // exclusive → full month
  };
}

// Legacy helper kept for backward compat
function periodDates(month: number, year: number, isMidMonth: boolean) {
  if (isMidMonth) return { start: new Date(year, month - 1, 1), end: new Date(year, month - 1, 16) };
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

async function computeFarmerPayment(farmerId: number, month: number, year: number, isMidMonth: boolean) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    include: { route: { select: { id: true, name: true, code: true } } },
  });
  if (!farmer) return null;

  const { midStart, midEnd, endStart, fullEnd } = getDateRanges(month, year);

  // Check if this paidOn15th farmer had a negative mid-month (treat as full-month at end)
  let treatAsFull = false;
  if (!isMidMonth && farmer.paidOn15th) {
    const midPayment = await prisma.farmerPayment.findFirst({
      where: { farmerId, periodMonth: month, periodYear: year, isMidMonth: true },
      select: { netPay: true, id: true },
    });
    // No mid-month record OR negative mid-month → treat as full-month
    if (!midPayment || Number(midPayment.netPay) <= 0) treatAsFull = true;
  }

  // ── Collection date range ───────────────────────────────────────────────────
  let collStart: Date, collEnd: Date;
  if (isMidMonth) {
    // Mid-month: always 1-15
    collStart = midStart; collEnd = midEnd;
  } else if (farmer.paidOn15th && !treatAsFull) {
    // Normal end-month for paidOn15th: 16-end
    collStart = endStart; collEnd = fullEnd;
  } else {
    // Full month: either paidOn15th=false OR paidOn15th with missed/negative mid
    collStart = midStart; collEnd = fullEnd;
  }

  // ── Advance date range ──────────────────────────────────────────────────────
  let advStart: Date, advEnd: Date;
  if (isMidMonth) {
    advStart = midStart; advEnd = midEnd;     // 5th + 10th advances
  } else if (farmer.paidOn15th && !treatAsFull) {
    advStart = endStart; advEnd = fullEnd;    // 20th + 25th advances only
  } else {
    advStart = midStart; advEnd = fullEnd;    // all advances
  }

  // ── B/f rule: ONLY deducted at mid-month (or full-month-only farmers) ───────
  // NEVER deduct b/f at end-month for paidOn15th farmers (already taken mid)
  let bfBalance = 0;
  const includeBf = isMidMonth || !farmer.paidOn15th || treatAsFull;
  if (includeBf) {
    const prevEndMonth = month === 1 ? 12 : month - 1;
    const prevEndYear  = month === 1 ? year - 1 : year;
    // Check office b/f correction first
    const bfDeduction = await prisma.farmerDeduction.findFirst({
      where: { farmerId, periodMonth: month, periodYear: year, reason: { contains: 'B/f' } },
      orderBy: { deductionDate: 'desc' },
    });
    if (bfDeduction) {
      bfBalance = Number(bfDeduction.amount);
    } else {
      // Previous end-month negative
      const prevNeg = await prisma.farmerPayment.findFirst({
        where: { farmerId, periodMonth: prevEndMonth, periodYear: prevEndYear, isMidMonth: false, netPay: { lt: 0 }, status: 'PAID' },
      });
      if (prevNeg) bfBalance = Math.abs(Number(prevNeg.netPay));
    }
  }

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const [collAgg, advAgg, dedAgg] = await Promise.all([
    prisma.milkCollection.aggregate({ where: { farmerId, collectedAt: { gte: collStart, lt: collEnd } }, _sum: { litres: true } }),
    prisma.farmerAdvance.aggregate({ where: { farmerId, advanceDate: { gte: advStart, lt: advEnd } }, _sum: { amount: true } }),
    prisma.farmerDeduction.aggregate({ where: { farmerId, periodMonth: month, periodYear: year, reason: { not: { contains: 'B/f' } } }, _sum: { amount: true } }),
  ]);

  const totalLitres    = Number(collAgg._sum.litres || 0);
  const grossPay       = totalLitres * Number(farmer.pricePerLitre);
  const totalAdvances  = Number(advAgg._sum.amount || 0);
  const otherDed       = Number(dedAgg._sum.amount || 0); // AI charges etc.
  const totalDeductions = totalAdvances + bfBalance + otherDed;
  const netPay          = grossPay - totalDeductions;

  return {
    farmer: {
      id: farmer.id, code: farmer.code, name: farmer.name,
      phone: farmer.phone, mpesaPhone: farmer.mpesaPhone,
      paymentMethod: farmer.paymentMethod, pricePerLitre: Number(farmer.pricePerLitre),
      bankName: farmer.bankName, bankAccount: farmer.bankAccount,
      paidOn15th: farmer.paidOn15th, route: farmer.route,
    },
    totalLitres, grossPay, totalAdvances, otherDeductions: otherDed,
    bfBalance, totalDeductions, carriedForward: bfBalance,
    netPay, treatAsFull,
    periodLabel: isMidMonth ? '1–15' : (farmer.paidOn15th && !treatAsFull) ? '16–end' : '1–end',
  };
}

// GET /api/payments?month=3&year=2026&isMidMonth=true&routeId=5
// Returns computed payments per route
router.get('/', async (req, res) => {
  const { month, year, isMidMonth, routeId, status } = req.query;
  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year) || new Date().getFullYear();
  const mid = isMidMonth === 'true';

  // If fetching existing payment records
  if (status) {
    const where: any = { periodMonth: m, periodYear: y, isMidMonth: mid };
    if (status !== 'ALL') where.status = status;
    if (routeId) where.farmer = { routeId: Number(routeId) };

    const payments = await prisma.farmerPayment.findMany({
      where,
      include: {
        farmer: {
          include: { route: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: [{ farmer: { route: { code: 'asc' } } }, { farmer: { name: 'asc' } }],
    });

    // Compute totalLitres per farmer for this period (correct range per farmer type)
    const farmerIds = payments.map(p => p.farmerId);
    const { start, end } = periodDates(m, y, mid);
    const midStart15 = new Date(y, m - 1, 1);
    const midEnd15   = new Date(y, m - 1, 16);  // 1-15 exclusive
    const endStart16 = new Date(y, m - 1, 16);
    const fullEnd    = new Date(y, m, 1);

    // Separate farmers by their payment range
    const midFarmerIds  = payments.filter(p => mid || (!(p.farmer as any).paidOn15th)).map(p => p.farmerId);
    const endFarmerIds  = payments.filter(p => !mid && (p.farmer as any).paidOn15th).map(p => p.farmerId);

    const [midCollAgg, endCollAgg] = await Promise.all([
      midFarmerIds.length > 0 ? prisma.milkCollection.groupBy({
        by: ['farmerId'],
        where: { farmerId: { in: midFarmerIds }, collectedAt: { gte: mid ? midStart15 : midStart15, lt: mid ? midEnd15 : fullEnd } },
        _sum: { litres: true },
      }) : Promise.resolve([]),
      endFarmerIds.length > 0 ? prisma.milkCollection.groupBy({
        by: ['farmerId'],
        where: { farmerId: { in: endFarmerIds }, collectedAt: { gte: endStart16, lt: fullEnd } },
        _sum: { litres: true },
      }) : Promise.resolve([]),
    ]);

    const litresMap = new Map<number, number>();
    for (const c of [...midCollAgg, ...endCollAgg]) litresMap.set(c.farmerId, Number(c._sum.litres || 0));

    // Attach correct totalLitres and price
    const enriched = payments.map(p => ({
      ...p,
      totalLitres: litresMap.get(p.farmerId) || 0,
      pricePerLitre: Number((p.farmer as any).pricePerLitre || 0),
      carriedForward: Math.max(0, Number(p.totalDeductions) - Number(p.totalAdvances)),
    }));

    const totals = {
      count: payments.length,
      totalGross: payments.reduce((s, p) => s + Number(p.grossPay), 0),
      totalAdvances: payments.reduce((s, p) => s + Number(p.totalAdvances), 0),
      totalNet: payments.filter(p => Number(p.netPay) > 0).reduce((s, p) => s + Number(p.netPay), 0),
      paid: payments.filter(p => p.status === 'PAID').length,
      pending: payments.filter(p => p.status === 'PENDING').length,
      approved: payments.filter(p => p.status === 'APPROVED').length,
      negative: payments.filter(p => Number(p.netPay) < 0).length,
      payable: payments.filter(p => Number(p.netPay) > 0).length,
    };

    return res.json({ payments: enriched, totals });
  }

  // Fast batch preview — 4 queries total, no per-farmer loops
  const { start, end } = periodDates(m, y, mid);
  const whereRoute: any = { isActive: true };
  if (routeId) whereRoute.routeId = Number(routeId);
  if (mid) whereRoute.paidOn15th = true;

  const [farmers, collections, advances, deductions] = await Promise.all([
    prisma.farmer.findMany({ where: whereRoute, include: { route: { select: { id: true, code: true, name: true } } } }),
    prisma.milkCollection.groupBy({ by: ['farmerId'], where: { collectedAt: { gte: start, lt: end } }, _sum: { litres: true } }),
    prisma.farmerAdvance.groupBy({ by: ['farmerId'], where: { advanceDate: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.farmerDeduction.groupBy({ by: ['farmerId'], where: { periodMonth: m, periodYear: y }, _sum: { amount: true } }),
  ]);

  const collMap = new Map(collections.map(c => [c.farmerId, Number(c._sum.litres || 0)]));
  const advMap  = new Map(advances.map(a => [a.farmerId, Number(a._sum.amount || 0)]));
  const dedMap  = new Map(deductions.map(d => [d.farmerId, Number(d._sum.amount || 0)]));
  const byRoute: Record<string, any> = {};

  for (const farmer of farmers) {
    const totalLitres    = collMap.get(farmer.id) || 0;
    const totalAdvances  = Number(advMap.get(farmer.id) || 0);
    if (totalLitres === 0 && totalAdvances === 0) continue;
    const grossPay        = Number(totalLitres) * Number(farmer.pricePerLitre);
    const otherDeductions = Number(dedMap.get(farmer.id) || 0);
    const totalDeductions = totalAdvances + otherDeductions; // combined: advances + other charges
    const netPay          = grossPay - totalDeductions;
    const r = {
      farmer: { id: farmer.id, code: farmer.code, name: farmer.name, phone: farmer.phone,
        mpesaPhone: farmer.mpesaPhone, paymentMethod: farmer.paymentMethod,
        bankName: farmer.bankName, bankAccount: farmer.bankAccount,
        paidOn15th: farmer.paidOn15th, route: farmer.route },
      totalLitres, grossPay, totalAdvances, totalDeductions, carriedForward: 0, netPay,
      pricePerLitre: Number(farmer.pricePerLitre),
    };
    const key = farmer.route?.code || 'UNKNOWN';
    if (!byRoute[key]) byRoute[key] = {
      routeCode: farmer.route?.code, routeName: farmer.route?.name, routeId: farmer.route?.id,
      farmers: [], totalLitres: 0, totalGross: 0, totalAdvances: 0, totalDeductions: 0, totalNet: 0, negativeCount: 0,
    };
    byRoute[key].farmers.push(r);
    byRoute[key].totalLitres      += totalLitres;
    byRoute[key].totalGross       += grossPay;
    byRoute[key].totalAdvances    += totalAdvances;
    byRoute[key].totalDeductions  += totalDeductions;
    byRoute[key].totalNet         += netPay > 0 ? netPay : 0;
    if (netPay < 0) byRoute[key].negativeCount++;
  }

  res.json({ routes: Object.values(byRoute).sort((a: any, b: any) => (a.routeCode||'').localeCompare(b.routeCode||'')), totalFarmers: Object.values(byRoute).reduce((s: number, r: any) => s + r.farmers.length, 0) });
});

// POST /api/payments/run — generate FarmerPayment records (batch)
router.post('/run', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  try {
    const { month, year, isMidMonth, routeId } = req.body;
    const m = Number(month); const y = Number(year); const mid = !!isMidMonth;
    const { midStart, midEnd, endStart, fullEnd } = getDateRanges(m, y);

    // ── Fetch farmers ────────────────────────────────────────────────────────
    const whereRoute: any = { isActive: true };
    if (routeId) whereRoute.routeId = Number(routeId);
    if (mid) whereRoute.paidOn15th = true;

    const farmers = await prisma.farmer.findMany({
      where: whereRoute,
      select: { id: true, pricePerLitre: true, paidOn15th: true },
    });
    if (farmers.length === 0) return res.json({ created: 0, message: 'No farmers found' });
    const farmerIds = farmers.map(f => f.id);

    // ── For end-month: find paidOn15th farmers with missing/negative mid → treat as full ──
    const treatAsFullIds = new Set<number>();
    if (!mid) {
      const midPayments = await prisma.farmerPayment.findMany({
        where: { farmerId: { in: farmerIds }, periodMonth: m, periodYear: y, isMidMonth: true },
        select: { farmerId: true, netPay: true },
      });
      const midMap = new Map(midPayments.map(p => [p.farmerId, Number(p.netPay)]));
      for (const f of farmers) {
        if (f.paidOn15th) {
          const midNet = midMap.get(f.id);
          if (midNet === undefined || Number(midNet) <= 0) treatAsFullIds.add(f.id);
        }
      }
    }

    // ── Fetch all collections and advances sequentially (avoids connection pool exhaustion) ──
    // Collections
    const [midColl, endColl, fullColl] = await Promise.all([
      prisma.milkCollection.groupBy({ by: ['farmerId'], where: { farmerId: { in: farmerIds }, collectedAt: { gte: midStart, lt: midEnd } }, _sum: { litres: true } }),
      prisma.milkCollection.groupBy({ by: ['farmerId'], where: { farmerId: { in: farmerIds }, collectedAt: { gte: endStart, lt: fullEnd } }, _sum: { litres: true } }),
      prisma.milkCollection.groupBy({ by: ['farmerId'], where: { farmerId: { in: farmerIds }, collectedAt: { gte: midStart, lt: fullEnd } }, _sum: { litres: true } }),
    ]);
    const midCollMap  = new Map(midColl.map(c  => [c.farmerId, Number(c._sum.litres  || 0)]));
    const endCollMap  = new Map(endColl.map(c  => [c.farmerId, Number(c._sum.litres  || 0)]));
    const fullCollMap = new Map(fullColl.map(c => [c.farmerId, Number(c._sum.litres  || 0)]));

    // Advances
    const [midAdv, endAdv, fullAdv] = await Promise.all([
      prisma.farmerAdvance.groupBy({ by: ['farmerId'], where: { farmerId: { in: farmerIds }, advanceDate: { gte: midStart, lt: midEnd } }, _sum: { amount: true } }),
      prisma.farmerAdvance.groupBy({ by: ['farmerId'], where: { farmerId: { in: farmerIds }, advanceDate: { gte: endStart, lt: fullEnd } }, _sum: { amount: true } }),
      prisma.farmerAdvance.groupBy({ by: ['farmerId'], where: { farmerId: { in: farmerIds }, advanceDate: { gte: midStart, lt: fullEnd } }, _sum: { amount: true } }),
    ]);
    const midAdvMap  = new Map(midAdv.map(a  => [a.farmerId, Number(a._sum.amount || 0)]));
    const endAdvMap  = new Map(endAdv.map(a  => [a.farmerId, Number(a._sum.amount || 0)]));
    const fullAdvMap = new Map(fullAdv.map(a => [a.farmerId, Number(a._sum.amount || 0)]));

    // Other deductions and b/f
    const [otherDeds, bfCorrections] = await Promise.all([
      prisma.farmerDeduction.groupBy({
        by: ['farmerId'],
        where: { farmerId: { in: farmerIds }, periodMonth: m, periodYear: y, reason: { not: { contains: 'B/f' } } },
        _sum: { amount: true },
      }),
      prisma.farmerDeduction.findMany({
        where: { farmerId: { in: farmerIds }, periodMonth: m, periodYear: y, reason: { contains: 'B/f' } },
        select: { farmerId: true, amount: true },
      }),
    ]);
    const otherDedMap = new Map(otherDeds.map(d => [d.farmerId, Number(d._sum.amount || 0)]));

    // Build b/f map — ONLY for farmers who need it
    const bfMap = new Map<number, number>();
    const needsBfIds = farmers
      .filter(f => mid || !f.paidOn15th || treatAsFullIds.has(f.id))
      .map(f => f.id);

    for (const d of bfCorrections) {
      if (needsBfIds.includes(d.farmerId)) bfMap.set(d.farmerId, Number(d.amount));
    }
    // Prev end-month negatives for those without office correction
    const noCorrection = needsBfIds.filter(id => !bfMap.has(id));
    if (noCorrection.length > 0) {
      const prevEndMonth = m === 1 ? 12 : m - 1;
      const prevEndYear  = m === 1 ? y - 1 : y;
      const prevNegatives = await prisma.farmerPayment.findMany({
        where: { farmerId: { in: noCorrection }, periodMonth: prevEndMonth, periodYear: prevEndYear, isMidMonth: false, netPay: { lt: 0 }, status: 'PAID' },
        select: { farmerId: true, netPay: true },
      });
      for (const p of prevNegatives) bfMap.set(p.farmerId, Math.abs(Number(p.netPay)));
    }

    // ── Compute records ──────────────────────────────────────────────────────
    const records: any[] = [];
    for (const f of farmers) {
      const price  = Number(f.pricePerLitre) || 46;
      const isFull = !f.paidOn15th || treatAsFullIds.has(f.id);

      let litres: number, advances: number;
      if (mid) {
        litres   = Number(midCollMap.get(f.id)  || 0);
        advances = Number(midAdvMap.get(f.id)   || 0);
      } else if (isFull) {
        litres   = Number(fullCollMap.get(f.id) || 0);
        advances = Number(fullAdvMap.get(f.id)  || 0);
      } else {
        litres   = Number(endCollMap.get(f.id)  || 0);
        advances = Number(endAdvMap.get(f.id)   || 0);
      }

      if (litres === 0) continue;

      const grossPay        = litres * price;
      const otherDed        = Number(otherDedMap.get(f.id) || 0);
      const bf              = Number(bfMap.get(f.id)       || 0);
      const totalDeductions = advances + otherDed + bf;
      const netPay          = grossPay - totalDeductions;

      records.push({
        farmerId: f.id, periodMonth: m, periodYear: y, isMidMonth: mid,
        grossPay, totalAdvances: advances, totalDeductions, netPay,
      });
    }

    if (records.length === 0) return res.json({ created: 0, message: 'No collections found for this period' });

    // ── Upsert in batches of 50 (smaller = more stable on free DB) ───────────
    let created = 0;
    const BATCH = 50;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      await Promise.all(batch.map(r => prisma.farmerPayment.upsert({
        where: { farmerId_periodMonth_periodYear_isMidMonth: { farmerId: r.farmerId, periodMonth: r.periodMonth, periodYear: r.periodYear, isMidMonth: r.isMidMonth } },
        update: { grossPay: r.grossPay, totalAdvances: r.totalAdvances, totalDeductions: r.totalDeductions, netPay: r.netPay, status: 'PENDING' },
        create: r,
      })));
      created += batch.length;
    }
    res.json({ created, message: `Generated ${created} payment records` });

  } catch (err: any) {
    process.stderr.write('/run error: ' + (err?.message || String(err)) + '\n');
    res.status(500).json({ error: err?.message || 'Failed to generate payments', detail: String(err) });
  }
});

router.post('/approve', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, isMidMonth, routeId, farmerIds } = req.body;
  const m = Number(month); const y = Number(year); const mid = !!isMidMonth;

  const where: any = { periodMonth: m, periodYear: y, isMidMonth: mid, status: 'PENDING', netPay: { gt: 0 } };
  if (routeId) where.farmer = { routeId: Number(routeId) };
  if (farmerIds?.length) where.farmerId = { in: farmerIds };

  const result = await prisma.farmerPayment.updateMany({ where, data: { status: 'APPROVED' } });
  res.json({ approved: result.count });
});

// POST /api/payments/mark-paid — mark as paid after disbursement
router.post('/mark-paid', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { paymentIds, kopokopoRef } = req.body;
  const result = await prisma.farmerPayment.updateMany({
    where: { id: { in: paymentIds } },
    data: { status: 'PAID', paidAt: new Date(), kopokopoRef: kopokopoRef || null },
  });
  res.json({ paid: result.count });
});

// POST /api/payments/advance — record an advance
router.post('/advance', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerId, farmerCode, amount, notes, date } = req.body;
  let fId = farmerId;
  if (!fId && farmerCode) {
    const farmer = await prisma.farmer.findFirst({ where: { code: farmerCode.toUpperCase() } });
    if (!farmer) throw new AppError(404, `Farmer ${farmerCode} not found`);
    fId = farmer.id;
  }
  const advance = await prisma.farmerAdvance.create({
    data: { farmerId: Number(fId), amount: Number(amount), advanceDate: date ? new Date(date) : new Date(), notes: notes || null },
    include: { farmer: { select: { code: true, name: true } } },
  });
  res.status(201).json(advance);
});

// DELETE /api/payments/advance/:id
router.delete('/advance/:id', authorize('ADMIN'), async (req, res) => {
  await prisma.farmerAdvance.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true });
});

// GET /api/payments/advances?farmerId=&month=&year=
router.get('/advances', async (req, res) => {
  const { farmerId, month, year, routeId } = req.query;
  const where: any = {};
  if (farmerId) where.farmerId = Number(farmerId);
  if (month && year) {
    const m = Number(month); const y = Number(year);
    where.advanceDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (routeId) where.farmer = { routeId: Number(routeId) };

  const advances = await prisma.farmerAdvance.findMany({
    where,
    include: { farmer: { include: { route: { select: { name: true } } } } },
    orderBy: { advanceDate: 'desc' },
  });
  res.json(advances);
});

// GET /api/payments/kopokopo-export — KopoKopo disbursement file
router.get('/kopokopo-export', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, isMidMonth, routeId } = req.query;
  const m = Number(month); const y = Number(year); const mid = isMidMonth === 'true';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const where: any = { periodMonth: m, periodYear: y, isMidMonth: mid, status: 'APPROVED' };
  if (routeId) where.farmer = { routeId: Number(routeId) };

  const payments = await prisma.farmerPayment.findMany({
    where,
    include: { farmer: { include: { route: { select: { name: true } } } } },
  });

  // KopoKopo format: first_name, last_name, phone (254...), amount, narration
  const mpesaPayments = payments.filter(p => {
    const f = p.farmer;
    return f.paymentMethod === 'MPESA' && Number(p.netPay) > 0;
  });

  const narration = mid ? `Mid Month ${MONTHS[m-1]} ${y}` : `End Month ${MONTHS[m-1]} ${y}`;

  const header = 'first_name,last_name,phone_number,amount,narration';
  const rows = mpesaPayments.map(p => {
    const f = p.farmer;
    const nameParts = f.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1, 3).join(' ') || firstName;
    const phone = (f.mpesaPhone || f.phone || '').replace(/^\+/, '').replace(/^0/, '254');
    return `"${firstName}","${lastName}","${phone}",${Number(p.netPay).toFixed(2)},"${narration}"`;
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="kopokopo-${mid ? 'mid' : 'end'}-${MONTHS[m-1]}-${y}.csv"`);
  res.send(`${header}\n${rows}`);
});

// GET /api/payments/bank-export — Bank transfer list
router.get('/bank-export', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, isMidMonth, routeId } = req.query;
  const m = Number(month); const y = Number(year); const mid = isMidMonth === 'true';
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const where: any = { periodMonth: m, periodYear: y, isMidMonth: mid, status: 'APPROVED' };
  if (routeId) where.farmer = { routeId: Number(routeId) };

  const payments = await prisma.farmerPayment.findMany({
    where,
    include: { farmer: { include: { route: { select: { name: true } } } } },
  });

  const bankPayments = payments.filter(p => p.farmer.paymentMethod === 'BANK' && Number(p.netPay) > 0);
  const narration = mid ? `Mid Month ${MONTHS[m-1]} ${y}` : `End Month ${MONTHS[m-1]} ${y}`;

  const header = 'Farmer Name,Bank Name,Account Number,Amount,Narration,Route';
  const rows = bankPayments.map(p => {
    const f = p.farmer;
    return `"${f.name}","${f.bankName || ''}","${f.bankAccount || ''}",${Number(p.netPay).toFixed(2)},"${narration}","${f.route?.name || ''}"`;
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="bank-${mid ? 'mid' : 'end'}-${MONTHS[m-1]}-${y}.csv"`);
  res.send(`${header}\n${rows}`);
});

// GET /api/payments/routes — routes list for filter
router.get('/routes', async (_req, res) => {
  const routes = await prisma.route.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } });
  res.json(routes);
});

// GET /api/payments/summary — summary for dashboard
router.get('/summary', async (req, res) => {
  const { month, year } = req.query;
  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year) || new Date().getFullYear();

  const [midPayments, endPayments, advances] = await Promise.all([
    prisma.farmerPayment.findMany({ where: { periodMonth: m, periodYear: y, isMidMonth: true } }),
    prisma.farmerPayment.findMany({ where: { periodMonth: m, periodYear: y, isMidMonth: false } }),
    prisma.farmerAdvance.findMany({ where: { advanceDate: { gte: new Date(y, m-1, 1), lt: new Date(y, m, 1) } } }),
  ]);

  res.json({
    mid: {
      count: midPayments.length,
      totalNet: midPayments.filter(p => Number(p.netPay) > 0).reduce((s, p) => s + Number(p.netPay), 0),
      paid: midPayments.filter(p => p.status === 'PAID').length,
      pending: midPayments.filter(p => p.status === 'PENDING').length,
      negative: midPayments.filter(p => Number(p.netPay) < 0).length,
      payable: midPayments.filter(p => Number(p.netPay) > 0).length,
    },
    end: {
      count: endPayments.length,
      totalNet: endPayments.filter(p => Number(p.netPay) > 0).reduce((s, p) => s + Number(p.netPay), 0),
      paid: endPayments.filter(p => p.status === 'PAID').length,
      pending: endPayments.filter(p => p.status === 'PENDING').length,
      negative: endPayments.filter(p => Number(p.netPay) < 0).length,
      payable: endPayments.filter(p => Number(p.netPay) > 0).length,
    },
    advances: {
      count: advances.length,
      total: advances.reduce((s, a) => s + Number(a.amount), 0),
    },
  });
});

export default router;

// POST /api/payments/disburse — send money via KopoKopo
router.post('/disburse', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, isMidMonth, routeId } = req.body;
  const m = Number(month); const y = Number(year); const mid = !!isMidMonth;
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  try {
    const { disburseBatch } = await import('../services/kopokopo.service');

    const where: any = { periodMonth: m, periodYear: y, isMidMonth: mid, status: 'APPROVED', netPay: { gt: 0 } };
    if (routeId) where.farmer = { routeId: Number(routeId) };

    const payments = await prisma.farmerPayment.findMany({
      where,
      include: { farmer: true },
    });

    if (payments.length === 0) {
      return res.status(400).json({ error: 'No approved payments found. Approve payments first.' });
    }

    const mpesaPayments = payments.filter(p => p.farmer.paymentMethod === 'MPESA');
    const narration = mid ? `Mid Month ${MONTHS[m-1]} ${y}` : `End Month ${MONTHS[m-1]} ${y}`;

    const recipients = mpesaPayments.map(p => {
      const f = p.farmer;
      const nameParts = f.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1, 3).join(' ') || firstName;
      const phone = (f.mpesaPhone || f.phone || '').replace(/^\+/, '').replace(/^0/, '254');
      return { firstName, lastName, phone, amount: Number(p.netPay), narration, paymentId: p.id };
    });

    const result = await disburseBatch(recipients, narration);

    // Mark successful ones as PAID
    const successPhones = new Set(result.successful.map(s => s.phone));
    const paidIds = recipients
      .filter(r => successPhones.has(r.phone))
      .map(r => r.paymentId);

    if (paidIds.length > 0) {
      await prisma.farmerPayment.updateMany({
        where: { id: { in: paidIds } },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }

    res.json({
      total: recipients.length,
      successful: result.successful.length,
      failed: result.failed.length,
      failedDetails: result.failed,
      bankPayments: payments.length - mpesaPayments.length,
      message: `Disbursed ${result.successful.length}/${recipients.length} M-Pesa payments. ${payments.length - mpesaPayments.length} bank payments need manual processing.`,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Disbursement failed' });
  }
});

// GET /api/payments/kopokopo-balance
router.get('/kopokopo-balance', authorize('ADMIN', 'OFFICE'), async (_req, res) => {
  try {
    const { getBalance } = await import('../services/kopokopo.service');
    const balance = await getBalance();
    res.json(balance || { amount: 0, currency: 'KES', error: 'Could not fetch balance' });
  } catch (e: any) {
    res.json({ amount: 0, currency: 'KES', error: e.message });
  }
});

// POST /api/payments/kopokopo-config — save KopoKopo credentials to env
router.post('/kopokopo-config', authorize('ADMIN'), async (req: any, res) => {
  const { clientId, clientSecret, tillIdentifier, env } = req.body;
  // In production these would be written to Railway environment variables via the Railway API
  // For now store in DB config table or return instructions
  res.json({
    message: 'To connect your live KopoKopo account, set these Railway environment variables:',
    vars: {
      KOPOKOPO_CLIENT_ID: clientId || '(enter your client ID)',
      KOPOKOPO_CLIENT_SECRET: clientSecret ? '(secret received)' : '(enter your secret)',
      KOPOKOPO_TILL_IDENTIFIER: tillIdentifier || '(enter your till)',
      KOPOKOPO_ENV: env || 'production',
    },
    instructions: [
      '1. Go to railway.app → your project → Variables',
      '2. Add each variable above with your actual values',
      '3. Redeploy the service',
      '4. Come back and test with a small payment first',
    ],
  });
});
