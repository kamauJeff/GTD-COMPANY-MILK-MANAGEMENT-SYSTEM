import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// GET /api/price-tiers — list configured tiers
router.get('/', authorize('ADMIN','OFFICE'), async (req, res) => {
  // Read from DB config or return defaults
  const config = await prisma.systemConfig.findFirst({ where: { dairyId: req.dairyId!, key: 'price_tiers' } }).catch(() => null);
  const tiers = config ? JSON.parse(config.value) : [
    { minLitresPerDay: 0,   maxLitresPerDay: 49,  pricePerLitre: 46 },
    { minLitresPerDay: 50,  maxLitresPerDay: 99,  pricePerLitre: 50 },
    { minLitresPerDay: 100, maxLitresPerDay: 9999, pricePerLitre: 55 },
  ];
  res.json(tiers);
});

// POST /api/price-tiers — save tiers
router.post('/', authorize('ADMIN'), async (req, res) => {
  const { tiers } = req.body;
  await prisma.systemConfig.upsert({
    where: { key: 'price_tiers' },
    update: { value: JSON.stringify(tiers) },
    create: { key: 'price_tiers', value: JSON.stringify(tiers) },
  });
  res.json({ saved: true, tiers });
});

export default router;
