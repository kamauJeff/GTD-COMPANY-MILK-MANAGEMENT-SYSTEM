import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

// ── Style helpers ───────────────────────────────────────────
const TNR = 'Times New Roman';

function hdrFill(hex: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF' + hex } };
}
function thinBorder() {
  const s = { style: 'thin' as const };
  return { left: s, right: s, top: s, bottom: s };
}
function styleCell(
  cell: ExcelJS.Cell,
  opts: { bold?: boolean; size?: number; color?: string; bg?: string;
          align?: ExcelJS.Alignment['horizontal']; fmt?: string; italic?: boolean }
) {
  cell.font = { name: TNR, bold: opts.bold ?? false, size: opts.size ?? 9,
                color: { argb: 'FF' + (opts.color ?? '000000') }, italic: opts.italic ?? false };
  if (opts.bg) cell.fill = hdrFill(opts.bg);
  cell.alignment = { horizontal: opts.align ?? 'center', vertical: 'middle', wrapText: true };
  cell.border = thinBorder();
  if (opts.fmt) cell.numFmt = opts.fmt;
}

const MONEY_FMT  = '#,##0.00';
const LITRES_FMT = '#,##0.0';
const COL_LETTERS = (n: number) => ExcelJS.utils ? '' : String.fromCharCode(64 + n);

