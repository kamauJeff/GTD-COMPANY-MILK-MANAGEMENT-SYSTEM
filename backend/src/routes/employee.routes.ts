// src/routes/employee.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

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

