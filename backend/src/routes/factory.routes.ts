// src/routes/factory.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// Factory Receipts
router.get('/receipts', async (req, res) => {
  const { date } = req.query;
  const where: any = {};
  if (date) { const d = new Date(String(date)); const n = new Date(d); n.setDate(n.getDate()+1); where.receivedAt = { gte: d, lt: n }; }
  const receipts = await prisma.factoryReceipt.findMany({ where, include: { grader: { select: { id: true, name: true } } }, orderBy: { receivedAt: 'desc' } });
  res.json(receipts);
});
router.post('/receipts', authorize('FACTORY', 'ADMIN'), async (req, res) => {
  const receipt = await prisma.factoryReceipt.create({ data: { ...req.body, receivedAt: new Date(req.body.receivedAt) } });
  res.status(201).json(receipt);
});

// Pasteurization Batches
router.get('/batches', async (_req, res) => {
  const batches = await prisma.pasteurizationBatch.findMany({ include: { deliveries: true }, orderBy: { processedAt: 'desc' } });
  res.json(batches);
});
router.post('/batches', authorize('FACTORY', 'ADMIN'), async (req, res) => {
  const { inputLitres, outputLitres } = req.body;
  const lossLitres = Number(inputLitres) - Number(outputLitres);
  const batch = await prisma.pasteurizationBatch.create({
    data: { ...req.body, lossLitres, processedAt: new Date(req.body.processedAt) },
  });
  res.status(201).json(batch);
});

export default router;