// Convert column index (1-based) to Excel letter
function col(n: number): string {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

// Column index constants
const C_MONTH   = 1;  // A
const C_MNO     = 2;  // B
const C_FNAME   = 3;  // C
const C_LNAME   = 4;  // D
const C_DAY1    = 5;  // E  (days 1-31 = cols 5-35)
const C_DAY31   = 35; // AI
const C_TOT15   = 36; // AJ - Total 15th
const C_TL      = 37; // AK - Total Litres
const C_TM      = 38; // AL - Total Money
const C_BALBF   = 39; // AM - Balance b/f
const C_ADV5    = 40; // AN
const C_ADV10   = 41; // AO
const C_ADV15   = 42; // AP
const C_ADV20   = 43; // AQ
const C_ADV25   = 44; // AR
const C_EMERAI  = 45; // AS
const C_TOTADV  = 46; // AT - Total Advances
const C_AMTPAY  = 47; // AU - Amount Payable
const C_DUEDATE = 48; // AV
const C_MODE    = 49; // AW
const C_ZERO    = 50; // AX (0 column)
const C_ACCOUNT = 51; // AY
const C_SPACE1  = 52; // AZ
const C_MIDTM   = 53; // BA - Mid TM
const C_MIDADV  = 54; // BB - Total Ad Mid
const C_MIDPAY  = 55; // BC - Mid Payable
const C_MIDCF   = 56; // BD - Mid C/f
const C_SPACE2  = 57; // BE
const C_ENDPAY  = 58; // BF - End Payable
const C_ENDCF   = 59; // BG - End C/f

export async function exportJournal(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');

  const m = Number(month);
  const y = Number(year);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 1);

  const MONTH_NAMES = ['','JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                       'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const monthName = MONTH_NAMES[m];
  const daysInMonth = new Date(y, m, 0).getDate();

  // Load all routes
  const routes = await prisma.route.findMany({ orderBy: { name: 'asc' } });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gutoria Dairies';
  wb.created = new Date();

  for (const route of routes) {
    // Load farmers for this route
    const farmers = await prisma.farmer.findMany({
      where: { routeId: route.id, isActive: true },
      orderBy: { code: 'asc' },
    });

    if (farmers.length === 0) continue;

    const farmerIds = farmers.map(f => f.id);

    // Load all collections for this month
    const collections = await prisma.milkCollection.findMany({
      where: { farmerId: { in: farmerIds }, collectedAt: { gte: monthStart, lt: monthEnd } },
    });

    // Load advances
    const advances = await prisma.farmerAdvance.findMany({
      where: { farmerId: { in: farmerIds }, advanceDate: { gte: monthStart, lt: monthEnd } },
    });

    // Load previous month payments (for balance b/f)
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear  = m === 1 ? y - 1 : y;
    const prevPayments = await prisma.farmerPayment.findMany({
      where: { farmerId: { in: farmerIds }, periodMonth: prevMonth, periodYear: prevYear },
    });
    const prevPayMap = new Map(prevPayments.map(p => [p.farmerId, p]));

    // ── Create worksheet ─────────────────────────────────────
    const ws = wb.addWorksheet(route.name.substring(0, 31));

    // Row heights
    ws.getRow(1).height = 16;
    ws.getRow(2).height = 32;

    // Freeze panes after name columns
    ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 2, topLeftCell: 'E3' }];

    // ── Column widths ────────────────────────────────────────
    ws.getColumn(C_MONTH).width  = 9;
    ws.getColumn(C_MNO).width    = 5;
    ws.getColumn(C_FNAME).width  = 13;
    ws.getColumn(C_LNAME).width  = 18;
    for (let d = C_DAY1; d <= C_DAY31; d++) ws.getColumn(d).width = 5;
    ws.getColumn(C_TOT15).width  = 7;
    ws.getColumn(C_TL).width     = 7;
    ws.getColumn(C_TM).width     = 10;
    ws.getColumn(C_BALBF).width  = 9;
    for (let d = C_ADV5; d <= C_EMERAI; d++) ws.getColumn(d).width = 9;
    ws.getColumn(C_TOTADV).width = 10;
    ws.getColumn(C_AMTPAY).width = 11;
    ws.getColumn(C_DUEDATE).width = 10;
    ws.getColumn(C_MODE).width   = 10;
    ws.getColumn(C_ACCOUNT).width = 14;
    for (let d = C_MIDTM; d <= C_ENDCF; d++) ws.getColumn(d).width = 11;

    // ── Row 1: Section header labels ─────────────────────────
    // ADVANCE
    ws.mergeCells(1, C_BALBF, 1, C_AMTPAY);
    let c = ws.getCell(1, C_BALBF);
    c.value = 'ADVANCE';
    styleCell(c, { bold: true, size: 10, bg: 'C6EFCE' });

    // Mid Month Reconciliation
    ws.mergeCells(1, C_MIDTM, 1, C_MIDCF);
    c = ws.getCell(1, C_MIDTM);
    c.value = 'Mid Month Reconciliation';
    styleCell(c, { bold: true, size: 10, bg: 'DDEEFF' });

    // Month End Reconciliation
    ws.mergeCells(1, C_ENDPAY, 1, C_ENDCF);
    c = ws.getCell(1, C_ENDPAY);
    c.value = 'Month Reconciliation';
    styleCell(c, { bold: true, size: 10, bg: 'FCE4D6' });

    // ── Row 2: Column headers ────────────────────────────────
    const headers: [number, string][] = [
      [C_MONTH,   'Month'],   [C_MNO,    'M.NO'],
      [C_FNAME,   'FIRST NAME'], [C_LNAME, 'LAST NAME'],
      [C_TOT15,   'Total\n15th'], [C_TL, 'TL'], [C_TM, 'TM'],
      [C_BALBF,   'Bal b/f'],
      [C_ADV5,    `5th\n${monthName}`],  [C_ADV10,  `10th\n${monthName}`],
      [C_ADV15,   `15th\n${monthName}`], [C_ADV20,  `20th\n${monthName}`],
      [C_ADV25,   `25th\n${monthName}`], [C_EMERAI, 'EMER/AI'],
      [C_TOTADV,  'Total Adv'], [C_AMTPAY, 'Amt\nPayable'],
      [C_DUEDATE, 'Due Date'], [C_MODE,   'Mode of\nPayment'],
      [C_ZERO,    '0'],        [C_ACCOUNT,'Account Details'],
      [C_MIDTM,   'MID TM'],  [C_MIDADV, 'Total Ad\nMid'],
      [C_MIDPAY,  'Payable'], [C_MIDCF,  'C/f\n(-ves)'],
      [C_ENDPAY,  'Payable'], [C_ENDCF,  'C/f\n(-ves)'],
    ];
    // Day headers
    for (let d = 1; d <= 31; d++) {
      const ordinals = ['','1ST','2nd','3rd','4th','5th','6th','7th','8th','9th','10th',
        '11th','12th','13th','14th','15th','16th','17th','18th','19th','20th',
        '21st','22nd','23rd','24th','25th','26th','27th','28th','29th','30th','31st'];
      headers.push([C_DAY1 + d - 1, ordinals[d]]);
    }

    for (const [colIdx, label] of headers) {
      const cell = ws.getCell(2, colIdx);
      cell.value = label;
      styleCell(cell, { bold: true, size: 9, bg: 'F2F2F2' });
    }

    // ── Data rows ────────────────────────────────────────────
    let rowNum = 3;
    for (const farmer of farmers) {
      const r = rowNum;

      // Build daily map: day -> total litres
      const dailyMap: Record<number, number> = {};
      for (let d = 1; d <= 31; d++) dailyMap[d] = 0;
      collections
        .filter(c => c.farmerId === farmer.id)
        .forEach(c => {
          const day = new Date(c.collectedAt).getDate();
          dailyMap[day] = (dailyMap[day] ?? 0) + Number(c.litres);
        });

      // Build advance slots by date (5th, 10th, 15th, 20th, 25th)
      const advSlots: Record<number, number> = { 5: 0, 10: 0, 15: 0, 20: 0, 25: 0 };
      let emerAI = 0;
      advances
        .filter(a => a.farmerId === farmer.id)
        .forEach(a => {
          const day = new Date(a.advanceDate).getDate();
          if ([5, 10, 15, 20, 25].includes(day)) {
            advSlots[day] = (advSlots[day] ?? 0) + Number(a.amount);
          } else {
            emerAI += Number(a.amount);
          }
        });

      const prevPay = prevPayMap.get(farmer.id);
      const balBf = prevPay ? Number((prevPay as any).endMonthCf ?? 0) : 0;

      // Month cell
      c = ws.getCell(r, C_MONTH);
      c.value = `${monthName.substring(0,3)}-${String(y).slice(2)}`;
      styleCell(c, { size: 9 });

      // M.NO
      c = ws.getCell(r, C_MNO);
      c.value = (farmer as any).memberNo ?? null;
      styleCell(c, { size: 9 });

      // Names
      const nameParts = farmer.name.split(' ');
      c = ws.getCell(r, C_FNAME);
      c.value = nameParts[0] ?? farmer.name;
      styleCell(c, { size: 9, align: 'left' });

      c = ws.getCell(r, C_LNAME);
      c.value = nameParts.slice(1).join(' ') || '';
      styleCell(c, { size: 9, align: 'left' });

      // Daily litres
      for (let d = 1; d <= 31; d++) {
        c = ws.getCell(r, C_DAY1 + d - 1);
        const val = dailyMap[d];
        c.value = d <= daysInMonth && val > 0 ? val : null;
        styleCell(c, { size: 9, fmt: LITRES_FMT });
      }

      // Total 15th - formula
      c = ws.getCell(r, C_TOT15);
      c.value = { formula: `SUM(${col(C_DAY1)}${r}:${col(C_DAY1+14)}${r})` };
      styleCell(c, { bold: true, bg: 'E2EFDA', size: 9, fmt: LITRES_FMT });

      // TL - total litres formula (sum all days)
      c = ws.getCell(r, C_TL);
      c.value = { formula: `SUM(${col(C_DAY1)}${r}:${col(C_DAY31)}${r})` };
      styleCell(c, { bold: true, bg: 'E2EFDA', size: 9, fmt: LITRES_FMT });

      // TM - total money formula
      const price = Number(farmer.pricePerLitre);
      c = ws.getCell(r, C_TM);
      c.value = { formula: `${col(C_TL)}${r}*${price}` };
      styleCell(c, { bold: true, bg: 'E2EFDA', size: 9, fmt: MONEY_FMT });

      // Bal b/f
      c = ws.getCell(r, C_BALBF);
      c.value = balBf || null;
      styleCell(c, { size: 9, bg: 'FFF2CC', fmt: MONEY_FMT });

      // Advance slots
      const advCols = [C_ADV5, C_ADV10, C_ADV15, C_ADV20, C_ADV25];
      const advDays = [5, 10, 15, 20, 25];
      for (let i = 0; i < 5; i++) {
        c = ws.getCell(r, advCols[i]);
        c.value = advSlots[advDays[i]] || null;
        styleCell(c, { size: 9, bg: 'FFF2CC', fmt: MONEY_FMT });
      }

      // EMER/AI
      c = ws.getCell(r, C_EMERAI);
      c.value = emerAI || null;
      styleCell(c, { size: 9, bg: 'FFF2CC', fmt: MONEY_FMT });

      // Total Advances - formula
      c = ws.getCell(r, C_TOTADV);
      c.value = { formula: `SUM(${col(C_BALBF)}${r}:${col(C_EMERAI)}${r})` };
      styleCell(c, { bold: true, size: 9, bg: 'FCE4D6', fmt: MONEY_FMT });

      // Amt Payable - formula TM - TotalAdv
      c = ws.getCell(r, C_AMTPAY);
      c.value = { formula: `${col(C_TM)}${r}-${col(C_TOTADV)}${r}` };
      styleCell(c, { bold: true, size: 9, bg: 'FCE4D6', fmt: MONEY_FMT });

      // Due Date
      c = ws.getCell(r, C_DUEDATE);
      c.value = farmer.paidOn15th ? 'MID MONTH' : 'END MONTH';
      styleCell(c, { size: 9 });

      // Mode of Payment
      const mode = farmer.paymentMethod;
      const modeBg = mode === 'MPESA' ? 'C6EFCE' : 'DDEEFF';
      c = ws.getCell(r, C_MODE);
      c.value = mode;
      styleCell(c, { bold: true, size: 9, bg: modeBg });

      // Account details (M-Pesa phone or bank account)
      c = ws.getCell(r, C_ACCOUNT);
      c.value = farmer.mpesaPhone ?? farmer.bankAccount ?? null;
      styleCell(c, { size: 9 });

      // Mid month: TM up to 15th × price
      c = ws.getCell(r, C_MIDTM);
      c.value = { formula: `${col(C_TOT15)}${r}*${price}` };
      styleCell(c, { size: 9, bg: 'DDEEFF', fmt: MONEY_FMT });

      // Mid Total Ad (advances up to 15th)
      c = ws.getCell(r, C_MIDADV);
      c.value = { formula: `SUM(${col(C_BALBF)}${r}:${col(C_ADV15)}${r})` };
      styleCell(c, { size: 9, bg: 'DDEEFF', fmt: MONEY_FMT });

      // Mid Payable
      c = ws.getCell(r, C_MIDPAY);
      c.value = { formula: `${col(C_MIDTM)}${r}-${col(C_MIDADV)}${r}` };
      styleCell(c, { size: 9, bg: 'DDEEFF', fmt: MONEY_FMT });

      // Mid C/f (-ves) — negative means they owe
      c = ws.getCell(r, C_MIDCF);
      c.value = { formula: `IF(${col(C_MIDPAY)}${r}<0,${col(C_MIDPAY)}${r},0)` };
      styleCell(c, { size: 9, bg: 'DDEEFF', fmt: MONEY_FMT });

      // End Payable
      c = ws.getCell(r, C_ENDPAY);
      c.value = { formula: `${col(C_AMTPAY)}${r}` };
      styleCell(c, { size: 9, bg: 'FCE4D6', fmt: MONEY_FMT });

      // End C/f (-ves)
      c = ws.getCell(r, C_ENDCF);
      c.value = { formula: `IF(${col(C_ENDPAY)}${r}<0,${col(C_ENDPAY)}${r},0)` };
      styleCell(c, { size: 9, bg: 'FCE4D6', fmt: MONEY_FMT });

      rowNum++;
    }

    // ── Totals row ───────────────────────────────────────────
    const lastRow = rowNum - 1;
    const totRow  = rowNum + 1;

    ws.getRow(totRow).height = 18;
    c = ws.getCell(totRow, C_FNAME);
    c.value = 'TOTALS';
    styleCell(c, { bold: true, size: 10, bg: 'F2F2F2' });

    const sumCols = [C_TL, C_TM, C_TOTADV, C_AMTPAY, C_MIDTM, C_MIDPAY, C_ENDPAY];
    for (const sc of sumCols) {
      c = ws.getCell(totRow, sc);
      c.value = { formula: `SUM(${col(sc)}3:${col(sc)}${lastRow})` };
      styleCell(c, { bold: true, size: 10, bg: 'F2F2F2', fmt: MONEY_FMT });
    }
  }

  // ── Stream response ──────────────────────────────────────
  const filename = `Gutoria_Journal_${monthName}_${y}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}
