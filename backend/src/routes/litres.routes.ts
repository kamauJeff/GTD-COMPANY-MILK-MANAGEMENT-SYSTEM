import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// GET /api/factory/litres-ledger?month=9&year=2024
router.get('/litres-ledger', async (req, res) => {
  const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  const entries = await prisma.litresEntry.findMany({
    where: { month, year },
    orderBy: [{ section: 'asc' }, { name: 'asc' }, { day: 'asc' }],
  });

  const balances = await prisma.litresBalance.findMany({
    where: { month, year },
    orderBy: { day: 'asc' },
  });

  // If no entries yet, seed default names from routes + known brokers/sales
  if (entries.length === 0) {
    // Get route names
    const routes = await prisma.route.findMany({ orderBy: { code: 'asc' }, select: { name: true } });
    const defaultSections = {
      routes: routes.map(r => r.name),
      brokers: ['MUGWE', 'MUTHUNGU', 'KEN', 'THOMAS'],
      issues: ['REJECT - FACTORY', 'REJECT - GRADER', 'SPILLED'],
      sales: ['KCU', 'KCQ', 'KDE', 'KCN', 'LAICA', 'Others'],
    };
    return res.json({
      routes: Object.fromEntries(defaultSections.routes.map(n => [n, {}])),
      brokers: Object.fromEntries(defaultSections.brokers.map(n => [n, {}])),
      issues: Object.fromEntries(defaultSections.issues.map(n => [n, {}])),
      sales: Object.fromEntries(defaultSections.sales.map(n => [n, {}])),
      balance: {},
    });
  }

  // Build nested structure: { section: { name: { day: value } } }
  const ledger: any = { routes: {}, brokers: {}, issues: {}, sales: {} };
  for (const e of entries) {
    if (!ledger[e.section]) ledger[e.section] = {};
    if (!ledger[e.section][e.name]) ledger[e.section][e.name] = {};
    ledger[e.section][e.name][e.day] = Number(e.value);
  }

  // Build balance map: { day: value }
  const balanceMap: any = {};
  for (const b of balances) {
    balanceMap[b.day] = Number(b.balance);
  }

  res.json({ ...ledger, balance: balanceMap });
});

// POST /api/factory/litres-ledger  — save a single cell
router.post('/litres-ledger', authorize('ADMIN', 'OFFICE', 'GRADER'), async (req, res) => {
  const { section, name, day, month, year, value } = req.body;

  if (!['routes', 'brokers', 'issues', 'sales'].includes(section)) {
    return res.status(400).json({ error: 'Invalid section' });
  }

  const entry = await prisma.litresEntry.upsert({
    where: { section_name_day_month_year: { section, name, day, month, year } },
    update: { value: Number(value) || 0 },
    create: { section, name, day, month, year, value: Number(value) || 0 },
  });

  // Recalculate balance for this day
  const dayEntries = await prisma.litresEntry.findMany({ where: { month, year, day } });
  const routesTotal = dayEntries.filter(e => e.section === 'routes').reduce((s, e) => s + Number(e.value), 0);
  const brokersTotal = dayEntries.filter(e => e.section === 'brokers').reduce((s, e) => s + Number(e.value), 0);
  const issuesTotal = dayEntries.filter(e => e.section === 'issues').reduce((s, e) => s + Number(e.value), 0);
  const salesTotal = dayEntries.filter(e => e.section === 'sales').reduce((s, e) => s + Number(e.value), 0);

  // Previous day balance
  const prevBal = day > 1 ? await prisma.litresBalance.findUnique({ where: { day_month_year: { day: day - 1, month, year } } }) : null;
  const prevBalance = prevBal ? Number(prevBal.balance) : 0;
  const newBalance = prevBalance + routesTotal + brokersTotal - issuesTotal - salesTotal;

  await prisma.litresBalance.upsert({
    where: { day_month_year: { day, month, year } },
    update: { balance: newBalance },
    create: { day, month, year, balance: newBalance },
  });

  res.json({ entry, balance: newBalance });
});

// POST /api/factory/litres-ledger/add-row — add new row to a section
router.post('/litres-ledger/add-row', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { section, name, month, year } = req.body;
  // Just create one entry with 0 value to register the name
  const entry = await prisma.litresEntry.upsert({
    where: { section_name_day_month_year: { section, name, day: 1, month, year } },
    update: {},
    create: { section, name, day: 1, month, year, value: 0 },
  });
  res.json(entry);
});

export default router;
