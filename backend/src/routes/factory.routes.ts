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

// Grader liquid check - auto-fetch collected vs received
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

  // Total collected by grader from farmers on this date
  const collectedAgg = await prisma.milkCollection.aggregate({
    where: { graderId: Number(graderId), collectedAt: { gte: d, lt: next } },
    _sum: { litres: true },
    _count: { id: true },
  });
  const totalCollected = Number(collectedAgg._sum.litres || 0);

  // Total received at factory from this grader on this date
  const receivedAgg = await prisma.factoryReceipt.aggregate({
    where: { graderId: Number(graderId), receivedAt: { gte: d, lt: next } },
    _sum: { litres: true },
  });
  const totalReceived = Number(receivedAgg._sum.litres || 0);

  // Check existing liquid record
  const route = grader.supervisedRoutes[0];
  let existingRecord = null;
  if (route) {
    existingRecord = await prisma.liquidRecord.findUnique({
      where: { routeId_recordDate: { routeId: route.id, recordDate: d } },
    });
  }

  const variance = totalReceived - totalCollected;

  // Farmer breakdown
  const breakdown = await prisma.milkCollection.findMany({
    where: { graderId: Number(graderId), collectedAt: { gte: d, lt: next } },
    include: { farmer: { select: { code: true, name: true } } },
    orderBy: { litres: 'desc' },
  });

  res.json({
    grader: { id: grader.id, name: grader.name, code: grader.code },
    route,
    date: d.toISOString().split('T')[0],
    totalCollected: parseFloat(totalCollected.toFixed(2)),
    totalReceived: parseFloat(totalReceived.toFixed(2)),
    variance: parseFloat(variance.toFixed(2)),
    farmerCount: collectedAgg._count.id,
    existingRecord,
    breakdown: breakdown.map(c => ({
      farmerCode: c.farmer.code,
      farmerName: c.farmer.name,
      litres: Number(c.litres),
    })),
  });
});

// Save liquid check with auto variance + optional payroll charge
router.post('/liquid/grader-check', authorize('ADMIN', 'OFFICE'), async (req, res) => {
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

  // Get total collected
  const collectedAgg = await prisma.milkCollection.aggregate({
    where: { graderId: Number(graderId), collectedAt: { gte: d, lt: next } },
    _sum: { litres: true },
  });
  const totalCollected = Number(collectedAgg._sum.litres || 0);
  const received = Number(totalReceived);
  const variance = received - totalCollected;

  // Save/update liquid record
  let liquidRecord = null;
  if (route) {
    liquidRecord = await prisma.liquidRecord.upsert({
      where: { routeId_recordDate: { routeId: route.id, recordDate: d } },
      update: { graderId: Number(graderId), received, dispatched: totalCollected, variance, notes },
      create: { routeId: route.id, graderId: Number(graderId), recordDate: d, received, dispatched: totalCollected, variance, notes },
    });
  }

  // Charge variance to payroll if requested and variance is negative
  let varianceRecord = null;
  if (chargeVariance && variance < 0 && periodMonth && periodYear) {
    const amount = Math.abs(variance) * 46; // KES value of missing litres
    varianceRecord = await prisma.varianceRecord.create({
      data: {
        employeeId: Number(graderId),
        type: 'GRADER_COLLECTION',
        amount,
        recordDate: d,
        periodMonth: Number(periodMonth),
        periodYear: Number(periodYear),
        description: `Liquid variance on ${date}: collected ${totalCollected.toFixed(2)}L, received ${received.toFixed(2)}L, missing ${Math.abs(variance).toFixed(2)}L = KES ${amount.toFixed(2)}`,
        applied: false,
      },
    });
  }

  res.json({ liquidRecord, varianceRecord, totalCollected, totalReceived: received, variance });
});

export default router;
