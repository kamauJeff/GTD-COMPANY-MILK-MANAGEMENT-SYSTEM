// src/controllers/report.controller.ts
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

const MONTHS = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];

// ═══════════════════════════════════════════════════════════════
// 1. MONTHLY COLLECTION GRID
//    rows = farmers, cols = days 1–31, cells = litres
// ═══════════════════════════════════════════════════════════════
export async function collectionGrid(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');

  const m = Number(month), y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);
  const daysInMonth = new Date(y, m, 0).getDate();

  const where: any = { collectedAt: { gte: start, lt: end } };
  if (routeId) where.routeId = Number(routeId);

  const collections = await prisma.milkCollection.findMany({
    where,
    select: { farmerId: true, litres: true, collectedAt: true, farmer: { select: { id: true, code: true, name: true, pricePerLitre: true, route: { select: { name: true } } } } },
  });

  const farmerMap = new Map<number, any>();
  collections.forEach(c => { if (!farmerMap.has(c.farmerId)) farmerMap.set(c.farmerId, c.farmer); });
  const farmerIds = [...farmerMap.keys()];
  const farmers   = [...farmerMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Fetch advances + deductions for all farmers in this period
  const [advances, deductions] = await Promise.all([
    prisma.farmerAdvance.findMany({
      where: { farmerId: { in: farmerIds }, advanceDate: { gte: start, lt: end } },
      select: { farmerId: true, amount: true },
    }),
    prisma.farmerDeduction.findMany({
      where: { farmerId: { in: farmerIds }, periodMonth: m, periodYear: y },
      select: { farmerId: true, amount: true },
    }),
  ]);

  const grid = farmers.map(farmer => {
    const days: Record<number, number> = {};
    for (let d = 1; d <= daysInMonth; d++) days[d] = 0;
    collections.filter(c => c.farmerId === farmer.id)
      .forEach(c => { const d = new Date(c.collectedAt).getDate(); days[d] += Number(c.litres); });

    const tl = Object.values(days).reduce((a, b) => a + b, 0);
    const tm = tl * Number(farmer.pricePerLitre);
    const ad = [
      ...advances.filter(a => a.farmerId === farmer.id),
      ...deductions.filter(d => d.farmerId === farmer.id),
    ].reduce((s, x) => s + Number(x.amount), 0);
    const tp = tm - ad;

    return { farmer, days, tl, tm: Number(tm.toFixed(2)), ad: Number(ad.toFixed(2)), tp: Number(tp.toFixed(2)) };
  });

  res.json({ month: m, year: y, daysInMonth, data: grid });
}

