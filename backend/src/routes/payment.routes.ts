import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// ─── Compute payment for a period ────────────────────────────────────────────
function periodDates(month: number, year: number, isMidMonth: boolean) {
  if (isMidMonth) {
    return { start: new Date(year, month - 1, 1), end: new Date(year, month - 1, 16) };
  }
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

async function computeFarmerPayment(farmerId: number, month: number, year: number, isMidMonth: boolean) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    include: { route: { select: { id: true, name: true, code: true } } },
  });
  if (!farmer) return null;

  const { start, end } = periodDates(month, year, isMidMonth);

  // Collections for the period
  const collAgg = await prisma.milkCollection.aggregate({
    where: { farmerId, collectedAt: { gte: start, lt: end } },
    _sum: { litres: true },
  });
  const totalLitres = Number(collAgg._sum.litres || 0);
  const grossPay = totalLitres * Number(farmer.pricePerLitre);

  // Advances for the period
  const advAgg = await prisma.farmerAdvance.aggregate({
    where: { farmerId, advanceDate: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const totalAdvances = Number(advAgg._sum.amount || 0);

  // Deductions (liquid variance charges etc.)
  const dedAgg = await prisma.farmerDeduction.aggregate({
    where: { farmerId, periodMonth: month, periodYear: year },
    _sum: { amount: true },
  });
  const totalDeductions = Number(dedAgg._sum.amount || 0);

  // Previous negative balance (carried forward)
  const prevPayment = await prisma.farmerPayment.findFirst({
    where: { farmerId, status: 'PAID', netPay: { lt: 0 } },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
  });
  const carriedForward = prevPayment ? Math.abs(Number(prevPayment.netPay)) : 0;

  const netPay = grossPay - totalAdvances - totalDeductions - carriedForward;

  return {
    farmer: {
      id: farmer.id, code: farmer.code, name: farmer.name,
      phone: farmer.phone, mpesaPhone: farmer.mpesaPhone,
      paymentMethod: farmer.paymentMethod,
      bankName: farmer.bankName, bankAccount: farmer.bankAccount,
      paidOn15th: farmer.paidOn15th,
      route: farmer.route,
    },
    totalLitres, grossPay, totalAdvances, totalDeductions,
    carriedForward, netPay, pricePerLitre: Number(farmer.pricePerLitre),
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

    return res.json({ payments, totals });
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
    const totalAdvances  = advMap.get(farmer.id) || 0;
    if (totalLitres === 0 && totalAdvances === 0) continue;
    const grossPay       = Number(totalLitres) * Number(farmer.pricePerLitre);
    const totalDeductions = dedMap.get(farmer.id) || 0;
    const netPay         = Number(grossPay) - Number(totalAdvances) - Number(totalDeductions);
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
      farmers: [], totalLitres: 0, totalGross: 0, totalAdvances: 0, totalNet: 0, negativeCount: 0,
    };
    byRoute[key].farmers.push(r);
    byRoute[key].totalLitres   += totalLitres;
    byRoute[key].totalGross    += grossPay;
    byRoute[key].totalAdvances += totalAdvances;
    byRoute[key].totalNet      += netPay > 0 ? netPay : 0;
    if (netPay < 0) byRoute[key].negativeCount++;
  }

  res.json({ routes: Object.values(byRoute).sort((a: any, b: any) => (a.routeCode||'').localeCompare(b.routeCode||'')), totalFarmers: Object.values(byRoute).reduce((s: number, r: any) => s + r.farmers.length, 0) });
});

