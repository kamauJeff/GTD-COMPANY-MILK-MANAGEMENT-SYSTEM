// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export async function login(req: Request, res: Response) {
  const { code, password } = req.body;
  if (!code || !password) throw new AppError(400, 'code and password are required');

  const employee = await prisma.employee.findUnique({ where: { code } });
  if (!employee || !(employee as any).passwordHash) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, (employee as any).passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  const token = jwt.sign(
    { sub: employee.id, role: employee.role, name: employee.name },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({ token, employee: { id: employee.id, name: employee.name, role: employee.role } });
}

export async function me(req: Request, res: Response) {
  const employee = await prisma.employee.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, code: true, name: true, phone: true, role: true },
  });
  if (!employee) throw new AppError(404, 'Employee not found');
  res.json(employee);
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const employee = await prisma.employee.findUnique({ where: { id: req.user!.sub } });
  if (!employee) throw new AppError(404, 'Employee not found');

  const valid = await bcrypt.compare(currentPassword, (employee as any).passwordHash ?? '');
  if (!valid) throw new AppError(401, 'Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.employee.update({ where: { id: employee.id }, data: { passwordHash: hash } as any });
  res.json({ message: 'Password updated' });
}