// ── Excel export for collection grid ──────────────────────────
export async function collectionGridExcel(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);
  const daysInMonth = new Date(y, m, 0).getDate();

  const where: any = { collectedAt: { gte: start, lt: end } };
  if (routeId) where.routeId = Number(routeId);

  const collections = await prisma.milkCollection.findMany({
    where,
    include: { farmer: { include: { route: true } } },
  });

  const farmerMap = new Map<number, any>();
  collections.forEach(c => { if (!farmerMap.has(c.farmerId)) farmerMap.set(c.farmerId, c.farmer); });
  const farmers = [...farmerMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${MONTHS[m]} ${y}`, { properties: { tabColor: { argb: 'FF1E3A5F' } } });

  // Freeze panes: col A-B (code, name), row 1-2 (header)
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }];

  // Build columns: #, Code, Name, days 1–N, TOTAL, GROSS PAY
  ws.columns = [
    { key: 'no',   width: 5  },
    { key: 'name', width: 26 },
    ...Array.from({ length: daysInMonth }, (_, i) => ({ key: `d${i+1}`, width: 5 })),
    { key: 'tl',   width: 10 },
    { key: 'tm',   width: 14 },
    { key: 'ad',   width: 14 },
    { key: 'tp',   width: 14 },
  ];

  // Title row
  const title = ws.addRow([`GUTORIA DAIRIES — COLLECTION GRID: ${MONTHS[m].toUpperCase()} ${y}`]);
  title.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  ws.mergeCells(1, 1, 1, daysInMonth + 6);

  // Header row: #, NAME, 1, 2, … N, TL, TM, AD, TP
  const hdr = ws.addRow(['#', 'FARMER NAME', ...Array.from({ length: daysInMonth }, (_, i) => i+1), 'TL', 'TM (KES)', 'AD (KES)', 'TP / NET PAY']);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  hdr.alignment = { horizontal: 'center' };

  // Fetch advances + deductions for Excel too
  const allFarmerIds = farmers.map(f => f.id);
  const [xlAdvances, xlDeductions] = await Promise.all([
    prisma.farmerAdvance.findMany({
      where: { farmerId: { in: allFarmerIds }, advanceDate: { gte: start, lt: end } },
      select: { farmerId: true, amount: true },
    }),
    prisma.farmerDeduction.findMany({
      where: { farmerId: { in: allFarmerIds }, periodMonth: m, periodYear: y },
      select: { farmerId: true, amount: true },
    }),
  ]);

  // Data rows
  const gridRows: any[] = [];
  farmers.forEach((farmer, idx) => {
    const days: Record<number, number> = {};
    for (let d = 1; d <= daysInMonth; d++) days[d] = 0;
    collections.filter(c => c.farmerId === farmer.id)
      .forEach(c => { const d = new Date(c.collectedAt).getDate(); days[d] += Number(c.litres); });

    const tl = Object.values(days).reduce((a, b) => a + b, 0);
    const tm = tl * Number(farmer.pricePerLitre);
    const ad = [
      ...xlAdvances.filter(a => a.farmerId === farmer.id),
      ...xlDeductions.filter(d => d.farmerId === farmer.id),
    ].reduce((s, x) => s + Number(x.amount), 0);
    const tp = tm - ad;
    gridRows.push({ days, tl, tm, ad, tp });

    const row = ws.addRow([
      idx + 1, farmer.name,
      ...Array.from({ length: daysInMonth }, (_, i) => days[i+1] || ''),
      tl, tm, ad, tp,
    ]);
    if (idx % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
    // TL
    row.getCell(daysInMonth + 3).font   = { bold: true, color: { argb: 'FF1D4ED8' } };
    // TM
    row.getCell(daysInMonth + 4).numFmt = '#,##0.00';
    // AD
    row.getCell(daysInMonth + 5).numFmt = '#,##0.00';
    row.getCell(daysInMonth + 5).font   = { color: { argb: ad > 0 ? 'FFDC2626' : 'FF9CA3AF' } };
    // TP
    row.getCell(daysInMonth + 6).numFmt = '#,##0.00';
    row.getCell(daysInMonth + 6).font   = { bold: true, color: { argb: tp < 0 ? 'FFDC2626' : 'FF166534' } };
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = row.getCell(d + 2);
      cell.alignment = { horizontal: 'center' };
      if (!days[d]) cell.font = { color: { argb: 'FFD1D5DB' } };
    }
  });

  // Totals row
  ws.addRow([]);
  const totRow = ws.addRow([
    '', 'TOTAL',
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return collections.filter(c => new Date(c.collectedAt).getDate() === d).reduce((s, c) => s + Number(c.litres), 0) || '';
    }),
    gridRows.reduce((s, r) => s + r.tl, 0),
    gridRows.reduce((s, r) => s + r.tm, 0),
    gridRows.reduce((s, r) => s + r.ad, 0),
    gridRows.reduce((s, r) => s + r.tp, 0),
  ]);
  totRow.font = { bold: true };
  totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
  totRow.getCell(daysInMonth + 4).numFmt = '#,##0.00';
  totRow.getCell(daysInMonth + 5).numFmt = '#,##0.00';
  totRow.getCell(daysInMonth + 6).numFmt = '#,##0.00';

  const filename = `Collection_Grid_${MONTHS[m]}_${y}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ═══════════════════════════════════════════════════════════════
// 2. FARMER STATEMENT  (individual)
// ═══════════════════════════════════════════════════════════════
export async function monthlyFarmerStatement(req: Request, res: Response) {
  const { farmerId } = req.params;
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');

  const m = Number(month), y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);

  const [farmer, collections, advances, deductions] = await Promise.all([
    prisma.farmer.findUnique({ where: { id: Number(farmerId) }, include: { route: true } }),
    prisma.milkCollection.findMany({ where: { farmerId: Number(farmerId), collectedAt: { gte: start, lt: end } }, orderBy: { collectedAt: 'asc' } }),
    prisma.farmerAdvance.findMany({ where: { farmerId: Number(farmerId), advanceDate: { gte: start, lt: end } } }),
    prisma.farmerDeduction.findMany({ where: { farmerId: Number(farmerId), periodMonth: m, periodYear: y } }),
  ]);

  if (!farmer) throw new AppError(404, 'Farmer not found');

  const totalLitres    = collections.reduce((s, c) => s + Number(c.litres), 0);
  const grossPay       = totalLitres * Number(farmer.pricePerLitre);
  const totalAdvances  = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalDeductions= deductions.reduce((s, d) => s + Number(d.amount), 0);
  const netPay         = grossPay - totalAdvances - totalDeductions;

  res.json({ farmer, collections, advances, deductions,
    summary: { totalLitres, grossPay, totalAdvances, totalDeductions, netPay } });
}

