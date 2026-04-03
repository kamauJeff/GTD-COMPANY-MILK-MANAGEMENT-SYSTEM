// Super-admin routes — manage all dairies on the platform
import { Router } from 'express';
import { authenticate, superAdminOnly } from '../middleware/auth';
import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate, superAdminOnly);

// Helper — BigInt from COUNT() must be converted to Number for JSON serialization
function toNum(v: any): number { return typeof v === 'bigint' ? Number(v) : Number(v ?? 0); }

// GET /api/super/dairies
router.get('/dairies', async (_req, res) => {
  try {
    const dairies = await prisma.$queryRaw<any[]>`
      SELECT
        d.id, d.name, d.slug, d.phone, d.email, d.location,
        d.plan, d.status, d."maxFarmers", d."monthlyFee",
        d."trialEndsAt", d."subscriptionEndsAt",
        d."atSenderId", d."managerPhone",
        d."createdAt", d."updatedAt",
        (SELECT COUNT(*)::int FROM "Farmer" f WHERE f."dairyId" = d.id) AS "farmerCount",
        (SELECT COUNT(*)::int FROM "Employee" e WHERE e."dairyId" = d.id) AS "employeeCount"
      FROM "Dairy" d
      ORDER BY d."createdAt" DESC
    `;
    res.json(dairies.map(d => ({
      ...d,
      monthlyFee: Number(d.monthlyFee),
      farmerCount:   undefined,
      employeeCount: undefined,
      _count: { farmers: toNum(d.farmerCount), employees: toNum(d.employeeCount) },
    })));
  } catch (err: any) {
    console.error('GET /super/dairies error:', err);
    res.status(500).json({ error: err.message || 'Failed to load dairies' });
  }
});

// GET /api/super/stats
router.get('/stats', async (_req, res) => {
  try {
    const [[dStats], [fCount], [eCount]] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*)::int AS "totalDairies",
          COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS "activeDairies",
          COALESCE(SUM("monthlyFee") FILTER (WHERE status = 'ACTIVE'), 0) AS "monthlyRevenue"
        FROM "Dairy"
      `,
      prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS cnt FROM "Farmer"`,
      prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS cnt FROM "Employee" WHERE role != 'SUPER_ADMIN'`,
    ]);
    const monthly = Number(dStats.monthlyRevenue);
    res.json({
      totalDairies:   toNum(dStats.totalDairies),
      activeDairies:  toNum(dStats.activeDairies),
      totalFarmers:   toNum(fCount.cnt),
      totalEmployees: toNum(eCount.cnt),
      monthlyRevenue: monthly,
      annualRevenue:  monthly * 12,
    });
  } catch (err: any) {
    console.error('GET /super/stats error:', err);
    res.status(500).json({ error: err.message || 'Failed to load stats' });
  }
});

// PATCH /api/super/dairies/:id — update plan/status/fees
router.patch('/dairies/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { plan, status, monthlyFee, maxFarmers } = req.body;
    await prisma.$executeRaw`
      UPDATE "Dairy" SET
        plan        = COALESCE(${plan        ?? null}::text, plan),
        status      = COALESCE(${status      ?? null}::text, status),
        "monthlyFee"= COALESCE(${monthlyFee  != null ? Number(monthlyFee)  : null}::numeric, "monthlyFee"),
        "maxFarmers"= COALESCE(${maxFarmers  != null ? Number(maxFarmers)  : null}::int,     "maxFarmers"),
        "updatedAt" = NOW()
      WHERE id = ${id}
    `;
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "Dairy" WHERE id = ${id}`;
    res.json({ ...rows[0], monthlyFee: Number(rows[0].monthlyFee) });
  } catch (err: any) {
    console.error('PATCH /super/dairies error:', err);
    res.status(500).json({ error: err.message || 'Update failed' });
  }
});

// DELETE /api/super/dairies/:id — suspend
router.delete('/dairies/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.$executeRaw`UPDATE "Dairy" SET status = 'SUSPENDED', "updatedAt" = NOW() WHERE id = ${id}`;
  res.json({ message: 'Dairy suspended' });
});

// POST /api/super/dairies — create dairy + admin
router.post('/dairies', async (req, res) => {
  try {
    const { name, slug, phone, email, location, plan, monthlyFee, adminName, adminCode, adminPhone, adminPassword } = req.body;
    if (!name || !slug || !adminName || !adminCode || !adminPassword) {
      return res.status(400).json({ error: 'name, slug, adminName, adminCode, adminPassword are required' });
    }
    const existing = await prisma.$queryRaw<any[]>`SELECT id FROM "Dairy" WHERE slug = ${slug}`;
    if (existing.length) return res.status(400).json({ error: `Slug "${slug}" is already taken` });

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const trialEndsAt  = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const fee          = Number(monthlyFee) || 0;

    const dairy = await prisma.$queryRaw<any[]>`
      INSERT INTO "Dairy" (name, slug, phone, email, location, plan, status, "maxFarmers", "monthlyFee", "trialEndsAt", "atSenderId", "kopokopoEnv", "updatedAt")
      VALUES (${name}, ${slug}, ${phone||null}, ${email||null}, ${location||null},
              ${plan||'TRIAL'}, 'TRIAL', 2000, ${fee}, ${trialEndsAt}, 'DAIRY', 'sandbox', NOW())
      RETURNING id, name, slug, status, plan
    `;
    const d = dairy[0];

    const admin = await prisma.employee.create({
      data: { dairyId: d.id, code: adminCode.toUpperCase(), name: adminName, phone: adminPhone||'000', role: 'ADMIN', salary: 0, paymentMethod: 'MPESA', isActive: true, passwordHash },
    });

    res.status(201).json({
      message:   `Dairy "${name}" created`,
      dairy:     d,
      admin:     { id: admin.id, code: admin.code, name: admin.name },
      loginInfo: { code: adminCode, password: adminPassword },
    });
  } catch (err: any) {
    console.error('POST /super/dairies error:', err);
    res.status(500).json({ error: err.message || 'Create failed' });
  }
});

// GET /api/super/dairies/:id
router.get('/dairies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const rows = await prisma.$queryRaw<any[]>`
    SELECT d.*,
      (SELECT COUNT(*)::int FROM "Farmer" f WHERE f."dairyId" = d.id) AS "farmerCount",
      (SELECT COUNT(*)::int FROM "Employee" e WHERE e."dairyId" = d.id) AS "employeeCount"
    FROM "Dairy" d WHERE d.id = ${id}
  `;
  if (!rows.length) return res.status(404).json({ error: 'Dairy not found' });
  const d = rows[0];
  res.json({ ...d, monthlyFee: Number(d.monthlyFee), _count: { farmers: toNum(d.farmerCount), employees: toNum(d.employeeCount) } });
});

export default router;
