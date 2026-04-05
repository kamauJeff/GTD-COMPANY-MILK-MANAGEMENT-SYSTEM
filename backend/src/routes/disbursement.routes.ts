import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// GET /api/disbursement/preview — list APPROVED payments ready for disbursement
router.get('/preview', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, isMidMonth, routeId } = req.query;
  const m = Number(month); const y = Number(year); const mid = isMidMonth === 'true';

  const where: any = {
    dairyId:     req.dairyId!,
    periodMonth: m, periodYear: y, isMidMonth: mid,
    status:      'APPROVED',
    netPay:      { gt: 0 },
  };
  if (routeId) where.farmer = { routeId: Number(routeId) };

  const payments = await prisma.farmerPayment.findMany({
    where,
    include: { farmer: { include: { route: { select: { name: true, code: true } } } } },
    orderBy: { farmer: { name: 'asc' } },
  });

  const mpesa = payments.filter(p => p.farmer.paymentMethod === 'MPESA');
  const bank  = payments.filter(p => p.farmer.paymentMethod === 'BANK');

  res.json({
    payments,
    summary: {
      total:       payments.length,
      mpesaCount:  mpesa.length,
      bankCount:   bank.length,
      totalAmount: payments.reduce((s, p) => s + Number(p.netPay), 0),
      mpesaAmount: mpesa.reduce((s, p) => s + Number(p.netPay), 0),
      bankAmount:  bank.reduce((s, p) => s + Number(p.netPay), 0),
    },
  });
});

// POST /api/disbursement/disburse — mark payments as PAID (M-Pesa or bank)
// In production: integrate KopoKopo here. For now marks as PAID immediately.
router.post('/disburse', authorize('ADMIN'), async (req, res) => {
  try {
    const { month, year, isMidMonth, routeId, paymentIds } = req.body;
    const m = Number(month); const y = Number(year); const mid = !!isMidMonth;

    // Build the filter — either specific IDs or all APPROVED for the period
    let where: any;
    if (paymentIds?.length) {
      where = {
        dairyId: req.dairyId!,
        id:      { in: paymentIds.map(Number) },
        status:  'APPROVED',
        netPay:  { gt: 0 },
      };
    } else {
      where = {
        dairyId:     req.dairyId!,
        periodMonth: m, periodYear: y, isMidMonth: mid,
        status:      'APPROVED',
        netPay:      { gt: 0 },
      };
      if (routeId) where.farmer = { routeId: Number(routeId) };
    }

    const toDisburse = await prisma.farmerPayment.findMany({
      where,
      include: { farmer: { select: { name: true, code: true, paymentMethod: true, mpesaPhone: true } } },
    });

    if (toDisburse.length === 0) {
      return res.json({ disbursed: 0, message: 'No approved payments found to disburse' });
    }

    // ── KopoKopo integration (activate when credentials are set) ─────────────
    const kopokopoClientId     = process.env.KOPOKOPO_CLIENT_ID;
    const kopokopoClientSecret = process.env.KOPOKOPO_CLIENT_SECRET;
    const kopokopoProd         = process.env.KOPOKOPO_ENV === 'production';

    let kopokopoRef: string | null = null;

    if (kopokopoClientId && kopokopoClientSecret) {
      // Real KopoKopo disbursement would go here
      // For now log that credentials are present
      console.log(`[KopoKopo] Would disburse ${toDisburse.length} payments in ${kopokopoProd ? 'PRODUCTION' : 'SANDBOX'}`);
      kopokopoRef = `KPK-${Date.now()}`;
    }

    // Mark all as PAID
    const ids = toDisburse.map(p => p.id);
    await prisma.farmerPayment.updateMany({
      where: { dairyId: req.dairyId!, id: { in: ids } },
      data: {
        status:      'PAID',
        paidAt:      new Date(),
        kopokopoRef: kopokopoRef,
      },
    });

    const totalAmount = toDisburse.reduce((s, p) => s + Number(p.netPay), 0);
    const mpesaCount  = toDisburse.filter(p => p.farmer.paymentMethod === 'MPESA').length;
    const bankCount   = toDisburse.filter(p => p.farmer.paymentMethod === 'BANK').length;

    res.json({
      disbursed:   toDisburse.length,
      totalAmount,
      mpesaCount,
      bankCount,
      kopokopoRef,
      message: `${toDisburse.length} farmers paid — KES ${totalAmount.toLocaleString()} (${mpesaCount} M-Pesa, ${bankCount} Bank)`,
    });

  } catch (err: any) {
    console.error('/disburse error:', err);
    res.status(500).json({ error: err?.message || 'Disbursement failed' });
  }
});

// POST /api/disbursement/mark-paid — manually mark specific payments as paid
router.post('/mark-paid', authorize('ADMIN'), async (req, res) => {
  const { paymentIds, kopokopoRef } = req.body;
  if (!paymentIds?.length) return res.status(400).json({ error: 'paymentIds required' });

  const result = await prisma.farmerPayment.updateMany({
    where: { dairyId: req.dairyId!, id: { in: paymentIds.map(Number) } },
    data: { status: 'PAID', paidAt: new Date(), kopokopoRef: kopokopoRef || null },
  });
  res.json({ paid: result.count });
});

// GET /api/disbursement/history — paid disbursements history
router.get('/history', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year } = req.query;
  const where: any = { dairyId: req.dairyId!, status: 'PAID', netPay: { gt: 0 } };
  if (month) where.periodMonth = Number(month);
  if (year)  where.periodYear  = Number(year);

  const payments = await prisma.farmerPayment.findMany({
    where,
    include: { farmer: { select: { name: true, code: true, paymentMethod: true, mpesaPhone: true, bankName: true, bankAccount: true, route: { select: { name: true } } } } },
    orderBy: { paidAt: 'desc' },
  });
  res.json(payments);
});

// GET /api/disbursement/negatives — farmers who ended period with negative balance
router.get('/negatives', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year } = req.query;
  const where: any = { dairyId: req.dairyId!, netPay: { lt: 0 }, isMidMonth: false };
  if (month) where.periodMonth = Number(month);
  if (year)  where.periodYear  = Number(year);

  const payments = await prisma.farmerPayment.findMany({
    where,
    include: { farmer: { select: { name: true, code: true, phone: true, route: { select: { name: true } } } } },
    orderBy: { netPay: 'asc' },
  });

  const total = payments.reduce((s, p) => s + Math.abs(Number(p.netPay)), 0);
  res.json({ payments, totalCarriedForward: total, count: payments.length });
});

export default router;
