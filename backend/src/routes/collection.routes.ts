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
  const { farmerCode, farmerId, month, year, isMidMonth } = req.query;
  const m = Number(month); const y = Number(year);
  const mid = isMidMonth === 'true';

  const searchStr = String(farmerCode || '').trim();

  const farmer = await prisma.farmer.findFirst({
    where: {
      OR: [
        ...(farmerId ? [{ id: Number(farmerId) }] : []),
        ...(searchStr ? [
          { code: searchStr.toUpperCase() },
          { code: { contains: searchStr.toUpperCase() } },
          { name: { contains: searchStr, mode: 'insensitive' as const } },
        ] : []),
      ]
    },
    include: { route: { select: { name: true } } },
  });
  if (!farmer) return res.status(404).json({
    error: `Farmer not found: "${searchStr}". Try syncing the mobile app to download the latest farmer list.`,
  });

  // ── Determine correct date range based on farmer type and period ─────────────
  // Mid-month request:  always 1–15 (regardless of farmer type)
  // End-month request + paidOn15th farmer:  16–end (they were already paid 1–15)
  // End-month request + NOT paidOn15th farmer: full 1–end
  const midStart  = new Date(y, m - 1, 1);
  const midEnd    = new Date(y, m - 1, 16);   // exclusive
  const endStart  = new Date(y, m - 1, 16);
  const fullEnd   = new Date(y, m, 1);

  let collStart: Date, collEnd: Date, advStart: Date, advEnd: Date;
  let periodLabel: string;
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  if (mid) {
    collStart = midStart; collEnd = midEnd;
    advStart  = midStart; advEnd  = midEnd;
    periodLabel = `Mid Month (1–15 ${MONTH_NAMES[m-1]} ${y})`;
  } else if (farmer.paidOn15th) {
    // Already paid 1–15 → end month is only 16–end
    collStart = endStart; collEnd = fullEnd;
    advStart  = endStart; advEnd  = fullEnd;
    periodLabel = `End Month (16–${new Date(y, m, 0).getDate()} ${MONTH_NAMES[m-1]} ${y})`;
  } else {
    // Full month payer → full 1–end
    collStart = midStart; collEnd = fullEnd;
    advStart  = midStart; advEnd  = fullEnd;
    periodLabel = `Full Month (${MONTH_NAMES[m-1]} ${y})`;
  }

  const [collections, advances, deductions] = await Promise.all([
    prisma.milkCollection.findMany({
      where: { farmerId: farmer.id, collectedAt: { gte: collStart, lt: collEnd } },
      orderBy: { collectedAt: 'asc' },
    }),
    prisma.farmerAdvance.findMany({
      where: { farmerId: farmer.id, advanceDate: { gte: advStart, lt: advEnd } },
      orderBy: { advanceDate: 'asc' },
    }),
    prisma.farmerDeduction.findMany({
      where: { farmerId: farmer.id, periodMonth: m, periodYear: y },
    }),
  ]);

  // Daily litres — sum per day
  const dailyLitres: Record<number, number> = {};
  let totalLitres = 0;
  for (const c of collections) {
    const day = new Date(c.collectedAt).getDate();
    dailyLitres[day] = (dailyLitres[day] || 0) + Number(c.litres);
    totalLitres += Number(c.litres);
  }

  const grossPay = totalLitres * Number(farmer.pricePerLitre);

  // ── Advances — each one listed individually, correct ordinal suffix ────────────
  function ordinal(n: number): string {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const advancesOrdered: { day: number; label: string; amount: number }[] = [];
  let totalAdvances = 0;
  for (const a of advances) {
    const day = new Date(a.advanceDate).getDate();
    const label = `Advance — ${ordinal(day)} ${MONTH_SHORT[m-1]}`;
    advancesOrdered.push({ day, label, amount: Number(a.amount) });
    totalAdvances += Number(a.amount);
  }

  // ── B/f Rules (deducted ONCE only) ────────────────────────────────────────────
  // Rule 1: Mid-month (isMid=true):  b/f from previous end-month negative
  // Rule 2: End-month paidOn15th:    b/f = same-month mid-month negative ONLY
  //         (b/f was already taken at mid-month → NEVER add again at end-month)
  // Rule 3: Full-month (paidOn15th=false): b/f from previous end-month negative
  // Rule 4: Office b/f correction (FarmerDeduction with 'B/f') always overrides Rules 1-3
  // IMPORTANT: For end-month of paidOn15th farmers — b/f is ZERO unless mid was negative

  const prevEndMonth = m === 1 ? 12 : m - 1;
  const prevEndYear  = m === 1 ? y - 1 : y;

  let bfBalance = 0;

  if (mid) {
    // Mid-month: check office correction first, then prev end-month negative
    const [bfCorr, prevNeg] = await Promise.all([
      prisma.farmerDeduction.findFirst({
        where: { farmerId: farmer.id, periodMonth: m, periodYear: y, reason: { contains: 'B/f' } },
        orderBy: { deductionDate: 'desc' },
      }),
      prisma.farmerPayment.findFirst({
        where: { farmerId: farmer.id, periodMonth: prevEndMonth, periodYear: prevEndYear, isMidMonth: false, netPay: { lt: 0 }, status: 'PAID' },
      }),
    ]);
    if (bfCorr) bfBalance = Number(bfCorr.amount);
    else if (prevNeg) bfBalance = Math.abs(Number(prevNeg.netPay));

  } else if (farmer.paidOn15th) {
    // End-month for paidOn15th: b/f ONLY if mid-month was negative (missed payment)
    // If mid was paid normally → b/f = 0 (already deducted at mid)
    const midPayment = await prisma.farmerPayment.findFirst({
      where: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: true },
      select: { netPay: true },
    });
    if (!midPayment) {
      // Never paid mid → treat as full month, include b/f
      const [bfCorr, prevNeg] = await Promise.all([
        prisma.farmerDeduction.findFirst({
          where: { farmerId: farmer.id, periodMonth: m, periodYear: y, reason: { contains: 'B/f' } },
          orderBy: { deductionDate: 'desc' },
        }),
        prisma.farmerPayment.findFirst({
          where: { farmerId: farmer.id, periodMonth: prevEndMonth, periodYear: prevEndYear, isMidMonth: false, netPay: { lt: 0 }, status: 'PAID' },
        }),
      ]);
      if (bfCorr) bfBalance = Number(bfCorr.amount);
      else if (prevNeg) bfBalance = Math.abs(Number(prevNeg.netPay));
    } else if (Number(midPayment.netPay) < 0) {
      // Mid was negative → carry that forward as b/f
      bfBalance = Math.abs(Number(midPayment.netPay));
    }
    // else: mid was positive → b/f = 0, already deducted ✓

  } else {
    // Full-month farmer: check office correction first, then prev end-month negative
    const [bfCorr, prevNeg] = await Promise.all([
      prisma.farmerDeduction.findFirst({
        where: { farmerId: farmer.id, periodMonth: m, periodYear: y, reason: { contains: 'B/f' } },
        orderBy: { deductionDate: 'desc' },
      }),
      prisma.farmerPayment.findFirst({
        where: { farmerId: farmer.id, periodMonth: prevEndMonth, periodYear: prevEndYear, isMidMonth: false, netPay: { lt: 0 }, status: 'PAID' },
      }),
    ]);
    if (bfCorr) bfBalance = Number(bfCorr.amount);
    else if (prevNeg) bfBalance = Math.abs(Number(prevNeg.netPay));
  }

  // ── Other deductions (AI charges, water, etc.) — EXCLUDE b/f entries ──────────
  // Also exclude any FarmerDeduction entries whose reason mentions "advance" to avoid
  // double-counting with the FarmerAdvance records above
  const otherDeductionsList = deductions.filter(d => {
    const r = d.reason.toLowerCase();
    return !r.includes('b/f') && !r.includes('advance');
  });
  const otherDeductions = otherDeductionsList.reduce((s, d) => s + Number(d.amount), 0);

  // ── Build clean ordered deductions list for display ───────────────────────────
  // Order: 1) B/f  2) Advances (from FarmerAdvance, each individually)  3) Other charges
  const seen = new Set<string>(); // deduplicate by label+amount
  const deductionsList: { label: string; amount: number }[] = [];

  // 1. B/f
  if (bfBalance > 0) {
    const key = `bf:${bfBalance}`;
    if (!seen.has(key)) { seen.add(key); deductionsList.push({ label: 'Balance b/f', amount: bfBalance }); }
  }
  // 2. Advances from FarmerAdvance table (authoritative source)
  for (const adv of advancesOrdered) {
    const key = `adv:${adv.day}:${adv.amount}`;
    if (!seen.has(key)) { seen.add(key); deductionsList.push({ label: adv.label, amount: adv.amount }); }
  }
  // 3. Other charges from FarmerDeduction table (no b/f, no advances)
  for (const d of otherDeductionsList) {
    const key = `ded:${d.reason}:${d.amount}`;
    if (!seen.has(key)) { seen.add(key); deductionsList.push({ label: d.reason, amount: Number(d.amount) }); }
  }

  const totalDeductions = totalAdvances + bfBalance + otherDeductions;
  const netPay = grossPay - totalDeductions;

  res.json({
    farmer: { ...farmer, route: farmer.route },
    daysInMonth: new Date(y, m, 0).getDate(),
    isMidMonth: mid,
    paidOn15th: farmer.paidOn15th,
    period: periodLabel,
    collectionRange: { startDay: collStart.getDate(), endDay: new Date(y, m - 1, collEnd.getDate() - 1).getDate() },
    dailyLitres,
    totalLitres,
    grossPay,
    advances: advancesOrdered,
    deductionsList,
    totalAdvances,
    bfBalance,
    otherDeductions,
    totalDeductions,
    netPay,
    month: m,
    year: y,
  });
});

