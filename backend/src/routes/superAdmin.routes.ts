// Super-admin routes — manage all dairies on the platform
import { Router, Request, Response } from 'express';
import { authenticate, superAdminOnly } from '../middleware/auth';
import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate, superAdminOnly);

// GET /api/super/dairies — list all dairies
router.get('/dairies', async (_req, res) => {
  const dairies = await prisma.dairy.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { farmers: true, employees: true } }
    }
  });
  res.json(dairies);
});

// GET /api/super/dairies/:id — single dairy detail
router.get('/dairies/:id', async (req, res) => {
  const dairy = await prisma.dairy.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      _count: { select: { farmers: true, employees: true, collections: true, payments: true } }
    }
  });
  if (!dairy) return res.status(404).json({ error: 'Dairy not found' });
  res.json(dairy);
});

// POST /api/super/dairies — create a new dairy + seed admin employee
router.post('/dairies', async (req, res) => {
  const {
    name, slug, phone, email, location, plan, monthlyFee,
    adminName, adminCode, adminPhone, adminPassword,
  } = req.body;

  if (!name || !slug || !adminName || !adminCode || !adminPassword) {
    return res.status(400).json({ error: 'name, slug, adminName, adminCode, adminPassword are required' });
  }

  // Check slug is unique
  const exists = await prisma.dairy.findUnique({ where: { slug } });
  if (exists) return res.status(400).json({ error: `Slug "${slug}" is already taken` });

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const trialEndsAt  = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

  // Create dairy + admin in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const dairy = await tx.dairy.create({
      data: {
        name, slug,
        phone: phone || null,
        email: email || null,
        location: location || null,
        plan: plan || 'TRIAL',
        status: 'TRIAL',
        monthlyFee: Number(monthlyFee) || 0,
        trialEndsAt,
      }
    });

    const admin = await tx.employee.create({
      data: {
        dairyId:      dairy.id,
        code:         adminCode.toUpperCase(),
        name:         adminName,
        phone:        adminPhone || '000',
        role:         'ADMIN',
        salary:       0,
        paymentMethod:'MPESA',
        isActive:     true,
        passwordHash,
      }
    });

    return { dairy, admin };
  });

  res.status(201).json({
    message: `Dairy "${name}" created successfully`,
    dairy:   result.dairy,
    admin:   { id: result.admin.id, code: result.admin.code, name: result.admin.name },
    loginInfo: { code: adminCode, password: adminPassword, url: `/?dairy=${slug}` },
  });
});

// PATCH /api/super/dairies/:id — update plan/status/fees
router.patch('/dairies/:id', async (req, res) => {
  const { plan, status, monthlyFee, maxFarmers, subscriptionEndsAt } = req.body;
  const dairy = await prisma.dairy.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(plan   && { plan }),
      ...(status && { status }),
      ...(monthlyFee       !== undefined && { monthlyFee: Number(monthlyFee) }),
      ...(maxFarmers       !== undefined && { maxFarmers: Number(maxFarmers) }),
      ...(subscriptionEndsAt && { subscriptionEndsAt: new Date(subscriptionEndsAt) }),
    }
  });
  res.json(dairy);
});

// DELETE /api/super/dairies/:id — suspend (soft delete by setting status)
router.delete('/dairies/:id', async (req, res) => {
  await prisma.dairy.update({
    where: { id: Number(req.params.id) },
    data:  { status: 'SUSPENDED' },
  });
  res.json({ message: 'Dairy suspended' });
});

// GET /api/super/stats — platform overview
router.get('/stats', async (_req, res) => {
  const [totalDairies, totalFarmers, totalEmployees, activeDairies, revenue] = await Promise.all([
    prisma.dairy.count(),
    prisma.farmer.count(),
    prisma.employee.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
    prisma.dairy.count({ where: { status: 'ACTIVE' } }),
    prisma.dairy.aggregate({ _sum: { monthlyFee: true }, where: { status: 'ACTIVE' } }),
  ]);
  res.json({
    totalDairies, totalFarmers, totalEmployees, activeDairies,
    monthlyRevenue: Number(revenue._sum.monthlyFee || 0),
    annualRevenue:  Number(revenue._sum.monthlyFee || 0) * 12,
  });
});

export default router;