// ═══════════════════════════════════════════════════════════════
// 3. ROUTE PERFORMANCE
// ═══════════════════════════════════════════════════════════════
export async function routePerformance(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);

  const routes = await prisma.route.findMany({
    include: {
      supervisor: { select: { name: true } },
      farmers: {
        select: {
          id: true, pricePerLitre: true, isActive: true,
          advances:   { where: { advanceDate:  { gte: start, lt: end } }, select: { amount: true } },
          deductions: { where: { periodMonth: m, periodYear: y },         select: { amount: true } },
        },
      },
      collections: { where: { collectedAt: { gte: start, lt: end } }, select: { litres: true, collectedAt: true, farmerId: true } },
    },
    orderBy: { name: 'asc' },
  });

  const data = routes.map(route => {
    const activeFarmers = route.farmers.filter(f => f.isActive).length;

    // TL — Total Litres
    const tl = route.collections.reduce((s, c) => s + Number(c.litres), 0);

    // TM — Total Money (litres × each farmer's rate)
    const tm = route.collections.reduce((s, c) => {
      const farmer = route.farmers.find(f => f.id === c.farmerId);
      return s + (farmer ? Number(c.litres) * Number(farmer.pricePerLitre) : 0);
    }, 0);

    // AD — All Deductions (advances + other deductions per farmer in this route)
    const ad = route.farmers.reduce((s, f) => {
      const advTotal = f.advances.reduce((a: number, x: any)   => a + Number(x.amount), 0);
      const dedTotal = f.deductions.reduce((a: number, x: any) => a + Number(x.amount), 0);
      return s + advTotal + dedTotal;
    }, 0);

    // TP — Total Payable (Net Pay = TM - AD)
    const tp = tm - ad;

    const activeDays = new Set(route.collections.map(c => new Date(c.collectedAt).toDateString())).size;
    const avgPerDay  = activeDays > 0 ? tl / activeDays : 0;

    return {
      id:           route.id,
      code:         route.code,
      name:         route.name,
      supervisor:   route.supervisor?.name ?? '—',
      activeFarmers,
      totalFarmers: route.farmers.length,
      activeDays,
      avgPerDay:    Number(avgPerDay.toFixed(1)),
      tl:           Number(tl.toFixed(1)),
      tm:           Number(tm.toFixed(2)),
      ad:           Number(ad.toFixed(2)),
      tp:           Number(tp.toFixed(2)),
    };
  }).filter(r => r.tl > 0);

  const grandTotal = {
    tl:      Number(data.reduce((s, r) => s + r.tl, 0).toFixed(1)),
    tm:      Number(data.reduce((s, r) => s + r.tm, 0).toFixed(2)),
    ad:      Number(data.reduce((s, r) => s + r.ad, 0).toFixed(2)),
    tp:      Number(data.reduce((s, r) => s + r.tp, 0).toFixed(2)),
    farmers: data.reduce((s, r) => s + r.activeFarmers, 0),
  };

  res.json({ month: m, year: y, routes: data, grandTotal });
}