// PUT /api/collections/correct-by-farmer — REPLACE all records for farmer+date with exact value
router.put('/correct-by-farmer', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerCode, collectedAt, litres } = req.body;
  if (!farmerCode || !collectedAt || !litres) return res.status(400).json({ error: 'farmerCode, collectedAt and litres are required' });

  const farmer = await prisma.farmer.findFirst({
    where: {
      OR: [
        { code: farmerCode.toUpperCase() },
        { name: { contains: farmerCode, mode: 'insensitive' } },
      ]
    },
    include: { route: { select: { id: true, supervisorId: true } } },
  });
  if (!farmer) return res.status(404).json({ error: `Farmer "${farmerCode}" not found` });

  const dayStart = new Date(collectedAt); dayStart.setHours(0,0,0,0);
  const dayEnd   = new Date(collectedAt); dayEnd.setHours(23,59,59,999);

  // Get current total before correction
  const existing = await prisma.milkCollection.findMany({
    where: { farmerId: farmer.id, collectedAt: { gte: dayStart, lte: dayEnd } },
  });
  const previousTotal = existing.reduce((s, r) => s + Number(r.litres), 0);

  // DELETE all records for this farmer on this day
  await prisma.milkCollection.deleteMany({
    where: { farmerId: farmer.id, collectedAt: { gte: dayStart, lte: dayEnd } },
  });

  // Get graderId from route
  let gId = farmer.route?.supervisorId;
  if (!gId) {
    const route = await prisma.route.findUnique({ where: { id: farmer.routeId }, select: { supervisorId: true } });
    gId = route?.supervisorId;
  }
  if (!gId) return res.status(400).json({ error: 'No grader assigned to this route' });

  // CREATE single clean record with correct litres
  const corrected = await prisma.milkCollection.create({
    data: {
      farmerId:    farmer.id,
      routeId:     farmer.routeId,
      graderId:    Number(gId),
      litres:      Number(litres),
      collectedAt: new Date(collectedAt + 'T08:00:00'),
      synced:      true,
    },
    include: { farmer: { select: { code: true, name: true } }, route: { select: { name: true } } },
  });

  res.json({ ...corrected, previousTotal, corrected: true, deletedCount: existing.length });
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

