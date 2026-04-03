// src/routes/auth.routes.ts
import { Router } from 'express';
import { login, me, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, changePassword);


// ONE-TIME: Reset director credentials (remove after use)
router.post('/reset-director', async (_req, res) => {
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('gutoria2024', 12);
  // Rename ADMIN001 → DIR001 and reset password
  await prisma.$executeRaw`
    UPDATE "Employee"
    SET code = 'DIR001', "passwordHash" = ${hash}
    WHERE "dairyId" = 1 AND role = 'ADMIN'
    AND code IN ('ADMIN001','DIR001')
  `;
  res.json({ message: 'Director reset: code=DIR001, password=gutoria2024' });
});

export default router;
