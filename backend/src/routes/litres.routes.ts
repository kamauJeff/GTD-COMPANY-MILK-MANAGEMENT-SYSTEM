import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// GET /api/factory/litres-ledger?month=9&year=2024
// Auto-fetches: routes from MilkCollection, sales from ShopDelivery
// Manual input: brokers, issues (rejects/spills)
router.get('/litres-ledger', async (req, res) => {
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
  const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();

  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

  // ── AUTO: Routes from MilkCollection ──────────────────────────────────────
  const collections = await prisma.milkCollection.findMany({
    where: { collectedAt: { gte: start, lt: end } },
    include: { route: { select: { name: true } } },
    select: { collectedAt: true, litres: true, route: true },
  });

  const routesAuto: Record<string, Record<number, number>> = {};
  for (const c of collections) {
    const routeName = c.route?.name ?? 'UNKNOWN';
    const day = new Date(c.collectedAt).getDate();
    if (!routesAuto[routeName]) routesAuto[routeName] = {};
    routesAuto[routeName][day] = (routesAuto[routeName][day] || 0) + Number(c.litres);
  }

  // ── AUTO: Sales from ShopDelivery ─────────────────────────────────────────
  // Try ShopDelivery first, fallback to ShopSale
  const shopDeliveries = await prisma.shopDelivery.findMany({
    where: { deliveredAt: { gte: start, lt: end } },
    include: { shop: { select: { name: true } } },
  }).catch(() => []);

  const shopSales = await prisma.shopSale.findMany({
    where: { saleDate: { gte: start, lt: end } },
    include: { shop: { select: { name: true } } },
  }).catch(() => []);

  // Build sales by shop name per day
  const salesAuto: Record<string, Record<number, number>> = {};

  // Use deliveries if available, else sales
  const salesSource = shopDeliveries.length > 0 ? shopDeliveries : shopSales;
  for (const s of salesSource) {
    const shopName = (s as any).shop?.name ?? 'SHOP';
    const dateField = (s as any).deliveredAt || (s as any).saleDate;
    const day = new Date(dateField).getDate();
    if (!salesAuto[shopName]) salesAuto[shopName] = {};
    salesAuto[shopName][day] = (salesAuto[shopName][day] || 0) + Number((s as any).litres);
  }

  // ── MANUAL: Brokers & Issues from LitresEntry ─────────────────────────────
  const entries = await prisma.litresEntry.findMany({
    where: { month, year, section: { in: ['brokers', 'issues'] } },
    orderBy: [{ section: 'asc' }, { name: 'asc' }, { day: 'asc' }],
  });

  const manual: any = { brokers: {}, issues: {} };
  for (const e of entries) {
    if (!manual[e.section][e.name]) manual[e.section][e.name] = {};
    manual[e.section][e.name][e.day] = Number(e.value);
  }

  // Default broker names if none exist
  if (Object.keys(manual.brokers).length === 0) {
    manual.brokers = { 'MUGWE': {}, 'MUTHUNGU': {}, 'KEN': {}, 'THOMAS': {} };
  }
  if (Object.keys(manual.issues).length === 0) {
    manual.issues = { 'REJECT - FACTORY': {}, 'REJECT - GRADER': {}, 'SPILLED': {} };
  }

  // ── Balance b/f (previous day closing balance) ────────────────────────────
  const balances = await prisma.litresBalance.findMany({
    where: { month, year },
    orderBy: { day: 'asc' },
  });
  const balanceMap: Record<number, number> = {};
  for (const b of balances) {
    balanceMap[b.day] = Number(b.balance);
  }

  // ── Compute daily summary ─────────────────────────────────────────────────
  const dailySummary: Record<number, any> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const routesTotal   = Object.values(routesAuto).reduce((s, days) => s + (days[d] || 0), 0);
    const brokersTotal  = Object.values(manual.brokers).reduce((s: number, days: any) => s + (days[d] || 0), 0);
    const issuesTotal   = Object.values(manual.issues).reduce((s: number, days: any) => s + (days[d] || 0), 0);
    const salesTotal    = Object.values(salesAuto).reduce((s, days) => s + (days[d] || 0), 0);
    const prevBalance   = d === 1 ? (balanceMap[0] || 0) : (balanceMap[d - 1] || 0);
    const available     = prevBalance + routesTotal + brokersTotal - issuesTotal;
    const closingBalance = available - salesTotal;
    const variance      = closingBalance; // what should be in storage

    dailySummary[d] = {
      routesTotal: parseFloat(routesTotal.toFixed(2)),
      brokersTotal: parseFloat(brokersTotal.toFixed(2)),
      issuesTotal: parseFloat(issuesTotal.toFixed(2)),
      salesTotal: parseFloat(salesTotal.toFixed(2)),
      prevBalance: parseFloat(prevBalance.toFixed(2)),
      available: parseFloat(available.toFixed(2)),
      closingBalance: parseFloat(closingBalance.toFixed(2)),
    };
  }

  res.json({
    routes:  routesAuto,
    brokers: manual.brokers,
    issues:  manual.issues,
    sales:   salesAuto,
    balance: balanceMap,
    dailySummary,
    daysInMonth,
    month, year,
  });
});