// POST /api/collections/manual — UPSERT: replaces any existing record for that farmer+day
router.post('/manual', authorize('ADMIN', 'OFFICE'), async (req: any, res) => {
  const { farmerCode, routeId, litres, collectedAt } = req.body;
  if (!farmerCode || !litres) return res.status(400).json({ error: 'farmerCode and litres are required' });

  const farmer = await prisma.farmer.findFirst({
    where: {
      OR: [
        { code: farmerCode.toUpperCase() },
        { name: { contains: farmerCode, mode: 'insensitive' } },
      ]
    },
    include: { route: { select: { id: true, supervisorId: true } } },
  });
  if (!farmer) return res.status(404).json({ error: `Farmer "${farmerCode}" not found` });

  const rId = routeId ? Number(routeId) : farmer.routeId;
  let gId = farmer.route?.supervisorId;
  if (!gId) {
    const route = await prisma.route.findUnique({ where: { id: rId }, select: { supervisorId: true } });
    gId = route?.supervisorId;
  }
  if (!gId) gId = req.user?.sub || req.user?.id;
  if (!gId) return res.status(400).json({ error: 'No grader assigned to this route. Assign a grader first.' });

  const collectedAtDate = collectedAt ? new Date(collectedAt + 'T08:00:00') : new Date();
  const dayStart = new Date(collectedAtDate); dayStart.setHours(0,0,0,0);
  const dayEnd   = new Date(collectedAtDate); dayEnd.setHours(23,59,59,999);

  // DELETE all existing records for this farmer on this day (prevents duplicates)
  const existing = await prisma.milkCollection.findMany({
    where: { farmerId: farmer.id, collectedAt: { gte: dayStart, lte: dayEnd } },
  });
  if (existing.length > 0) {
    await prisma.milkCollection.deleteMany({
      where: { farmerId: farmer.id, collectedAt: { gte: dayStart, lte: dayEnd } },
    });
  }

  // CREATE single clean record
  const collection = await prisma.milkCollection.create({
    data: {
      farmerId:    farmer.id,
      routeId:     rId,
      graderId:    Number(gId),
      litres:      Number(litres),
      collectedAt: collectedAtDate,
      synced:      true,
    },
    include: { farmer: { select: { code: true, name: true } }, route: { select: { name: true } } },
  });
  res.status(201).json({ ...collection, replaced: existing.length > 0, previousCount: existing.length });
});

