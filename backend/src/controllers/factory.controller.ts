import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// ─── Factory Stats ────────────────────────────────────────────────────────────
export const getStats = async (req: Request, res: Response) => {
  const { month, year } = req.query;
  const m = parseInt(month as string) || new Date().getMonth() + 1;
  const y = parseInt(year as string) || new Date().getFullYear();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  const [receipts, batches, deliveries] = await Promise.all([
    prisma.factoryReceipt.aggregate({ where: { receivedAt: { gte: start, lte: end } }, _sum: { litres: true }, _count: true }),
    prisma.pasteurizationBatch.aggregate({ where: { processedAt: { gte: start, lte: end } }, _sum: { inputLitres: true, outputLitres: true, lossLitres: true }, _count: true }),
    prisma.deliveryToShop.aggregate({ where: { deliveredAt: { gte: start, lte: end } }, _sum: { litres: true }, _count: true }),
  ]);

  res.json({
    receipts: { total: Number(receipts._sum.litres || 0), count: receipts._count },
    batches: { input: Number(batches._sum.inputLitres || 0), output: Number(batches._sum.outputLitres || 0), loss: Number(batches._sum.lossLitres || 0), count: batches._count },
    deliveries: { total: Number(deliveries._sum.litres || 0), count: deliveries._count },
  });
};

// ─── Next Batch No ────────────────────────────────────────────────────────────
export const getNextBatchNo = async (_req: Request, res: Response) => {
  const last = await prisma.pasteurizationBatch.findFirst({ orderBy: { id: 'desc' } });
  const next = last ? `BATCH-${String(last.id + 1).padStart(4, '0')}` : 'BATCH-0001';
  res.json({ batchNo: next });
};

// ─── Graders list ─────────────────────────────────────────────────────────────
export const getGraders = async (_req: Request, res: Response) => {
  const graders = await prisma.employee.findMany({ where: { role: 'GRADER', isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } });
  res.json(graders);
};

// ─── Drivers list ─────────────────────────────────────────────────────────────
export const getDrivers = async (_req: Request, res: Response) => {
  const drivers = await prisma.employee.findMany({ where: { role: 'DRIVER', isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } });
  res.json(drivers);
};

// ─── Factory Receipts ─────────────────────────────────────────────────────────
export const getReceipts = async (req: Request, res: Response) => {
  const { month, year } = req.query;
  const where: any = {};
  if (month && year) {
    where.receivedAt = { gte: new Date(parseInt(year as string), parseInt(month as string) - 1, 1), lte: new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59) };
  }
  const receipts = await prisma.factoryReceipt.findMany({ where, include: { grader: { select: { id: true, name: true, code: true } } }, orderBy: { receivedAt: 'desc' } });
  res.json(receipts);
};

export const createReceipt = async (req: Request, res: Response) => {
  const { graderId, litres, receivedAt, notes } = req.body;
  const receipt = await prisma.factoryReceipt.create({
    data: { graderId: parseInt(graderId), litres, receivedAt: new Date(receivedAt), notes },
    include: { grader: { select: { id: true, name: true, code: true } } },
  });
  res.json(receipt);
};

export const deleteReceipt = async (req: Request, res: Response) => {
  await prisma.factoryReceipt.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
};

// ─── Pasteurization Batches ───────────────────────────────────────────────────
export const getBatches = async (req: Request, res: Response) => {
  const { month, year } = req.query;
  const where: any = {};
  if (month && year) {
    where.processedAt = { gte: new Date(parseInt(year as string), parseInt(month as string) - 1, 1), lte: new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59) };
  }
  const batches = await prisma.pasteurizationBatch.findMany({ where, orderBy: { processedAt: 'desc' } });
  res.json(batches);
};

export const createBatch = async (req: Request, res: Response) => {
  const { batchNo, inputLitres, outputLitres, lossLitres, processedAt, qualityNotes } = req.body;
  const batch = await prisma.pasteurizationBatch.create({
    data: { batchNo, inputLitres, outputLitres, lossLitres: lossLitres || 0, processedAt: new Date(processedAt), qualityNotes },
  });
  res.json(batch);
};

export const updateBatch = async (req: Request, res: Response) => {
  const { batchNo, inputLitres, outputLitres, lossLitres, qualityNotes } = req.body;
  const batch = await prisma.pasteurizationBatch.update({
    where: { id: parseInt(req.params.id) },
    data: { batchNo, inputLitres, outputLitres, lossLitres, qualityNotes },
  });
  res.json(batch);
};

