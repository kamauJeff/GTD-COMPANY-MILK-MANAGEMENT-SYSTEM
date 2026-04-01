import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export async function login(req: Request, res: Response) {
  const { code, password } = req.body;
  if (!code || !password) throw new AppError(400, 'code and password are required');

  // Fetch employee WITH dairyId
  const result = await prisma.$queryRaw<any[]>`
    SELECT id, code, name, role, "passwordHash", "dairyId"
    FROM "Employee"
    WHERE UPPER(code) = ${code.toUpperCase()} AND "isActive" = true
    LIMIT 1
  `;

  if (!result || result.length === 0) throw new AppError(401, 'Invalid credentials');

  const employee = result[0];
  if (!employee.passwordHash) throw new AppError(401, 'Account not set up. Contact admin.');

  const valid = await bcrypt.compare(password, employee.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  // Fetch dairy info for the token
  const dairyResult = await prisma.$queryRaw<any[]>`
    SELECT id, name, slug, plan, status FROM "Dairy" WHERE id = ${employee.dairyId} LIMIT 1
  `;
  const dairy = dairyResult[0] || { id: employee.dairyId, name: 'Unknown', slug: 'unknown' };

  // JWT now includes dairyId — scopes every request to the right tenant
  const token = jwt.sign(
    {
      sub:     employee.id,
      dairyId: employee.dairyId,
      role:    employee.role,
      name:    employee.name,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
  );

  res.json({
    token,
    employee: {
      id:      employee.id,
      name:    employee.name,
      role:    employee.role,
      code:    employee.code,
      dairyId: employee.dairyId,
    },
    dairy: {
      id:     dairy.id,
      name:   dairy.name,
      slug:   dairy.slug,
      plan:   dairy.plan,
      status: dairy.status,
    },
  });
}

export async function me(req: Request, res: Response) {
  const result = await prisma.$queryRaw<any[]>`
    SELECT e.id, e.code, e.name, e.phone, e.role, e."dairyId",
           d.name AS "dairyName", d.slug AS "dairySlug"
    FROM "Employee" e
    JOIN "Dairy" d ON d.id = e."dairyId"
    WHERE e.id = ${req.user!.sub}
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
