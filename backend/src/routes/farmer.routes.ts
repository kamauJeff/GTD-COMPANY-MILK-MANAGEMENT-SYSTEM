import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import { getFarmers, getFarmer, createFarmer, updateFarmer, deleteFarmer, importFarmers, exportFarmers, fixPhoneNumbers } from '../controllers/farmer.controller';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
router.use(authenticate);

router.get('/', getFarmers);
router.get('/export', exportFarmers);
router.post('/fix-phones', authorize('ADMIN'), fixPhoneNumbers);
router.get('/:id', getFarmer);
router.post('/', authorize('ADMIN', 'OFFICE'), createFarmer);
router.put('/:id', authorize('ADMIN', 'OFFICE'), updateFarmer);
router.delete('/:id', authorize('ADMIN'), deleteFarmer);
router.post('/import', authorize('ADMIN', 'OFFICE'), upload.single('file'), importFarmers);

export default router;

// POST /api/farmers/set-price — bulk update price for all or selected farmers
router.post('/set-price', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { pricePerLitre, farmerIds, routeId } = req.body;
  const price = Number(pricePerLitre);
  if (!price || price < 1) return res.status(400).json({ error: 'Invalid price' });

  const where: any = {};
  if (farmerIds?.length) {
    where.id = { in: farmerIds.map(Number) };
  } else if (routeId) {
    where.routeId = Number(routeId);
  }
  // If neither, update ALL farmers

  const result = await prisma.farmer.updateMany({ where, data: { pricePerLitre: price } });
  res.json({ updated: result.count, price });
});

// GET /api/farmers/price-summary — show price distribution
router.get('/price-summary', authorize('ADMIN', 'OFFICE'), async (_req, res) => {
  const farmers = await prisma.farmer.findMany({
    where: { isActive: true },
    select: { pricePerLitre: true, route: { select: { name: true } } },
  });

  const byPrice: Record<number, { count: number; routes: Set<string> }> = {};
  for (const f of farmers) {
    const p = Number(f.pricePerLitre);
    if (!byPrice[p]) byPrice[p] = { count: 0, routes: new Set() };
    byPrice[p].count++;
    if (f.route?.name) byPrice[p].routes.add(f.route.name);
  }

  const summary = Object.entries(byPrice).map(([price, data]) => ({
    price: Number(price),
    count: data.count,
    routes: Array.from(data.routes),
  })).sort((a, b) => b.count - a.count);

  res.json({ summary, total: farmers.length });
});