// ── Excel export for route performance ────────────────────────
export async function routePerformanceExcel(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  // Re-use same data logic
  const start = new Date(y, m - 1, 1), end = new Date(y, m, 1);
  const routes = await prisma.route.findMany({
    include: {
      supervisor: { select: { name: true } },
      farmers: {
        select: {
          id: true, pricePerLitre: true, isActive: true,
          advances:   { where: { advanceDate:  { gte: start, lt: end } }, select: { amount: true } },
          deductions: { where: { periodMonth: m, periodYear: y },         select: { amount: true } },
        },
      },
      collections: { where: { collectedAt: { gte: start, lt: end } }, select: { litres: true, collectedAt: true, farmerId: true } },
    },
    orderBy: { name: 'asc' },
  });

  const rows = routes.map(route => {
    const activeFarmers = route.farmers.filter((f: any) => f.isActive).length;
    const tl = route.collections.reduce((s: number, c: any) => s + Number(c.litres), 0);
    const tm = route.collections.reduce((s: number, c: any) => {
      const farmer = route.farmers.find((f: any) => f.id === c.farmerId);
      return s + (farmer ? Number(c.litres) * Number(farmer.pricePerLitre) : 0);
    }, 0);
    const ad = route.farmers.reduce((s: number, f: any) => {
      const advTotal = f.advances.reduce((a: number, x: any)   => a + Number(x.amount), 0);
      const dedTotal = f.deductions.reduce((a: number, x: any) => a + Number(x.amount), 0);
      return s + advTotal + dedTotal;
    }, 0);
    const tp = tm - ad;
    const activeDays = new Set(route.collections.map((c: any) => new Date(c.collectedAt).toDateString())).size;
    return { route, activeFarmers, tl, tm, ad, tp, activeDays };
  }).filter(r => r.tl > 0);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Route Performance');
  ws.columns = [
    { key: 'no',      width: 5  },
    { key: 'code',    width: 10 },
    { key: 'route',   width: 24 },
    { key: 'super',   width: 22 },
    { key: 'farmers', width: 12 },
    { key: 'days',    width: 12 },
    { key: 'tl',      width: 14 },
    { key: 'tm',      width: 16 },
    { key: 'ad',      width: 16 },
    { key: 'tp',      width: 16 },
  ];

  const t = ws.addRow([`GUTORIA DAIRIES — ROUTE PERFORMANCE: ${MONTHS[m].toUpperCase()} ${y}`]);
  t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  ws.mergeCells('A1:J1');

  const h = ws.addRow(['#','CODE','ROUTE NAME','SUPERVISOR','FARMERS','DAYS','TL (LITRES)','TM (KES)','AD (KES)','TP / NET PAY (KES)']);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  h.alignment = { horizontal: 'center' };

  rows.forEach(({ route, activeFarmers, tl, tm, ad, tp, activeDays }, i) => {
    const r = ws.addRow([i+1, route.code, route.name, route.supervisor?.name ?? '—',
      activeFarmers, activeDays, tl, tm, ad, tp]);
    if (i % 2 === 1) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
    r.getCell(7).numFmt  = '#,##0.0';
    r.getCell(8).numFmt  = '#,##0.00';
    r.getCell(9).numFmt  = '#,##0.00';
    r.getCell(9).font    = { color: { argb: 'FFDC2626' } };
    r.getCell(10).numFmt = '#,##0.00';
    r.getCell(10).font   = { bold: true, color: { argb: tp < 0 ? 'FFDC2626' : 'FF166534' } };
  });

  ws.addRow([]);
  const tot = ws.addRow(['','','TOTAL','',
    rows.reduce((s, r) => s + r.activeFarmers, 0), '',
    rows.reduce((s, r) => s + r.tl, 0),
    rows.reduce((s, r) => s + r.tm, 0),
    rows.reduce((s, r) => s + r.ad, 0),
    rows.reduce((s, r) => s + r.tp, 0),
  ]);
  tot.font = { bold: true };
  tot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
  tot.getCell(7).numFmt  = '#,##0.0';
  tot.getCell(8).numFmt  = '#,##0.00';
  tot.getCell(9).numFmt  = '#,##0.00';
  tot.getCell(10).numFmt = '#,##0.00';

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
  const filename = `Route_Performance_${MONTHS[m]}_${y}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ═══════════════════════════════════════════════════════════════
// 4. PAYMENT SUMMARY
// ═══════════════════════════════════════════════════════════════
export async function paymentSummary(req: Request, res: Response) {
  const { month, year, isMidMonth } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const mid = isMidMonth === 'true';

  const payments = await prisma.farmerPayment.findMany({
    where: { periodMonth: m, periodYear: y, isMidMonth: mid },
    include: {
      farmer: { select: { code: true, name: true, paymentMethod: true, route: { select: { name: true } } } },
    },
    orderBy: [{ farmer: { paymentMethod: 'asc' } }, { farmer: { name: 'asc' } }],
  });

  // Group by method
  const byMethod: Record<string, typeof payments> = {};
  payments.forEach(p => {
    const m = p.farmer.paymentMethod;
    if (!byMethod[m]) byMethod[m] = [];
    byMethod[m].push(p);
  });

  const summary = Object.entries(byMethod).map(([method, pList]) => ({
    method,
    count:  pList.length,
    amount: Number(pList.reduce((s, p) => s + Number(p.netPay), 0).toFixed(2)),
  }));

  res.json({
    month: m, year: y, isMidMonth: mid,
    period: `${mid ? 'Mid Month' : 'End Month'} ${MONTHS[m]} ${y}`,
    payments,
    summary,
    totals: {
      count:  payments.length,
      gross:  Number(payments.reduce((s, p) => s + Number(p.grossPay), 0).toFixed(2)),
      advances: Number(payments.reduce((s, p) => s + Number(p.totalAdvances), 0).toFixed(2)),
      deductions: Number(payments.reduce((s, p) => s + Number(p.totalDeductions), 0).toFixed(2)),
      net:    Number(payments.reduce((s, p) => s + Number(p.netPay), 0).toFixed(2)),
      paid:   payments.filter(p => p.status === 'PAID').length,
      pending:payments.filter(p => p.status !== 'PAID').length,
    },
  });
}

// ── Excel export for payment summary ──────────────────────────
export async function paymentSummaryExcel(req: Request, res: Response) {
  const { month, year, isMidMonth } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const mid = isMidMonth === 'true';
  const periodLabel = `${mid ? 'Mid Month' : 'End Month'} ${MONTHS[m]} ${y}`;

  const payments = await prisma.farmerPayment.findMany({
    where: { periodMonth: m, periodYear: y, isMidMonth: mid },
    include: {
      farmer: { select: { code: true, name: true, paymentMethod: true, mpesaPhone: true, bankAccount: true, route: { select: { name: true } } } },
    },
    orderBy: [{ farmer: { paymentMethod: 'asc' } }, { farmer: { name: 'asc' } }],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payment Summary');
  ws.columns = [
    { key: 'no',     width: 5  },
    { key: 'code',   width: 10 },
    { key: 'name',   width: 26 },
    { key: 'route',  width: 18 },
    { key: 'method', width: 12 },
    { key: 'account',width: 18 },
    { key: 'gross',  width: 14 },
    { key: 'adv',    width: 14 },
    { key: 'ded',    width: 14 },
    { key: 'net',    width: 16 },
    { key: 'status', width: 12 },
  ];

  const t = ws.addRow([`GUTORIA DAIRIES — PAYMENT SUMMARY: ${periodLabel.toUpperCase()}`]);
  t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  ws.mergeCells('A1:K1');

  const h = ws.addRow(['#','M.NO','FARMER NAME','ROUTE','METHOD','ACCOUNT','GROSS','ADVANCES','DEDUCTIONS','NET PAY','STATUS']);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  h.alignment = { horizontal: 'center' };

  payments.forEach((p, i) => {
    const account = p.farmer.paymentMethod === 'MPESA' ? p.farmer.mpesaPhone : p.farmer.bankAccount;
    const r = ws.addRow([
      i+1, p.farmer.code, p.farmer.name, p.farmer.route.name,
      p.farmer.paymentMethod, account ?? '',
      Number(p.grossPay), Number(p.totalAdvances), Number(p.totalDeductions),
      Number(p.netPay), p.status,
    ]);
    if (i % 2 === 1) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    [7,8,9,10].forEach(c => { r.getCell(c).numFmt = '#,##0.00'; });
    r.getCell(10).font = { bold: true, color: { argb: Number(p.netPay) < 0 ? 'FFDC2626' : 'FF166534' } };
    r.getCell(11).font = { color: { argb: p.status === 'PAID' ? 'FF166534' : 'FF6B7280' } };
  });

  ws.addRow([]);
  const tot = ws.addRow(['','','TOTAL','','','',
    payments.reduce((s, p) => s + Number(p.grossPay), 0),
    payments.reduce((s, p) => s + Number(p.totalAdvances), 0),
    payments.reduce((s, p) => s + Number(p.totalDeductions), 0),
    payments.reduce((s, p) => s + Number(p.netPay), 0),
    `${payments.length} farmers`,
  ]);
  tot.font = { bold: true };
  tot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
  [7,8,9,10].forEach(c => { tot.getCell(c).numFmt = '#,##0.00'; });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];
  const filename = `Payment_Summary_${periodLabel.replace(/\s/g,'_')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ── Keep old export name for existing route ────────────────────
export async function factoryEfficiency(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end   = new Date(Number(year), Number(month), 1);
  const batches = await prisma.pasteurizationBatch.findMany({ where: { processedAt: { gte: start, lt: end } } });
  const totalInput  = batches.reduce((s, b) => s + Number(b.inputLitres), 0);
  const totalOutput = batches.reduce((s, b) => s + Number(b.outputLitres), 0);
  const totalLoss   = batches.reduce((s, b) => s + Number(b.lossLitres), 0);
  const efficiencyPct = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(2) : '0';
  res.json({ batches, summary: { totalInput, totalOutput, totalLoss, efficiencyPct } });
}
