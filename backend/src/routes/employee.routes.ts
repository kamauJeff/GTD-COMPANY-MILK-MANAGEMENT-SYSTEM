// src/routes/employee.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// GET /api/employees/my-route — returns the grader's assigned route + farmers
router.get('/my-route', async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.user!.sub },
    include: { supervisedRoutes: { include: { farmers: { where: { isActive: true }, orderBy: { name: 'asc' } } } } },
  });
  if (!employee) return res.status(404).json({ error: 'Not found' });
  const route = employee.supervisedRoutes[0] ?? null;
  res.json({ employee: { id: employee.id, name: employee.name, code: employee.code, role: employee.role }, route });
});

router.get('/', async (req, res) => {
  const { role } = req.query;
  const where: any = { isActive: true };
  if (role) where.role = role;
  const employees = await prisma.employee.findMany({ where, orderBy: { name: 'asc' } });
  res.json(employees);
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const { password, ...data } = req.body;
  const passwordHash = await bcrypt.hash(password || 'Gutoria@2024', 12);
  const employee = await prisma.employee.create({ data: { ...data, passwordHash } as any });
  res.status(201).json(employee);
});

router.put('/:id', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const employee = await prisma.employee.update({ where: { id: Number(req.params.id) }, data: req.body });
  res.json(employee);
});

export default router;

// GET my profile
router.get('/me', async (req: any, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.user.id },
    select: { id: true, code: true, name: true, phone: true, role: true },
  });
  res.json(employee);
});

// PUT update my profile
router.put('/me', async (req: any, res) => {
  const { name, phone } = req.body;
  const employee = await prisma.employee.update({
    where: { id: req.user.id },
    data: { ...(name ? { name } : {}), ...(phone ? { phone } : {}) },
    select: { id: true, code: true, name: true, phone: true, role: true },
  });
  res.json(employee);
});

// PUT change password
router.put('/me/password', async (req: any, res) => {
  const { current, newPassword } = req.body;
  if (!current || !newPassword) return res.status(400).json({ error: 'Both current and new password are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const employee = await prisma.employee.findUnique({ where: { id: req.user.id } });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const valid = await bcrypt.compare(current, employee.passwordHash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.employee.update({ where: { id: req.user.id }, data: { passwordHash: hash } });
  res.json({ success: true, message: 'Password changed successfully' });
});
