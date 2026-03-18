import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getStats, getNextBatchNo, getGraders, getDrivers,
  getReceipts, createReceipt, deleteReceipt,
  getBatches, createBatch, updateBatch, deleteBatch,
  getDeliveries, createDelivery, deleteDelivery,
  getLiquidGrid, saveLiquid, deleteLiquid, chargeLoss, getLiquidExcel,
} from '../controllers/factory.controller';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/stats', getStats);
router.get('/next-batch-no', getNextBatchNo);
router.get('/graders', getGraders);
router.get('/drivers', getDrivers);

router.get('/receipts', getReceipts);
router.post('/receipts', createReceipt);
router.delete('/receipts/:id', deleteReceipt);

router.get('/batches', getBatches);
router.post('/batches', createBatch);
router.put('/batches/:id', updateBatch);
router.delete('/batches/:id', deleteBatch);

router.get('/deliveries', getDeliveries);
router.post('/deliveries', createDelivery);
router.delete('/deliveries/:id', deleteDelivery);

router.get('/liquid', getLiquidGrid);
router.post('/liquid', saveLiquid);
router.delete('/liquid/:id', deleteLiquid);
router.post('/liquid/charge', chargeLoss);
router.get('/liquid/excel', getLiquidExcel);

// GET grader check — auto-fetch collected vs received
router.get('/liquid/grader-check', async (req, res) => {
  const { graderId, date } = req.query;
  if (!graderId || !date) return res.status(400).json({ error: 'graderId and date required' });

  const d = new Date(String(date));
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);

  const grader = await prisma.employee.findUnique({
    where: { id: Number(graderId) },
    include: { supervisedRoutes: { select: { id: true, code: true, name: true } } },
  });
  if (!grader) return res.status(404).json({ error: 'Grader not found' });

  const route = grader.supervisedRoutes[0] ?? null;

  // Search by graderId OR routeId — catches both direct and route-synced collections
  const collectionWhere: any = {
    collectedAt: { gte: d, lt: next },
    OR: [
      { graderId: Number(graderId) },
      ...(route ? [{ routeId: route.id }] : []),
    ],
  };

  const [collectedAgg, receivedAgg, breakdown] = await Promise.all([
    prisma.milkCollection.aggregate({
      where: collectionWhere,
      _sum: { litres: true },
      _count: { id: true },
    }),
    prisma.factoryReceipt.aggregate({
      where: { graderId: Number(graderId), receivedAt: { gte: d, lt: next } },
      _sum: { litres: true },
    }),
    prisma.milkCollection.findMany({
      where: collectionWhere,
      include: { farmer: { select: { code: true, name: true } } },
      orderBy: { litres: 'desc' },
    }),
  ]);

  const totalCollected = Number(collectedAgg._sum.litres || 0);
  const totalReceived  = Number(receivedAgg._sum.litres || 0);
  const variance       = totalReceived - totalCollected;

  let existingRecord = null;
  if (route) {
    existingRecord = await prisma.liquidRecord.findUnique({
      where: { routeId_recordDate: { routeId: route.id, recordDate: d } },
    }).catch(() => null);
  }

  res.json({
    grader: { id: grader.id, name: grader.name, code: grader.code },
    route,
    date: d.toISOString().split('T')[0],
    totalCollected: parseFloat(totalCollected.toFixed(2)),
    totalReceived:  parseFloat(totalReceived.toFixed(2)),
    variance:       parseFloat(variance.toFixed(2)),
    farmerCount:    collectedAgg._count.id,
    existingRecord,
    breakdown: breakdown.map(c => ({
      farmerCode: c.farmer.code,
      farmerName: c.farmer.name,
      litres: Number(c.litres),
    })),
  });
});

// POST save grader check + optional payroll charge
router.post('/liquid/grader-check', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  try {
  const { graderId, date, totalReceived, notes, chargeVariance, periodMonth, periodYear } = req.body;

  const d = new Date(String(date));
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);

  const grader = await prisma.employee.findUnique({
    where: { id: Number(graderId) },
    include: { supervisedRoutes: true },
  });
  if (!grader) return res.status(404).json({ error: 'Grader not found' });

  const route = grader.supervisedRoutes[0];

  const collectionWhere: any = {
    collectedAt: { gte: d, lt: next },
    OR: [
      { graderId: Number(graderId) },
      ...(route ? [{ routeId: route.id }] : []),
    ],
  };

  const collectedAgg = await prisma.milkCollection.aggregate({
    where: collectionWhere,
    _sum: { litres: true },
  });

  const totalCollected = Number(collectedAgg._sum.litres || 0);
  const received = Number(totalReceived);
  const variance = received - totalCollected;

  let liquidRecord = null;
  if (route) {
    try {
      liquidRecord = await prisma.liquidRecord.upsert({
        where: { routeId_recordDate: { routeId: route.id, recordDate: d } },
        update: { graderId: Number(graderId), received, dispatched: totalCollected, variance, notes: notes || null },
        create: { routeId: route.id, graderId: Number(graderId), recordDate: d, received, dispatched: totalCollected, variance, notes: notes || null },
      });
    } catch (e) {
      console.error('LiquidRecord upsert failed:', e);
    }
  }

  // Charge to payroll if variance is negative
  let varianceRecord = null;
  if (chargeVariance && variance < 0 && periodMonth && periodYear) {
    const amount = Math.abs(variance) * 46;
    try {
      varianceRecord = await prisma.varianceRecord.create({
        data: {
          employeeId:  Number(graderId),
          type:        'GRADER_COLLECTION',
          amount,
          recordDate:  d,
          periodMonth: Number(periodMonth),
          periodYear:  Number(periodYear),
          description: `Liquid variance ${date}: collected ${totalCollected.toFixed(2)}L received ${received.toFixed(2)}L missing ${Math.abs(variance).toFixed(2)}L = KES ${amount.toFixed(2)}`,
          applied:     false,
        },
      });
    } catch (e) {
      console.error('VarianceRecord create failed:', e);
    }
  }

  res.json({ liquidRecord, varianceRecord, totalCollected, totalReceived: received, variance });
  } catch (e: any) {
    console.error('Liquid check save error:', e);
    res.status(500).json({ error: e?.message || 'Failed to save liquid check' });
  }
});

export default router;
