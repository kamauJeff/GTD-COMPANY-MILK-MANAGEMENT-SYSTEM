// src/controllers/disbursement.controller.ts
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { disburseMpesa, getTransferStatus } from '../services/kopokopo.service';
import { logger } from '../config/logger';

const CALLBACK_URL = `${process.env.BACKEND_URL ?? 'https://yourbackend.com'}/api/webhooks/kopokopo/disburse`;

// ── Helper: normalise phone to +2547XXXXXXXX (KopoKopo format) ─
function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip leading apostrophe (Excel text-force prefix e.g. '0712345678 or '254...)
  const cleaned = String(raw).replace(/^'/, '').trim();
  const d = cleaned.replace(/\D/g, '');
  let e164: string | null = null;
  if (d.startsWith('2547') || d.startsWith('2541')) e164 = d;
  else if (d.startsWith('07') || d.startsWith('01')) e164 = '254' + d.slice(1);
  else if (d.startsWith('7') && d.length === 9)      e164 = '254' + d;
  return e164 ? e164 : null;  // KopoKopo format: 2547XXXXXXXX (no + prefix)
}

// ── Helper: split full name → { firstName, lastName } ─────────
// e.g. JOHN KAMAU NJOROGE → firstName="JOHN", lastName="KAMAU NJOROGE"
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'UNKNOWN', lastName: 'UNKNOWN' };
  const firstName = parts[0];
  const lastName  = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
}

// ── Helper: build KopoKopo narration ──────────────────────────
const MONTHS_EN = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];

function buildNarration(m: number, y: number, mid: boolean): string {
  return `${mid ? 'Mid Month' : 'End Month'} Payment - ${MONTHS_EN[m]} ${y}`;
}

// ── GET /api/disbursements/preview ────────────────────────────
// Returns who will be paid, how much, by which method
export async function previewDisbursement(req: Request, res: Response) {
  const { month, year, routeId, isMidMonth } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m          = Number(month), y = Number(year);
  const mid        = isMidMonth === 'true';
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 1);

  const where: any = { isActive: true };
  if (routeId) where.routeId = Number(routeId);

  const farmers = await prisma.farmer.findMany({
    where,
    include: {
      route: { select: { name: true } },
      collections: {
        where: { collectedAt: { gte: monthStart, lt: monthEnd } },
        select: { litres: true, collectedAt: true },
      },
      advances: {
        where: { advanceDate: { gte: monthStart, lt: monthEnd } },
        select: { amount: true, advanceDate: true },
      },
    },
    orderBy: [{ paymentMethod: 'asc' }, { name: 'asc' }],
  });

  const rows = farmers.map(farmer => {
    const allLitres = farmer.collections.reduce((s, c) => s + Number(c.litres), 0);
    const midLitres = farmer.collections
      .filter(c => new Date(c.collectedAt).getDate() <= 15)
      .reduce((s, c) => s + Number(c.litres), 0);

    const litres = mid ? midLitres : allLitres;
    const price  = Number(farmer.pricePerLitre);
    const gross  = litres * price;

    const allAdv = farmer.advances.reduce((s, a) => s + Number(a.amount), 0);
    const midAdv = farmer.advances
      .filter(a => new Date(a.advanceDate).getDate() <= 15)
      .reduce((s, a) => s + Number(a.amount), 0);

    const adv      = mid ? midAdv : allAdv;
    const netPay   = Number((gross - adv).toFixed(2));
    const phone    = normalisePhone(farmer.mpesaPhone ?? farmer.phone);
    const method   = (farmer.paymentMethod ?? '').toUpperCase();

    return {
      id:            farmer.id,
      name:          farmer.name,
      code:          farmer.code,
      routeName:     farmer.route.name,
      paymentMethod: method,
      phone:         farmer.phone,
      mpesaPhone:    farmer.mpesaPhone,
      normalisedPhone: phone,
      bankName:      farmer.bankName,
      bankAccount:   farmer.bankAccount,
      litres:        Number(litres.toFixed(1)),
      gross:         Number(gross.toFixed(2)),
      adv:           Number(adv.toFixed(2)),
      netPay,
      canPay:        netPay > 0 && litres > 0,
      isMpesa:       method === 'MPESA',
      isBank:        ['EQUITY','KCB','CO-OP','FAMILY','FARIJI','K-UNITY','TAI','BANK'].includes(method),
      phoneValid:    !!phone,
    };
  }).filter(f => f.canPay);

  const mpesaRows = rows.filter(f => f.isMpesa);
  const bankRows  = rows.filter(f => f.isBank);

  // Group bank rows by bank
  const byBank: Record<string, typeof bankRows> = {};
  bankRows.forEach(f => {
    const b = f.paymentMethod;
    if (!byBank[b]) byBank[b] = [];
    byBank[b].push(f);
  });

  res.json({
    period:    `${mid ? 'Mid' : 'End'} Month ${month}/${year}`,
    isMidMonth: mid,
    summary: {
      total:       rows.length,
      mpesa:       mpesaRows.length,
      mpesaAmount: Number(mpesaRows.reduce((s, f) => s + f.netPay, 0).toFixed(2)),
      bank:        bankRows.length,
      bankAmount:  Number(bankRows.reduce((s, f) => s + f.netPay, 0).toFixed(2)),
      totalAmount: Number(rows.reduce((s, f) => s + f.netPay, 0).toFixed(2)),
      phoneErrors: mpesaRows.filter(f => !f.phoneValid).length,
    },
    mpesa: mpesaRows,
    banks: Object.entries(byBank).map(([bank, farmers]) => ({
      bank,
      count:  farmers.length,
      amount: Number(farmers.reduce((s, f) => s + f.netPay, 0).toFixed(2)),
      farmers,
    })),
  });
}

