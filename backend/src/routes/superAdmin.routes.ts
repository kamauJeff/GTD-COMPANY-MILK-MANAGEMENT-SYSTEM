// Super-admin routes — manage all dairies on the platform
import { Router } from 'express';
import { authenticate, superAdminOnly } from '../middleware/auth';
import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate, superAdminOnly);

// GET /api/super/dairies
router.get('/dairies', async (_req, res) => {
  const dairies = await prisma.$queryRaw<any[]>`
    SELECT d.*,
      (SELECT COUNT(*) FROM "Farmer" f WHERE f."dairyId" = d.id) AS "farmerCount",
      (SELECT COUNT(*) FROM "Employee" e WHERE e."dairyId" = d.id) AS "employeeCount"
    FROM "Dairy" d
    ORDER BY d."createdAt" DESC
  `;
  res.json(dairies.map(d => ({
    ...d,
    _count: { farmers: Number(d.farmerCount), employees: Number(d.employeeCount) }
  })));
});

// GET /api/super/dairies/:id
router.get('/dairies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const rows = await prisma.$queryRaw<any[]>`
    SELECT d.*,
      (SELECT COUNT(*) FROM "Farmer" f WHERE f."dairyId" = d.id) AS "farmerCount",
      (SELECT COUNT(*) FROM "Employee" e WHERE e."dairyId" = d.id) AS "employeeCount"
    FROM "Dairy" d WHERE d.id = ${id}
  `;
  if (!rows.length) return res.status(404).json({ error: 'Dairy not found' });
  const d = rows[0];
  res.json({ ...d, _count: { farmers: Number(d.farmerCount), employees: Number(d.employeeCount) } });
});

// POST /api/super/dairies — create dairy + admin
router.post('/dairies', async (req, res) => {
  const { name, slug, phone, email, location, plan, monthlyFee, adminName, adminCode, adminPhone, adminPassword } = req.body;
  if (!name || !slug || !adminName || !adminCode || !adminPassword) {
    return res.status(400).json({ error: 'name, slug, adminName, adminCode, adminPassword are required' });
  }
  const existing = await prisma.$queryRaw<any[]>`SELECT id FROM "Dairy" WHERE slug = ${slug}`;
  if (existing.length) return res.status(400).json({ error: `Slug "${slug}" is already taken` });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const fee = Number(monthlyFee) || 0;

  const result = await prisma.$transaction(async (tx) => {
    const dairy = await tx.$queryRaw<any[]>`
      INSERT INTO "Dairy" (name, slug, phone, email, location, plan, status, "maxFarmers", "monthlyFee", "trialEndsAt", "atSenderId", "kopokopoEnv", "updatedAt")
      VALUES (${name}, ${slug}, ${phone||null}, ${email||null}, ${location||null},
              ${plan||'TRIAL'}, 'TRIAL', 2000, ${fee}, ${trialEndsAt}, 'DAIRY', 'sandbox', NOW())
      RETURNING *
    `;
    const d = dairy[0];
    const admin = await tx.employee.create({
      data: { dairyId: d.id, code: adminCode.toUpperCase(), name: adminName, phone: adminPhone||'000', role: 'ADMIN', salary: 0, paymentMethod: 'MPESA', isActive: true, passwordHash },
    });
    return { dairy: d, admin };
  });

  res.status(201).json({
    message: `Dairy "${name}" created. Admin code: ${adminCode}`,
    dairy: result.dairy,
    admin: { id: result.admin.id, code: result.admin.code, name: result.admin.name },
    loginInfo: { code: adminCode, password: adminPassword },
  });
});

// PATCH /api/super/dairies/:id
router.patch('/dairies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { plan, status, monthlyFee, maxFarmers } = req.body;
  await prisma.$executeRaw`
    UPDATE "Dairy" SET
      plan = COALESCE(${plan||null}, plan),
      status = COALESCE(${status||null}, status),
      "monthlyFee" = COALESCE(${monthlyFee!=null ? Number(monthlyFee) : null}, "monthlyFee"),
      "maxFarmers" = COALESCE(${maxFarmers!=null ? Number(maxFarmers) : null}, "maxFarmers"),
      "updatedAt" = NOW()
    WHERE id = ${id}
  `;
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "Dairy" WHERE id = ${id}`;
  res.json(rows[0]);
});

// DELETE /api/super/dairies/:id — suspend
router.delete('/dairies/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.$executeRaw`UPDATE "Dairy" SET status = 'SUSPENDED', "updatedAt" = NOW() WHERE id = ${id}`;
  res.json({ message: 'Dairy suspended' });
});

// GET /api/super/stats
router.get('/stats', async (_req, res) => {
  const [dairyStats, farmerCount, employeeCount] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) AS "totalDairies",
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS "activeDairies",
        COALESCE(SUM("monthlyFee") FILTER (WHERE status = 'ACTIVE'), 0) AS "monthlyRevenue"
      FROM "Dairy"
    `,
    prisma.$queryRaw<any[]>`SELECT COUNT(*) AS cnt FROM "Farmer"`,
    prisma.$queryRaw<any[]>`SELECT COUNT(*) AS cnt FROM "Employee" WHERE role != 'SUPER_ADMIN'`,
  ]);
  const s = dairyStats[0];
  const monthlyRevenue = Number(s.monthlyRevenue);
  res.json({
    totalDairies:   Number(s.totalDairies),
    activeDairies:  Number(s.activeDairies),
    totalFarmers:   Number(farmerCount[0].cnt),
    totalEmployees: Number(employeeCount[0].cnt),
    monthlyRevenue,
    annualRevenue:  monthlyRevenue * 12,
  });
});

export default router;