export const deleteBatch = async (req: Request, res: Response) => {
  await prisma.pasteurizationBatch.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
};

// ─── Deliveries to Shops ──────────────────────────────────────────────────────
export const getDeliveries = async (req: Request, res: Response) => {
  const { month, year } = req.query;
  const where: any = {};
  if (month && year) {
    where.deliveredAt = { gte: new Date(parseInt(year as string), parseInt(month as string) - 1, 1), lte: new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59) };
  }
  const deliveries = await prisma.deliveryToShop.findMany({
    where,
    include: { shop: { select: { id: true, name: true, code: true } }, driver: { select: { id: true, name: true } }, batch: { select: { batchNo: true } } },
    orderBy: { deliveredAt: 'desc' },
  });
  res.json(deliveries);
};

export const createDelivery = async (req: Request, res: Response) => {
  const { batchId, shopId, driverId, litres, sellingPrice, deliveredAt } = req.body;
  const delivery = await prisma.deliveryToShop.create({
    data: { batchId: parseInt(batchId), shopId: parseInt(shopId), driverId: parseInt(driverId), litres, sellingPrice, deliveredAt: new Date(deliveredAt) },
    include: { shop: { select: { id: true, name: true } }, driver: { select: { id: true, name: true } } },
  });
  res.json(delivery);
};

export const deleteDelivery = async (req: Request, res: Response) => {
  await prisma.deliveryToShop.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
};

// ─── Liquid Ledger ────────────────────────────────────────────────────────────
export const getLiquidGrid = async (req: Request, res: Response) => {
  const { month, year } = req.query;
  const m = parseInt(month as string) || new Date().getMonth() + 1;
  const y = parseInt(year as string) || new Date().getFullYear();
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  const records = await prisma.liquidRecord.findMany({
    where: { recordDate: { gte: start, lte: end } },
    include: {
      route: { select: { id: true, code: true, name: true } },
      grader: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ recordDate: 'asc' }, { route: { code: 'asc' } }],
  });

  // Build grid: routes × days
  const routes = await prisma.route.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } });
  const grid: Record<string, any> = {};

  for (const route of routes) {
    grid[route.code] = { route, days: {} };
  }

  for (const r of records) {
    const day = new Date(r.recordDate).getDate();
    const code = r.route.code;
    if (grid[code]) {
      grid[code].days[day] = {
        id: r.id,
        received: Number(r.received),
        dispatched: Number(r.dispatched),
        variance: Number(r.variance),
        notes: r.notes,
        grader: r.grader,
      };
    }
  }

  res.json({ grid: Object.values(grid), month: m, year: y });
};

export const saveLiquid = async (req: Request, res: Response) => {
  const { routeId, graderId, recordDate, received, dispatched, notes } = req.body;
  const date = new Date(recordDate);
  const variance = Number(received || 0) - Number(dispatched || 0);

  const record = await prisma.liquidRecord.upsert({
    where: { routeId_recordDate: { routeId: parseInt(routeId), recordDate: date } },
    update: { graderId: graderId ? parseInt(graderId) : null, received: received || 0, dispatched: dispatched || 0, variance, notes },
    create: { routeId: parseInt(routeId), graderId: graderId ? parseInt(graderId) : null, recordDate: date, received: received || 0, dispatched: dispatched || 0, variance, notes },
    include: { route: { select: { code: true, name: true } }, grader: { select: { name: true } } },
  });

  res.json(record);
};

export const deleteLiquid = async (req: Request, res: Response) => {
  await prisma.liquidRecord.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
};

export const chargeLoss = async (req: Request, res: Response) => {
  const { employeeId, amount, periodMonth, periodYear, description } = req.body;
  const record = await prisma.varianceRecord.create({
    data: { employeeId: parseInt(employeeId), type: 'GRADER_COLLECTION', amount, recordDate: new Date(), periodMonth: parseInt(periodMonth), periodYear: parseInt(periodYear), description },
  });
  res.json(record);
};

export const getLiquidExcel = async (req: Request, res: Response) => {
  // Return JSON for now - Excel export can be added later
  const { month, year } = req.query;
  res.json({ message: 'Excel export coming soon', month, year });
};