// POST — save broker or issue entry (routes & sales are auto)
router.post('/litres-ledger', authorize('ADMIN', 'OFFICE', 'GRADER'), async (req, res) => {
  const { section, name, day, month, year, value } = req.body;

  if (!['brokers', 'issues'].includes(section)) {
    return res.status(400).json({ error: 'Only brokers and issues can be edited manually. Routes and sales are auto-fetched.' });
  }

  const entry = await prisma.litresEntry.upsert({
    where: { section_name_day_month_year: { section, name, day, month, year } },
    update: { value: Number(value) || 0 },
    create: { section, name, day, month, year, value: Number(value) || 0 },
  });

  // Recalculate and save closing balance for this day
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

  // Get routes total for this day from collections
  const dayStart = new Date(year, month - 1, day);
  const dayEnd   = new Date(year, month - 1, day + 1);

  const [collAgg, delivAgg, saleAgg] = await Promise.all([
    prisma.milkCollection.aggregate({ where: { collectedAt: { gte: dayStart, lt: dayEnd } }, _sum: { litres: true } }),
    prisma.shopDelivery.findMany({ where: { deliveredAt: { gte: dayStart, lt: dayEnd } } }).catch(() => []),
    prisma.shopSale.aggregate({ where: { saleDate: { gte: dayStart, lt: dayEnd } }, _sum: { litres: true } }).catch(() => ({ _sum: { litres: 0 } })),
  ]);

  const allEntries = await prisma.litresEntry.findMany({ where: { month, year, day } });
  const brokersTotal = allEntries.filter(e => e.section === 'brokers').reduce((s, e) => s + Number(e.value), 0);
  const issuesTotal  = allEntries.filter(e => e.section === 'issues').reduce((s, e) => s + Number(e.value), 0);
  const routesTotal  = Number(collAgg._sum.litres || 0);
  const salesTotal   = delivAgg.length > 0
    ? delivAgg.reduce((s: number, d: any) => s + Number(d.litres), 0)
    : Number(saleAgg._sum.litres || 0);

  const prevBal = day > 1
    ? await prisma.litresBalance.findUnique({ where: { day_month_year: { day: day - 1, month, year } } })
    : null;
  const prevBalance = prevBal ? Number(prevBal.balance) : 0;
  const available   = prevBalance + routesTotal + brokersTotal - issuesTotal;
  const newBalance  = available - salesTotal;

  await prisma.litresBalance.upsert({
    where: { day_month_year: { day, month, year } },
    update: { balance: newBalance },
    create: { day, month, year, balance: newBalance },
  });

  res.json({ entry, balance: newBalance, available, salesTotal, routesTotal, brokersTotal, issuesTotal });
});

// POST /api/factory/litres-ledger/set-balance — set opening balance (b/f) for day 0
router.post('/litres-ledger/set-balance', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year, balance } = req.body;
  const result = await prisma.litresBalance.upsert({
    where: { day_month_year: { day: 0, month, year } },
    update: { balance: Number(balance) },
    create: { day: 0, month, year, balance: Number(balance) },
  });
  res.json(result);
});

// POST add broker or issue row
router.post('/litres-ledger/add-row', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { section, name, month, year } = req.body;
  if (!['brokers', 'issues'].includes(section)) {
    return res.status(400).json({ error: 'Can only add brokers or issues rows' });
  }
  const entry = await prisma.litresEntry.upsert({
    where: { section_name_day_month_year: { section, name, day: 1, month, year } },
    update: {},
    create: { section, name, day: 1, month, year, value: 0 },
  });
  res.json(entry);
});

export default router;