// ── POST /api/disbursements/mpesa ─────────────────────────────
// Trigger KopoKopo disbursements for all eligible M-Pesa farmers
export async function disburseMpesaPayments(req: Request, res: Response) {
  const { month, year, routeId, isMidMonth, farmerIds } = req.body;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m   = Number(month), y = Number(year);
  const mid = Boolean(isMidMonth);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 1);

  const where: any = { isActive: true, paymentMethod: 'MPESA' };
  if (routeId)    where.routeId = Number(routeId);
  if (farmerIds?.length) where.id = { in: farmerIds.map(Number) };

  const farmers = await prisma.farmer.findMany({
    where,
    include: {
      collections: { where: { collectedAt: { gte: monthStart, lt: monthEnd } }, select: { litres: true, collectedAt: true } },
      advances:    { where: { advanceDate:  { gte: monthStart, lt: monthEnd } }, select: { amount: true, advanceDate: true } },
    },
  });

  const results: any[] = [];

  for (const farmer of farmers) {
    try {
      const allLitres = farmer.collections.reduce((s, c) => s + Number(c.litres), 0);
      const midLitres = farmer.collections.filter(c => new Date(c.collectedAt).getDate() <= 15).reduce((s, c) => s + Number(c.litres), 0);
      const litres    = mid ? midLitres : allLitres;
      if (litres === 0) continue;

      const price  = Number(farmer.pricePerLitre);
      const gross  = litres * price;
      const allAdv = farmer.advances.reduce((s, a) => s + Number(a.amount), 0);
      const midAdv = farmer.advances.filter(a => new Date(a.advanceDate).getDate() <= 15).reduce((s, a) => s + Number(a.amount), 0);
      const adv    = mid ? midAdv : allAdv;
      const netPay = Number((gross - adv).toFixed(2));

      if (netPay <= 0) continue;

      const phone = normalisePhone(farmer.mpesaPhone ?? farmer.phone);
      if (!phone) {
        results.push({ id: farmer.id, name: farmer.name, status: 'ERROR', error: 'Invalid phone number' });
        continue;
      }

      const { firstName, lastName } = splitName(farmer.name);
      const narration = buildNarration(m, y, mid);

      const transferId = await disburseMpesa({
        phone, amount: netPay, firstName, lastName,
        remarks: narration,
        callbackUrl: CALLBACK_URL,
      });

      // Record payment as PROCESSING
      await prisma.farmerPayment.upsert({
        where: { farmerId_periodMonth_periodYear_isMidMonth: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: mid } },
        update: { grossPay: gross, totalAdvances: adv, totalDeductions: 0, netPay, status: 'PENDING', kopokopoRef: transferId },
        create: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: mid, grossPay: gross, totalAdvances: adv, totalDeductions: 0, netPay, status: 'PENDING', kopokopoRef: transferId },
      });

      results.push({ id: farmer.id, name: farmer.name, phone, amount: netPay, status: 'PENDING', ref: transferId });
      logger.info(`Disbursed KES ${netPay} to ${farmer.name} (${phone})`);

    } catch (err: any) {
      logger.error(`Failed to disburse for farmer ${farmer.id}:`, err.message);
      results.push({ id: farmer.id, name: farmer.name, status: 'ERROR', error: err.message });
    }
  }

  res.json({
    processed: results.length,
    successful: results.filter(r => r.status === 'PENDING').length,
    failed:    results.filter(r => r.status === 'ERROR').length,
    results,
  });
}