// POST /api/payments/run — generate FarmerPayment records
router.post('/run', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, isMidMonth, routeId } = req.body;
  const m = Number(month); const y = Number(year); const mid = !!isMidMonth;
  const { start, end } = periodDates(m, y, mid);

  // Build farmer filter
  const whereRoute: any = { isActive: true };
  if (routeId) whereRoute.routeId = Number(routeId);
  if (mid) whereRoute.paidOn15th = true;

  // Fetch farmers first to get their IDs — groupBy can't filter by relations
  const farmers = await prisma.farmer.findMany({
    where: whereRoute,
    select: { id: true, pricePerLitre: true },
  });
  const farmerIds = farmers.map(f => f.id);
  if (farmerIds.length === 0) return res.json({ created: 0, message: 'No farmers found' });

  // Now groupBy filtering only by farmerIds (no relation joins)
  const [collections, advances, deductions] = await Promise.all([
    prisma.milkCollection.groupBy({
      by: ['farmerId'],
      where: { farmerId: { in: farmerIds }, collectedAt: { gte: start, lt: end } },
      _sum: { litres: true },
    }),
    prisma.farmerAdvance.groupBy({
      by: ['farmerId'],
      where: { farmerId: { in: farmerIds }, advanceDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.farmerDeduction.groupBy({
      by: ['farmerId'],
      where: { farmerId: { in: farmerIds }, periodMonth: m, periodYear: y },
      _sum: { amount: true },
    }),
  ]);

  // Build lookup maps
  const collMap  = new Map(collections.map(c => [c.farmerId, Number(c._sum.litres  || 0)]));
  const advMap   = new Map(advances.map(a   => [a.farmerId, Number(a._sum.amount   || 0)]));
  const dedMap   = new Map(deductions.map(d => [d.farmerId, Number(d._sum.amount   || 0)]));
  const priceMap = new Map(farmers.map(f    => [f.id,       Number(f.pricePerLitre)]));

  // Compute payments for farmers who have collections this period
  const records: any[] = [];
  for (const f of farmers) {
    const litres = collMap.get(f.id) || 0;
    if (litres === 0) continue;
    const price           = priceMap.get(f.id) || 46;
    const grossPay        = Number(litres) * Number(price);
    const totalAdvances   = advMap.get(f.id)  || 0;
    const totalDeductions = dedMap.get(f.id)  || 0;
    const netPay          = Number(grossPay) - Number(totalAdvances) - Number(totalDeductions);
    records.push({
      farmerId: f.id, periodMonth: m, periodYear: y, isMidMonth: mid,
      grossPay, totalAdvances, totalDeductions, netPay,
    });
  }

  if (records.length === 0) return res.json({ created: 0, message: 'No collections found for this period' });

  // Upsert in batches of 50
  // Note: totalDeductions may not exist in older DB — we include netPay which absorbs deductions
  let created = 0;
  const BATCH = 50;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await Promise.all(batch.map(async r => {
      try {
        await prisma.farmerPayment.upsert({
          where: {
            farmerId_periodMonth_periodYear_isMidMonth: {
              farmerId: r.farmerId, periodMonth: r.periodMonth,
              periodYear: r.periodYear, isMidMonth: r.isMidMonth,
            },
          },
          update: {
            grossPay: r.grossPay,
            totalAdvances: r.totalAdvances,
            totalDeductions: r.totalDeductions,
            netPay: r.netPay,
            status: 'PENDING',
          },
          create: r,
        });
      } catch (e: any) {
        // Fallback: if totalDeductions column missing, try without it
        if (e?.message?.includes('totalDeductions') || e?.code === 'P2022') {
          await prisma.farmerPayment.upsert({
            where: {
              farmerId_periodMonth_periodYear_isMidMonth: {
                farmerId: r.farmerId, periodMonth: r.periodMonth,
                periodYear: r.periodYear, isMidMonth: r.isMidMonth,
              },
            },
            update: {
              grossPay: r.grossPay,
              totalAdvances: r.totalAdvances,
              netPay: r.netPay,
              status: 'PENDING',
            },
            create: {
              farmerId: r.farmerId, periodMonth: r.periodMonth,
              periodYear: r.periodYear, isMidMonth: r.isMidMonth,
              grossPay: r.grossPay, totalAdvances: r.totalAdvances,
              netPay: r.netPay,
            },
          });
        } else throw e;
      }
    }));
    created += batch.length;
  }

  res.json({ created, message: `Generated ${created} payment records` });
});


// POST /api/payments/approve — approve payments per route
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
