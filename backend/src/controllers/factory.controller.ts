// src/controllers/factory.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

// ── Helper ────────────────────────────────────────────────────
function dayRange(dateStr: string) {
  const d = new Date(dateStr);
  const n = new Date(d); n.setDate(n.getDate() + 1);
  return { gte: d, lt: n };
}
function monthRange(month: number, year: number) {
  return { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
}

// ═══════════════════════════════════════════════════════════════
// RECEIPTS
// ═══════════════════════════════════════════════════════════════
export async function listReceipts(req: Request, res: Response) {
  const { month, year, date } = req.query;
  const where: any = {};
  if (date)        where.receivedAt = dayRange(String(date));
  else if (month && year) where.receivedAt = monthRange(Number(month), Number(year));

  const receipts = await prisma.factoryReceipt.findMany({
    where,
    include: { grader: { select: { id: true, name: true, code: true } } },
    orderBy: { receivedAt: 'desc' },
  });
  res.json(receipts);
}

export async function createReceipt(req: Request, res: Response) {
  const { graderId, litres, receivedAt, notes } = req.body;
  if (!graderId || !litres || !receivedAt) throw new AppError(400, 'graderId, litres, receivedAt required');
  const receipt = await prisma.factoryReceipt.create({
    data: { graderId: Number(graderId), litres: Number(litres), receivedAt: new Date(receivedAt), notes },
    include: { grader: { select: { id: true, name: true, code: true } } },
  });
  res.status(201).json(receipt);
}

export async function deleteReceipt(req: Request, res: Response) {
  await prisma.factoryReceipt.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// BATCHES
// ═══════════════════════════════════════════════════════════════
export async function listBatches(req: Request, res: Response) {
  const { month, year } = req.query;
  const where: any = {};
  if (month && year) where.processedAt = monthRange(Number(month), Number(year));

  const batches = await prisma.pasteurizationBatch.findMany({
    where,
    include: {
      deliveries: {
        include: {
          shop:   { select: { id: true, name: true, code: true } },
          driver: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { processedAt: 'desc' },
  });
  res.json(batches);
}

export async function createBatch(req: Request, res: Response) {
  const { batchNo, inputLitres, outputLitres, processedAt, qualityNotes } = req.body;
  if (!batchNo || !inputLitres || !outputLitres || !processedAt)
    throw new AppError(400, 'batchNo, inputLitres, outputLitres, processedAt required');

  // Auto-generate batchNo if not provided
  const lossLitres = Math.max(0, Number(inputLitres) - Number(outputLitres));
  const batch = await prisma.pasteurizationBatch.create({
    data: {
      batchNo, inputLitres: Number(inputLitres),
      outputLitres: Number(outputLitres), lossLitres,
      processedAt: new Date(processedAt), qualityNotes,
    },
    include: { deliveries: true },
  });
  res.status(201).json(batch);
}

export async function updateBatch(req: Request, res: Response) {
  const { inputLitres, outputLitres, processedAt, qualityNotes } = req.body;
  const lossLitres = inputLitres && outputLitres
    ? Math.max(0, Number(inputLitres) - Number(outputLitres)) : undefined;
  const batch = await prisma.pasteurizationBatch.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(inputLitres   && { inputLitres: Number(inputLitres) }),
      ...(outputLitres  && { outputLitres: Number(outputLitres) }),
      ...(lossLitres !== undefined && { lossLitres }),
      ...(processedAt   && { processedAt: new Date(processedAt) }),
      ...(qualityNotes !== undefined && { qualityNotes }),
    },
    include: { deliveries: true },
  });
  res.json(batch);
}

export async function deleteBatch(req: Request, res: Response) {
  const deliveries = await prisma.deliveryToShop.count({ where: { batchId: Number(req.params.id) } });
  if (deliveries > 0) throw new AppError(400, 'Cannot delete batch with deliveries — remove deliveries first');
  await prisma.pasteurizationBatch.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// DELIVERIES
// ═══════════════════════════════════════════════════════════════
export async function listDeliveries(req: Request, res: Response) {
  const { month, year, batchId } = req.query;
  const where: any = {};
  if (batchId)          where.batchId = Number(batchId);
  if (month && year)    where.deliveredAt = monthRange(Number(month), Number(year));

  const deliveries = await prisma.deliveryToShop.findMany({
    where,
    include: {
      batch:  { select: { id: true, batchNo: true } },
      shop:   { select: { id: true, name: true, code: true } },
      driver: { select: { id: true, name: true } },
    },
    orderBy: { deliveredAt: 'desc' },
  });
  res.json(deliveries);
}

export async function createDelivery(req: Request, res: Response) {
  const { batchId, shopId, driverId, litres, sellingPrice, deliveredAt } = req.body;
  if (!batchId || !shopId || !driverId || !litres || !sellingPrice || !deliveredAt)
    throw new AppError(400, 'All fields required');

  // Check batch has enough undelivered litres
  const batch = await prisma.pasteurizationBatch.findUnique({ where: { id: Number(batchId) }, include: { deliveries: true } });
  if (!batch) throw new AppError(404, 'Batch not found');
  const deliveredSoFar = batch.deliveries.reduce((s, d) => s + Number(d.litres), 0);
  const remaining = Number(batch.outputLitres) - deliveredSoFar;
  if (Number(litres) > remaining)
    throw new AppError(400, `Only ${remaining.toFixed(1)}L remaining in batch ${batch.batchNo}`);

  const delivery = await prisma.deliveryToShop.create({
    data: {
      batchId: Number(batchId), shopId: Number(shopId), driverId: Number(driverId),
      litres: Number(litres), sellingPrice: Number(sellingPrice),
      deliveredAt: new Date(deliveredAt),
    },
    include: {
      batch:  { select: { id: true, batchNo: true } },
      shop:   { select: { id: true, name: true, code: true } },
      driver: { select: { id: true, name: true } },
    },
  });
  res.status(201).json(delivery);
}

export async function deleteDelivery(req: Request, res: Response) {
  await prisma.deliveryToShop.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// STATS — dashboard summary for a month
// ═══════════════════════════════════════════════════════════════
export async function factoryStats(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');
  const range = monthRange(Number(month), Number(year));

  const [receipts, batches, deliveries, graders, shops] = await Promise.all([
    prisma.factoryReceipt.findMany({ where: { receivedAt: range }, select: { litres: true } }),
    prisma.pasteurizationBatch.findMany({
      where: { processedAt: range },
      select: { inputLitres: true, outputLitres: true, lossLitres: true },
    }),
    prisma.deliveryToShop.findMany({
      where: { deliveredAt: range },
      select: { litres: true, sellingPrice: true },
    }),
    prisma.employee.count({ where: { role: 'GRADER', isActive: true } }),
    prisma.shop.count({}),
  ]);

  const totalReceived   = receipts.reduce((s, r) => s + Number(r.litres), 0);
  const totalInput      = batches.reduce((s, b) => s + Number(b.inputLitres), 0);
  const totalOutput     = batches.reduce((s, b) => s + Number(b.outputLitres), 0);
  const totalLoss       = batches.reduce((s, b) => s + Number(b.lossLitres), 0);
  const totalDelivered  = deliveries.reduce((s, d) => s + Number(d.litres), 0);
  const totalRevenue    = deliveries.reduce((s, d) => s + Number(d.litres) * Number(d.sellingPrice), 0);
  const efficiencyPct   = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
  const undelivered     = totalOutput - totalDelivered;

  res.json({
    totalReceived, totalInput, totalOutput, totalLoss,
    totalDelivered, totalRevenue, efficiencyPct: Number(efficiencyPct.toFixed(1)),
    undelivered: Number(undelivered.toFixed(1)),
    batchCount: batches.length, graders, shops,
  });
}

// ── Auto batch number ──────────────────────────────────────────
export async function nextBatchNo(req: Request, res: Response) {
  const last = await prisma.pasteurizationBatch.findFirst({ orderBy: { id: 'desc' }, select: { batchNo: true } });
  const num = last ? Number(last.batchNo.replace(/\D/g, '')) + 1 : 1;
  res.json({ batchNo: `BATCH-${String(num).padStart(4, '0')}` });
}

// ── List graders (for receipt form) ───────────────────────────
export async function listGraders(req: Request, res: Response) {
  const graders = await prisma.employee.findMany({
    where: { role: 'GRADER', isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  res.json(graders);
}

// ── List drivers (for delivery form) ──────────────────────────
export async function listDrivers(req: Request, res: Response) {
  const drivers = await prisma.employee.findMany({
    where: { role: { in: ['DRIVER', 'GRADER', 'FACTORY'] }, isActive: true },
    select: { id: true, name: true, code: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json(drivers);
}


// ═══════════════════════════════════════════════════════════════
// LIQUID RECONCILIATION
// One row per route. Journal = sum of collections from that route
// for the day. Liquid = manually entered (what arrived at factory).
// Diff = Liquid - Journal  (negative = loss, grader to be charged)
// ═══════════════════════════════════════════════════════════════

// GET /factory/liquid?month=&year=
export async function getLiquidGrid(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');
  const m = Number(month), y = Number(year);
  const range = monthRange(m, y);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // All routes (ordered by code)
  const routes = await prisma.route.findMany({
    include: { supervisor: { select: { id: true, name: true, code: true } } },
    orderBy: { code: 'asc' },
  });

  // Daily collection totals per route for the month
  const collections = await prisma.milkCollection.findMany({
    where: { collectedAt: range },
    select: { routeId: true, litres: true, collectedAt: true },
  });

  // Saved liquid records for the month
  const liquidRecords = await prisma.liquidRecord.findMany({
    where: { recordDate: range },
    select: { routeId: true, graderId: true, recordDate: true, liquidL: true, id: true },
  });

  const grid = routes.map(route => {
    // Build journal days from collections
    const journalDays: Record<number, number> = {};
    days.forEach(d => { journalDays[d] = 0; });
    collections
      .filter(c => c.routeId === route.id)
      .forEach(c => {
        const d = new Date(c.collectedAt).getDate();
        journalDays[d] = +(journalDays[d] + Number(c.litres)).toFixed(1);
      });

    // Liquid days from saved records
    const liquidDays: Record<number, number | null> = {};
    days.forEach(d => { liquidDays[d] = null; });
    liquidRecords
      .filter(r => r.routeId === route.id)
      .forEach(r => {
        liquidDays[new Date(r.recordDate).getDate()] = +Number(r.liquidL).toFixed(1);
      });

    // Compute diffs
    const diffDays: Record<number, number | null> = {};
    days.forEach(d => {
      diffDays[d] = liquidDays[d] !== null
        ? +( liquidDays[d]! - journalDays[d] ).toFixed(1)
        : null;
    });

    const totalJournal = +days.reduce((s, d) => s + journalDays[d], 0).toFixed(1);
    const liquidEntered= liquidRecords.filter(r => r.routeId === route.id);
    const totalLiquid  = +liquidEntered.reduce((s, r) => s + Number(r.liquidL), 0).toFixed(1);
    const totalDiff    = +(totalLiquid - totalJournal).toFixed(1);

    const midJournal = +days.filter(d => d <= 15).reduce((s, d) => s + journalDays[d], 0).toFixed(1);
    const midLiquid  = +liquidEntered.filter(r => new Date(r.recordDate).getDate() <= 15)
                         .reduce((s, r) => s + Number(r.liquidL), 0).toFixed(1);
    const endJournal = +days.filter(d => d > 15).reduce((s, d) => s + journalDays[d], 0).toFixed(1);
    const endLiquid  = +liquidEntered.filter(r => new Date(r.recordDate).getDate() > 15)
                         .reduce((s, r) => s + Number(r.liquidL), 0).toFixed(1);

    return {
      route: { id: route.id, code: route.code, name: route.name },
      grader: route.supervisor ?? null,
      journalDays,
      liquidDays,
      diffDays,
      totals: {
        totalJournal, totalLiquid, totalDiff,
        midJournal, midLiquid, midDiff: +(midLiquid - midJournal).toFixed(1),
        endJournal, endLiquid, endDiff: +(endLiquid - endJournal).toFixed(1),
      },
    };
  });

  // Grand totals
  const grandJournal = +grid.reduce((s, r) => s + r.totals.totalJournal, 0).toFixed(1);
  const grandLiquid  = +grid.reduce((s, r) => s + r.totals.totalLiquid,  0).toFixed(1);
  const grandDiff    = +(grandLiquid - grandJournal).toFixed(1);

  res.json({ month: m, year: y, daysInMonth, data: grid, grandJournal, grandLiquid, grandDiff });
}

// POST /factory/liquid — upsert a day's liquid reading for a route
export async function saveLiquidRecord(req: Request, res: Response) {
  const { routeId, recordDate, liquidL, notes } = req.body;
  if (!routeId || !recordDate || liquidL === undefined)
    throw new AppError(400, 'routeId, recordDate, liquidL required');

  const date = new Date(recordDate);
  // Normalise to midnight UTC
  date.setUTCHours(0, 0, 0, 0);
  const next = new Date(date); next.setDate(next.getDate() + 1);

  // Journal = total collections for this route on this day
  const cols = await prisma.milkCollection.findMany({
    where: { routeId: Number(routeId), collectedAt: { gte: date, lt: next } },
    select: { litres: true },
  });
  const journalL = +cols.reduce((s, c) => s + Number(c.litres), 0).toFixed(1);
  const diffL    = +(Number(liquidL) - journalL).toFixed(1);

  // Get route supervisor (grader) for the record
  const route = await prisma.route.findUnique({
    where: { id: Number(routeId) },
    select: { supervisorId: true },
  });
  const graderId = route?.supervisorId ?? null;

  // Find existing record for this route+date (bypass unique key issues when no supervisor)
  const existing = await prisma.liquidRecord.findFirst({
    where: { routeId: Number(routeId), recordDate: date },
  });

  let record;
  if (existing) {
    record = await prisma.liquidRecord.update({
      where: { id: existing.id },
      data: { liquidL: Number(liquidL), diffL },
    });
  } else {
    record = await prisma.liquidRecord.create({
      data: {
        graderId:   graderId ?? null,
        routeId:    Number(routeId),
        recordDate: date,
        journalL,
        liquidL:    Number(liquidL),
        diffL,
      },
    });
  }
  res.json({ ...record, journalL, diffL });
}

// DELETE /factory/liquid/:id — clear a liquid entry
export async function deleteLiquidRecord(req: Request, res: Response) {
  await prisma.liquidRecord.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}

// POST /factory/liquid/charge — add a variance deduction against a grader
export async function chargeLiquidLoss(req: Request, res: Response) {
  const { graderId, month, year, amount, description } = req.body;
  if (!graderId || !month || !year || !amount)
    throw new AppError(400, 'graderId, month, year, amount required');

  // Find an active grader employee
  const grader = await prisma.employee.findUnique({ where: { id: Number(graderId) } });
  if (!grader) throw new AppError(404, 'Grader not found');

  const record = await prisma.varianceRecord.create({
    data: {
      employeeId:  Number(graderId),
      type:        'GRADER_COLLECTION',
      amount:      Number(amount),
      recordDate:  new Date(),
      periodMonth: Number(month),
      periodYear:  Number(year),
      description: description ?? `Liquid loss charge — ${month}/${year}`,
      applied:     false,
    },
  });
  res.status(201).json(record);
}

// GET /factory/liquid/excel?month=&year=
export async function liquidExcel(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');
  const m = Number(month), y = Number(year);
  const MONTHS_LBL = ['','January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  const range = monthRange(m, y);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const routes = await prisma.route.findMany({
    include: { supervisor: { select: { name: true } } },
    orderBy: { code: 'asc' },
  });
  const collections = await prisma.milkCollection.findMany({
    where: { collectedAt: range },
    select: { routeId: true, litres: true, collectedAt: true },
  });
  const liquidRecords = await prisma.liquidRecord.findMany({
    where: { recordDate: range },
    select: { routeId: true, recordDate: true, liquidL: true },
  });

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Liquid ${MONTHS_LBL[m]} ${y}`);

  // Header row 1 — day numbers (merged per triplet)
  const r1Data: any[] = ['#', 'ROUTE', 'GRADER'];
  days.forEach(d => { r1Data.push(d, null, null); });
  r1Data.push('1–15th', null, null, '16–end', null, null, 'TOTAL', null, null);
  const r1 = ws.addRow(r1Data);
  r1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  r1.height = 18;
  // Merge day triplets
  days.forEach((_, i) => {
    const c = 4 + i * 3;
    ws.mergeCells(1, c, 1, c + 2);
  });
  // Merge summary triplets
  const sc = 4 + days.length * 3;
  [[0,2],[3,5],[6,8]].forEach(([s, e]) => ws.mergeCells(1, sc + s, 1, sc + e));

  // Header row 2 — J / L / Diff subheads
  const r2Data: any[] = ['', '', ''];
  days.forEach(() => r2Data.push('Journal', 'Liquid', 'Diff'));
  r2Data.push('Journal','Liquid','Diff','Journal','Liquid','Diff','Journal','Liquid','Diff');
  const r2 = ws.addRow(r2Data);
  r2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  r2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

  ws.columns = [
    { key: 'no',    width: 4  },
    { key: 'route', width: 18 },
    { key: 'grader',width: 16 },
    ...days.flatMap(d => ([{ key: `j${d}`, width: 6 }, { key: `l${d}`, width: 6 }, { key: `df${d}`, width: 6 }])),
    ...[...Array(9)].map(() => ({ width: 9 })),
  ];

  // Data rows
  routes.forEach((route, idx) => {
    const jDays: Record<number, number> = {};
    days.forEach(d => { jDays[d] = 0; });
    collections.filter(c => c.routeId === route.id).forEach(c => {
      const d = new Date(c.collectedAt).getDate();
      jDays[d] = +(jDays[d] + Number(c.litres)).toFixed(1);
    });
    const lDays: Record<number, number | null> = {};
    days.forEach(d => { lDays[d] = null; });
    liquidRecords.filter(r => r.routeId === route.id).forEach(r => {
      lDays[new Date(r.recordDate).getDate()] = +Number(r.liquidL).toFixed(1);
    });

    const midJ = +days.filter(d => d <= 15).reduce((s, d) => s + jDays[d], 0).toFixed(1);
    const midL = +liquidRecords.filter(r => r.routeId === route.id && new Date(r.recordDate).getDate() <= 15).reduce((s, r) => s + Number(r.liquidL), 0).toFixed(1);
    const endJ = +days.filter(d => d > 15).reduce((s, d) => s + jDays[d], 0).toFixed(1);
    const endL = +liquidRecords.filter(r => r.routeId === route.id && new Date(r.recordDate).getDate() > 15).reduce((s, r) => s + Number(r.liquidL), 0).toFixed(1);
    const totJ = +(midJ + endJ).toFixed(1);
    const totL = +(midL + endL).toFixed(1);

    const rowData: any[] = [idx + 1, route.name, route.supervisor?.name ?? '—'];
    days.forEach(d => {
      const j = jDays[d]; const l = lDays[d];
      rowData.push(j || '', l ?? '', l !== null ? +(l - j).toFixed(1) : '');
    });
    rowData.push(
      midJ || '', midL || '', midL ? +(midL - midJ).toFixed(1) : '',
      endJ || '', endL || '', endL ? +(endL - endJ).toFixed(1) : '',
      totJ || '', totL || '', totL ? +(totL - totJ).toFixed(1) : '',
    );

    const row = ws.addRow(rowData);
    row.height = 15;
    if (idx % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };

    // Colour diff cells
    const colorDiff = (col: number, diff: number | string) => {
      if (diff === '' || diff === null) return;
      const cell = row.getCell(col);
      const n = Number(diff);
      cell.font = { color: { argb: n < -1 ? 'FFDC2626' : n > 1 ? 'FF16A34A' : 'FF6B7280' }, bold: Math.abs(n) > 10 };
    };
    days.forEach((_, i) => colorDiff(4 + i * 3 + 2, rowData[3 + i * 3 + 2]));
    [sc + 2, sc + 5, sc + 8].forEach(c => colorDiff(c, rowData[c - 1]));
  });

  // Totals row
  const totRow = ws.addRow([
    'TOTAL', '', '',
    ...days.flatMap(d => {
      const j = routes.reduce((s, rt) => {
        const dc = collections.filter(c => c.routeId === rt.id && new Date(c.collectedAt).getDate() === d);
        return +(s + dc.reduce((a, c) => a + Number(c.litres), 0)).toFixed(1);
      }, 0);
      const l = routes.reduce((s, rt) => {
        const lr = liquidRecords.find(r => r.routeId === rt.id && new Date(r.recordDate).getDate() === d);
        return lr ? +(s + Number(lr.liquidL)).toFixed(1) : s;
      }, 0);
      return [j || '', l || '', l ? +(l - j).toFixed(1) : ''];
    }),
    ...Array(9).fill(''),
  ]);
  totRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 2 }];

  const filename = `Liquid_${MONTHS_LBL[m]}_${y}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res); res.end();
}