// POST /api/collections/advance/correct — ADD to advance or SET b/f
router.post('/advance/correct', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerId, farmerCode, amount, notes, advanceDate, mode } = req.body;
  // mode: 'add' = add to existing | 'replace' = replace | 'bf' = b/f correction
  let fId = farmerId;
  if (!fId && farmerCode) {
    const farmer = await prisma.farmer.findFirst({
      where: {
        OR: [
          { code: farmerCode.toUpperCase() },
          { name: { contains: farmerCode, mode: 'insensitive' } },
        ]
      }
    });
    if (!farmer) return res.status(404).json({ error: `Farmer "${farmerCode}" not found` });
    fId = farmer.id;
  }
  if (!fId) return res.status(400).json({ error: 'Farmer code or name required' });

  const isBf = mode === 'bf' || notes?.toLowerCase().includes('b/f');
  const isReplace = mode === 'replace';
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();

  if (isBf) {
    // B/f: always replace (set the exact amount)
    await prisma.farmerDeduction.deleteMany({
      where: { farmerId: Number(fId), periodMonth: m, periodYear: y, reason: { contains: 'B/f' } },
    });
    const result = await prisma.farmerDeduction.create({
      data: { farmerId: Number(fId), amount: Number(amount), reason: notes || 'B/f correction', deductionDate: now, periodMonth: m, periodYear: y },
      include: { farmer: { select: { code: true, name: true } } },
    });
    return res.status(201).json({ ...result, type: 'bf_correction', replaced: true });
  }

  // Advance: check existing total for this date
  const advDay = advanceDate ? new Date(advanceDate) : now;
  const dayStart = new Date(advDay); dayStart.setHours(0,0,0,0);
  const dayEnd   = new Date(advDay); dayEnd.setHours(23,59,59,999);

  const existingAdvances = await prisma.farmerAdvance.findMany({
    where: { farmerId: Number(fId), advanceDate: { gte: dayStart, lte: dayEnd } },
  });
  const existingTotal = existingAdvances.reduce((s, a) => s + Number(a.amount), 0);

  if (isReplace) {
    // Delete existing for this day and set fresh
    await prisma.farmerAdvance.deleteMany({ where: { farmerId: Number(fId), advanceDate: { gte: dayStart, lte: dayEnd } } });
    const result = await prisma.farmerAdvance.create({
      data: { farmerId: Number(fId), amount: Number(amount), advanceDate: advDay, notes: notes || 'Office correction (replaced)' },
      include: { farmer: { select: { code: true, name: true } } },
    });
    return res.status(201).json({ ...result, type: 'advance', previousTotal: existingTotal, newTotal: Number(amount), breakdown: `${Number(amount)} (replaced ${existingTotal})` });
  } else {
    // ADD to existing
    const result = await prisma.farmerAdvance.create({
      data: { farmerId: Number(fId), amount: Number(amount), advanceDate: advDay, notes: notes || `Added to existing ${existingTotal}` },
      include: { farmer: { select: { code: true, name: true } } },
    });
    const newTotal = existingTotal + Number(amount);
    return res.status(201).json({ ...result, type: 'advance', previousTotal: existingTotal, added: Number(amount), newTotal, breakdown: `${existingTotal} + ${Number(amount)} = ${newTotal}` });
  }
});

// GET /api/collections/deductions — list deductions
router.get('/deductions', async (req, res) => {
  const { month, year, routeId } = req.query;
  const m = Number(month); const y = Number(year);
  const where: any = { periodMonth: m, periodYear: y };
  if (routeId) where.farmer = { routeId: Number(routeId) };
  const deductions = await prisma.farmerDeduction.findMany({
    where,
    include: { farmer: { include: { route: { select: { name: true } } } } },
    orderBy: { deductionDate: 'desc' },
  });
  res.json(deductions);
});
