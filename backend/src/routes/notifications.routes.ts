import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// ── SMS/WhatsApp notification after disbursement ──────────────────────────────
// Uses Africa's Talking SMS API (affordable, Kenya-native)
// Set env: AT_API_KEY, AT_USERNAME, AT_SENDER_ID

async function sendSMS(phone: string, message: string): Promise<boolean> {
  const apiKey   = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME || 'sandbox';
  const senderId = process.env.AT_SENDER_ID || 'GUTORIA';

  if (!apiKey) {
    console.log(`[SMS SIMULATION] To: ${phone}\n${message}\n`);
    return true; // simulate in dev
  }

  try {
    const body = new URLSearchParams({
      username,
      to:      phone.startsWith('+') ? phone : `+${phone}`,
      message,
      from:    senderId,
    });
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });
    const data = await res.json() as any;
    return data?.SMSMessageData?.Recipients?.[0]?.status === 'Success';
  } catch {
    return false;
  }
}

// POST /api/notifications/payment-sms — send SMS after disbursement
router.post('/payment-sms', authorize('ADMIN'), async (req, res) => {
  const { month, year, isMidMonth, routeId } = req.body;
  const m = Number(month); const y = Number(year); const mid = !!isMidMonth;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const where: any = { periodMonth: m, periodYear: y, isMidMonth: mid, status: 'PAID', netPay: { gt: 0 } };
  if (routeId) where.farmer = { routeId: Number(routeId) };

  const payments = await prisma.farmerPayment.findMany({
    where,
    include: { farmer: { select: { name: true, phone: true, mpesaPhone: true, paymentMethod: true } } },
  });

  if (payments.length === 0) return res.json({ sent: 0, message: 'No paid farmers found' });

  const period = mid ? `mid-month 1–15 ${MONTHS[m-1]}` : `end-month ${MONTHS[m-1]}`;
  let sent = 0; let failed = 0;

  for (const p of payments) {
    const phone = p.farmer.mpesaPhone || p.farmer.phone;
    if (!phone) { failed++; continue; }

    const message =
      `Gutoria Dairies: KES ${Number(p.netPay).toLocaleString()} paid for ${period} ${y}.\n` +
      `Net Pay: KES ${Number(p.netPay).toLocaleString()}\n` +
      `Gross: KES ${Number(p.grossPay).toLocaleString()} | Deductions: KES ${Number(p.totalDeductions).toLocaleString()}\n` +
      `Queries: 0700 000 000`;

    const ok = await sendSMS(phone, message);
    if (ok) sent++; else failed++;
  }

  res.json({ sent, failed, total: payments.length, message: `SMS sent to ${sent}/${payments.length} farmers` });
});

// POST /api/notifications/variance-alert — daily variance alert to manager
router.post('/variance-alert', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { date, collectedLitres, receivedLitres, routesReported, routesTotal, managerPhone } = req.body;
  const variance = Math.abs(Number(receivedLitres) - Number(collectedLitres));

  if (variance < 1) return res.json({ sent: false, message: 'No significant variance to alert' });

  const direction = Number(receivedLitres) > Number(collectedLitres) ? 'more' : 'less';
  const message =
    `Gutoria Dairies ALERT ${date}:\n` +
    `Factory received ${variance.toFixed(1)}L ${direction} than graders collected.\n` +
    `Collected: ${Number(collectedLitres).toFixed(1)}L | Received: ${Number(receivedLitres).toFixed(1)}L\n` +
    `Routes reported: ${routesReported}/${routesTotal}\n` +
    `Please investigate.`;

  const phone = managerPhone || process.env.MANAGER_PHONE;
  if (!phone) return res.json({ sent: false, message: 'No manager phone configured' });

  const ok = await sendSMS(phone, message);
  res.json({ sent: ok, message: ok ? 'Alert sent to manager' : 'Failed to send alert' });
});

// GET /api/notifications/config — check AT configuration status
router.get('/config', authorize('ADMIN'), async (_req, res) => {
  res.json({
    configured: !!process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || 'sandbox',
    senderId: process.env.AT_SENDER_ID || 'GUTORIA',
    managerPhone: process.env.MANAGER_PHONE || null,
    mode: process.env.AT_API_KEY ? 'live' : 'simulation',
  });
});

export default router;
