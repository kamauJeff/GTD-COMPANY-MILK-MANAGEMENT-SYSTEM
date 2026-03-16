import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export async function login(req: Request, res: Response) {
  const { code, password } = req.body;
  if (!code || !password) throw new AppError(400, 'code and password are required');

  // Use raw query to bypass Prisma client type cache issues
  const result = await prisma.$queryRaw<any[]>`
    SELECT id, code, name, role, "passwordHash" 
    FROM "Employee" 
    WHERE code = ${code.toUpperCase()} AND "isActive" = true
    LIMIT 1
  `;

  if (!result || result.length === 0) throw new AppError(401, 'Invalid credentials');
  
  const employee = result[0];
  if (!employee.passwordHash) throw new AppError(401, 'Account not set up. Contact admin.');

  const valid = await bcrypt.compare(password, employee.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  const token = jwt.sign(
    { sub: employee.id, role: employee.role, name: employee.name },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
  );

  res.json({ 
    token, 
    employee: { id: employee.id, name: employee.name, role: employee.role, code: employee.code } 
  });
}

export async function me(req: Request, res: Response) {
  const result = await prisma.$queryRaw<any[]>`
    SELECT id, code, name, phone, role 
    FROM "Employee" 
    WHERE id = ${req.user!.sub}
    LIMIT 1
  `;
  if (!result || result.length === 0) throw new AppError(404, 'Employee not found');
  res.json(result[0]);
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  
  const result = await prisma.$queryRaw<any[]>`
    SELECT id, "passwordHash" FROM "Employee" WHERE id = ${req.user!.sub} LIMIT 1
  `;
  if (!result || result.length === 0) throw new AppError(404, 'Employee not found');
  
  const employee = result[0];
  const valid = await bcrypt.compare(currentPassword, employee.passwordHash ?? '');
  if (!valid) throw new AppError(401, 'Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.$executeRaw`
    UPDATE "Employee" SET "passwordHash" = ${hash} WHERE id = ${req.user!.sub}
  `;
  res.json({ message: 'Password updated' });
}
