// src/routes/auth.routes.ts
import { Router } from 'express';
import { login, me, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, changePassword);

// ONE-TIME: Reset director credentials — call once then remove
router.post('/reset-director', async (_req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('gutoria2024', 12);

    // First check what employee accounts exist on dairyId=1
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id, code, role, "dairyId",
        CASE WHEN "passwordHash" IS NOT NULL THEN true ELSE false END AS has_hash
      FROM "Employee" WHERE "dairyId" = 1 ORDER BY role DESC
    `;

    // Update: if DIR001 exists use it, else rename ADMIN001
    const dir001 = existing.find((e: any) => e.code === 'DIR001' && e.role === 'ADMIN');
    const admin001 = existing.find((e: any) => e.code === 'ADMIN001' && e.role === 'ADMIN');

    let targetId: number | null = null;
    if (dir001) targetId = dir001.id;
    else if (admin001) targetId = admin001.id;

    if (!targetId) {
      return res.json({
        message: 'No ADMIN employee found on dairyId=1',
        employees: existing,
      });
    }

    await prisma.$executeRaw`
      UPDATE "Employee"
      SET code = 'DIR001', "passwordHash" = ${hash}
      WHERE id = ${targetId}
    `;

    res.json({
      message: 'Director reset done',
      login: { code: 'DIR001', password: 'gutoria2024' },
      updatedId: targetId,
      allEmployees: existing,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DEBUG: Check all employees on dairyId=1 (remove after use)
router.get('/debug-employees', async (_req, res) => {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, code, name, role, "dairyId", "isActive",
        CASE WHEN "passwordHash" IS NOT NULL THEN true ELSE false END AS has_hash
      FROM "Employee" WHERE "dairyId" = 1 ORDER BY role DESC
    `;
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