// ── POST /api/disbursements/webhook ───────────────────────────
// KopoKopo callback: update payment status when transfer completes
export async function disbursementCallback(req: Request, res: Response) {
  res.status(200).send('OK'); // Always ack first

  try {
    const payload = req.body;
    const data    = payload.data?.attributes ?? payload.data ?? {};
    const ref     = data.transfer_reference ?? data.id ?? '';
    const status  = (data.status ?? '').toLowerCase();

    if (!ref) return;

    const newStatus = status === 'success' || status === 'transferred' ? 'PAID'
                    : status === 'failed'  || status === 'rejected'    ? 'FAILED'
                    : null;

    if (!newStatus) return;

    await prisma.farmerPayment.updateMany({
      where: { kopokopoRef: ref },
      data: {
        status: newStatus,
        paidAt: newStatus === 'PAID' ? new Date() : undefined,
      },
    });

    logger.info(`Disbursement callback: ref=${ref} status=${newStatus}`);
  } catch (err) {
    logger.error('Disbursement callback error:', err);
  }
}

// ── GET /api/disbursements/remittance ─────────────────────────
// Export bank remittance Excel — one sheet per bank
export async function exportRemittance(req: Request, res: Response) {
  const { month, year, routeId, isMidMonth } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m          = Number(month), y = Number(year);
  const mid        = isMidMonth === 'true';
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 1);
  const MONTHS_EN  = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const periodLabel = `${MONTHS_EN[m]} ${y} ${mid ? '(Mid Month)' : '(End Month)'}`;

  const where: any = { isActive: true };
  if (routeId) where.routeId = Number(routeId);

  const farmers = await prisma.farmer.findMany({
    where,
    include: {
      route: { select: { name: true } },
      collections: { where: { collectedAt: { gte: monthStart, lt: monthEnd } }, select: { litres: true, collectedAt: true } },
      advances:    { where: { advanceDate:  { gte: monthStart, lt: monthEnd } }, select: { amount: true, advanceDate: true } },
    },
    orderBy: [{ paymentMethod: 'asc' }, { name: 'asc' }],
  });

  // Compute net pay per farmer
  const bankFarmers = farmers
    .map(farmer => {
      const allLitres = farmer.collections.reduce((s, c) => s + Number(c.litres), 0);
      const midLitres = farmer.collections.filter(c => new Date(c.collectedAt).getDate() <= 15).reduce((s, c) => s + Number(c.litres), 0);
      const litres    = mid ? midLitres : allLitres;
      const price     = Number(farmer.pricePerLitre);
      const gross     = litres * price;
      const allAdv    = farmer.advances.reduce((s, a) => s + Number(a.amount), 0);
      const midAdv    = farmer.advances.filter(a => new Date(a.advanceDate).getDate() <= 15).reduce((s, a) => s + Number(a.amount), 0);
      const adv       = mid ? midAdv : allAdv;
      const netPay    = Number((gross - adv).toFixed(2));
      const method    = (farmer.paymentMethod ?? '').toUpperCase();

      return { ...farmer, litres, gross, adv, netPay, method };
    })
    .filter(f => f.netPay > 0 && f.litres > 0 && !['MPESA','CASH','DO NOT PAY','DON\'T PAY','N/A',''].includes(f.method));

  // Group by bank
  const byBank: Record<string, typeof bankFarmers> = {};
  bankFarmers.forEach(f => {
    if (!byBank[f.method]) byBank[f.method] = [];
    byBank[f.method].push(f);
  });

  // Build workbook
  const wb = new ExcelJS.Workbook();
  wb.creator    = 'Gutoria Dairies';
  wb.created    = new Date();

  // ── Colour palette per bank ──
  const BANK_COLORS: Record<string, { header: string; accent: string }> = {
    EQUITY:  { header: 'FF8B0000', accent: 'FFFFE4E4' },
    KCB:     { header: 'FF006633', accent: 'FFE4F5EC' },
    'CO-OP': { header: 'FF004080', accent: 'FFE4EEFF' },
    FAMILY:  { header: 'FF5B2C8C', accent: 'FFF5EEFF' },
    FARIJI:  { header: 'FF0070C0', accent: 'FFE4F3FF' },
    'K-UNITY': { header: 'FFC55A11', accent: 'FFFFF0E4' },
    TAI:     { header: 'FF1F5C1F', accent: 'FFE8F5E8' },
  };

  const BANK_FULL: Record<string, string> = {
    EQUITY:    'Equity Bank Kenya',
    KCB:       'KCB Bank Kenya',
    'CO-OP':   'Co-operative Bank of Kenya',
    FAMILY:    'Family Bank Kenya',
    FARIJI:    'Fariji SACCO',
    'K-UNITY': 'K-Unity SACCO',
    TAI:       'TAI SACCO',
    BANK:      'Bank Transfer',
  };

  // ── Summary sheet ──────────────────────────────────────────
  const sumWs = wb.addWorksheet('SUMMARY', { properties: { tabColor: { argb: 'FF1E3A5F' } } });
  sumWs.columns = [
    { key: 'bank',   width: 22 },
    { key: 'count',  width: 12 },
    { key: 'amount', width: 18 },
  ];

  const sumTitle = sumWs.addRow(['GUTORIA DAIRIES — BANK REMITTANCE SUMMARY']);
  sumTitle.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  sumWs.mergeCells('A1:C1');

  sumWs.addRow([periodLabel]);
  sumWs.mergeCells('A2:C2');
  sumWs.addRow([]);

  const sumHead = sumWs.addRow(['BANK / SACCO', 'FARMERS', 'TOTAL (KES)']);
  sumHead.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sumHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  sumHead.alignment = { horizontal: 'center' };

  let grandTotal = 0;
  Object.entries(byBank).forEach(([bank, rows]) => {
    const total = rows.reduce((s, f) => s + f.netPay, 0);
    grandTotal += total;
    const row = sumWs.addRow([BANK_FULL[bank] ?? bank, rows.length, total]);
    row.getCell(3).numFmt = '#,##0.00';
    const color = BANK_COLORS[bank];
    if (color) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.accent } };
  });

  sumWs.addRow([]);
  const grandRow = sumWs.addRow(['GRAND TOTAL', bankFarmers.length, grandTotal]);
  grandRow.font = { bold: true };
  grandRow.getCell(3).numFmt = '#,##0.00';
  grandRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  sumWs.addRow([]);
  sumWs.addRow([`Generated: ${new Date().toLocaleString('en-KE')}`]);
  sumWs.addRow([`Period: ${periodLabel}`]);

  // ── One sheet per bank ─────────────────────────────────────
  for (const [bank, rows] of Object.entries(byBank)) {
    const color = BANK_COLORS[bank] ?? { header: 'FF374151', accent: 'FFF9FAFB' };
    const ws    = wb.addWorksheet(bank, { properties: { tabColor: { argb: color.header } } });

    ws.columns = [
      { key: 'no',      width: 6  },
      { key: 'code',    width: 10 },
      { key: 'name',    width: 28 },
      { key: 'route',   width: 18 },
      { key: 'account', width: 22 },
      { key: 'phone',   width: 16 },
      { key: 'litres',  width: 10 },
      { key: 'gross',   width: 14 },
      { key: 'adv',     width: 14 },
      { key: 'netpay',  width: 16 },
      { key: 'remarks', width: 28 },
    ];

    // Title
    const title = ws.addRow([`${BANK_FULL[bank] ?? bank} — Remittance Schedule`]);
    title.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.header } };
    ws.mergeCells(`A1:K1`);

    const sub = ws.addRow([periodLabel]);
    sub.font = { italic: true, color: { argb: 'FF374151' } };
    sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.accent } };
    ws.mergeCells('A2:K2');
    ws.addRow([]);

    // Headers
    const hdr = ws.addRow(['#','M.NO','FARMER NAME','ROUTE','ACCOUNT NO.','PHONE','LITRES','GROSS (KES)','ADVANCES','NET PAY (KES)','REMARKS']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.header } };
    hdr.alignment = { horizontal: 'center' };
    hdr.eachCell(cell => { cell.border = { bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } } }; });

    // Data rows
    rows.forEach((f, i) => {
      const r = ws.addRow([
        i + 1,
        f.code,
        f.name,
        f.route.name,
        f.bankAccount ?? '',
        f.phone ?? '',
        f.litres,
        f.gross,
        f.adv,
        f.netPay,
        `Milk ${periodLabel}`,
      ]);
      if (i % 2 === 1) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.accent } };
      r.getCell(7).numFmt  = '#,##0.0';
      r.getCell(8).numFmt  = '#,##0.00';
      r.getCell(9).numFmt  = '#,##0.00';
      r.getCell(10).numFmt = '#,##0.00';
      r.getCell(10).font   = { bold: true };
      // Highlight negative net pay in red
      if (f.netPay < 0) {
        r.getCell(10).font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });

    // Totals row
    ws.addRow([]);
    const tot = ws.addRow([
      '', '', '', '', '', 'TOTAL',
      rows.reduce((s, f) => s + f.litres, 0),
      rows.reduce((s, f) => s + f.gross, 0),
      rows.reduce((s, f) => s + f.adv, 0),
      rows.reduce((s, f) => s + f.netPay, 0),
      `${rows.length} farmers`,
    ]);
    tot.font = { bold: true };
    tot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.accent } };
    tot.getCell(7).numFmt  = '#,##0.0';
    tot.getCell(8).numFmt  = '#,##0.00';
    tot.getCell(9).numFmt  = '#,##0.00';
    tot.getCell(10).numFmt = '#,##0.00';

    // Freeze top 4 rows and first 2 cols
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];
  }

  // Send file
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
  const filename   = `Gutoria_Remittance_${safePeriod}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ── GET /api/disbursements/status ─────────────────────────────
// Check and sync payment statuses from KopoKopo
export async function syncDisbursementStatus(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const processing = await prisma.farmerPayment.findMany({
    where: { periodMonth: Number(month), periodYear: Number(year), status: 'PENDING', kopokopoRef: { not: null } },
  });

  const updates: any[] = [];
  for (const payment of processing) {
    try {
      const status = await getTransferStatus(payment.kopokopoRef!);
      const newStatus = status === 'success' || status === 'transferred' ? 'PAID'
                      : status === 'failed'  || status === 'rejected'    ? 'FAILED'
                      : null;
      if (newStatus) {
        await prisma.farmerPayment.update({
          where: { id: payment.id },
          data:  { status: newStatus, paidAt: newStatus === 'PAID' ? new Date() : undefined },
        });
        updates.push({ id: payment.id, ref: payment.kopokopoRef, status: newStatus });
      }
    } catch (err: any) {
      logger.warn(`Status check failed for ref ${payment.kopokopoRef}: ${err.message}`);
    }
  }

  res.json({ checked: processing.length, updated: updates.length, updates });
}
