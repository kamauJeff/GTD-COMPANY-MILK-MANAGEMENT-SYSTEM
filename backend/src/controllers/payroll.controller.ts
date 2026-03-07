// src/controllers/payroll.controller.ts
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

const MONTHS_EN = ['','January','February','March','April','May','June',
  'July','August','September','October','November','December'];

// ── GET /api/payroll?month&year&role ──────────────────────────
export async function getPayroll(req: Request, res: Response) {
  const { month, year, role } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const where: any = { periodMonth: Number(month), periodYear: Number(year) };

  const payrolls = await prisma.payroll.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true, code: true, name: true, role: true, phone: true,
          salary: true, bankName: true, bankAccount: true,
          paymentMethod: true, isActive: true,
        },
      },
    },
    orderBy: [{ employee: { role: 'asc' } }, { employee: { name: 'asc' } }],
  });

  // Filter by role after join
  const filtered = role
    ? payrolls.filter(p => p.employee.role === String(role).toUpperCase())
    : payrolls;

  const totals = {
    count:      filtered.length,
    baseSalary: Number(filtered.reduce((s, p) => s + Number(p.baseSalary), 0).toFixed(2)),
    deductions: Number(filtered.reduce((s, p) => s + Number(p.varianceDeductions) + Number(p.otherDeductions), 0).toFixed(2)),
    netPay:     Number(filtered.reduce((s, p) => s + Number(p.netPay), 0).toFixed(2)),
    pending:    filtered.filter(p => p.status === 'PENDING').length,
    approved:   filtered.filter(p => p.status === 'APPROVED').length,
    paid:       filtered.filter(p => p.status === 'PAID').length,
  };

  res.json({ payrolls: filtered, totals });
}

// ── POST /api/payroll/run ─────────────────────────────────────
// Generate payroll entries for a month (upsert — safe to re-run)
export async function runPayroll(req: Request, res: Response) {
  const { month, year, role } = req.body;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);

  const where: any = { isActive: true };
  if (role) where.role = String(role).toUpperCase();

  const employees = await prisma.employee.findMany({ where });

  const results: any[] = [];
  for (const emp of employees) {
    // Sum any variance deductions logged for this period
    const variances = await prisma.varianceRecord.findMany({
      where: { employeeId: emp.id, periodMonth: m, periodYear: y },
    });
    const varianceDed = Number(variances.reduce((s, v) => s + Number(v.amount), 0).toFixed(2));

    // Sum other deductions already recorded
    const otherDed = 0; // managed separately via /api/payroll/deduction

    const baseSalary = Number(emp.salary);
    const netPay     = Number((baseSalary - varianceDed - otherDed).toFixed(2));

    const payroll = await prisma.payroll.upsert({
      where: { employeeId_periodMonth_periodYear: { employeeId: emp.id, periodMonth: m, periodYear: y } },
      update: { baseSalary, varianceDeductions: varianceDed, netPay },
      create: { employeeId: emp.id, periodMonth: m, periodYear: y, baseSalary, varianceDeductions: varianceDed, otherDeductions: 0, netPay, status: 'PENDING' },
    });

    results.push({ id: payroll.id, name: emp.name, baseSalary, varianceDed, netPay });
  }

  res.json({ processed: results.length, period: `${MONTHS_EN[m]} ${y}`, results });
}

// ── POST /api/payroll/approve ─────────────────────────────────
export async function approvePayroll(req: Request, res: Response) {
  const { month, year, role } = req.body;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const where: any = { periodMonth: Number(month), periodYear: Number(year), status: 'PENDING' };
  if (role) {
    const emps = await prisma.employee.findMany({ where: { role: String(role).toUpperCase() }, select: { id: true } });
    where.employeeId = { in: emps.map(e => e.id) };
  }

  const result = await prisma.payroll.updateMany({ where, data: { status: 'APPROVED' } });
  res.json({ approved: result.count, period: `${MONTHS_EN[Number(month)]} ${Number(year)}` });
}

// ── POST /api/payroll/deduction ───────────────────────────────
// Add a one-off deduction to an employee's payroll entry
export async function addDeduction(req: Request, res: Response) {
  const { employeeId, month, year, amount, reason } = req.body;
  if (!employeeId || !month || !year || !amount || !reason)
    throw new AppError(400, 'employeeId, month, year, amount, reason required');

  const m = Number(month), y = Number(year);

  // Get or create payroll entry
  const emp = await prisma.employee.findUnique({ where: { id: Number(employeeId) } });
  if (!emp) throw new AppError(404, 'Employee not found');

  let payroll = await prisma.payroll.findUnique({
    where: { employeeId_periodMonth_periodYear: { employeeId: Number(employeeId), periodMonth: m, periodYear: y } },
  });

  if (!payroll) {
    payroll = await prisma.payroll.create({
      data: { employeeId: Number(employeeId), periodMonth: m, periodYear: y, baseSalary: emp.salary, varianceDeductions: 0, otherDeductions: 0, netPay: Number(emp.salary) },
    });
  }

  const newOtherDed = Number(payroll.otherDeductions) + Number(amount);
  const newNetPay   = Number(payroll.baseSalary) - Number(payroll.varianceDeductions) - newOtherDed;

  await prisma.payroll.update({
    where: { id: payroll.id },
    data:  { otherDeductions: newOtherDed, netPay: newNetPay },
  });

  res.json({ message: 'Deduction added', newNetPay });
}

// ── GET /api/payroll/remittance ───────────────────────────────
// Download Excel remittance schedule for K-Unity SACCO
export async function getRemittance(req: Request, res: Response) {
  const { month, year, role } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');

  const m = Number(month), y = Number(year);
  const periodLabel = `${MONTHS_EN[m]} ${y}`;

  const where: any = { periodMonth: m, periodYear: y };
  const empWhere: any = { isActive: true };
  if (role) empWhere.role = String(role).toUpperCase();

  const payrolls = await prisma.payroll.findMany({
    where,
    include: {
      employee: {
        select: { id: true, code: true, name: true, role: true, bankAccount: true, bankName: true, phone: true, salary: true },
      },
    },
    orderBy: [{ employee: { role: 'asc' } }, { employee: { name: 'asc' } }],
  });

  const filtered = role
    ? payrolls.filter(p => p.employee.role === String(role).toUpperCase())
    : payrolls;

  const graderRows    = filtered.filter(p => p.employee.role === 'GRADER');
  const shopkeeperRows= filtered.filter(p => p.employee.role === 'SHOPKEEPER');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gutoria Dairies';
  wb.created = new Date();

  const HEADER_COLOR = 'FF1E3A5F';
  const ACCENT       = 'FFE8F0FF';

  function buildSheet(ws: ExcelJS.Worksheet, rows: typeof filtered, sheetTitle: string) {
    ws.columns = [
      { key: 'no',      width: 6  },
      { key: 'code',    width: 10 },
      { key: 'name',    width: 28 },
      { key: 'account', width: 22 },
      { key: 'gross',   width: 16 },
      { key: 'vardед',  width: 16 },
      { key: 'otherdед',width: 16 },
      { key: 'netpay',  width: 16 },
      { key: 'status',  width: 12 },
    ];

    // Title rows
    const t1 = ws.addRow([`GUTORIA DAIRIES — ${sheetTitle.toUpperCase()} PAYROLL`]);
    t1.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
    ws.mergeCells('A1:I1');

    const t2 = ws.addRow([`Period: ${periodLabel}   |   K-Unity SACCO  |  Generated: ${new Date().toLocaleString('en-KE')}`]);
    t2.font = { italic: true, size: 10 };
    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
    ws.mergeCells('A2:I2');

    ws.addRow([]);

    // Headers
    const hdr = ws.addRow(['#', 'CODE', 'FULL NAME', 'K-UNITY ACC NO.', 'GROSS SALARY', 'VARIANCE DED.', 'OTHER DED.', 'NET PAY', 'STATUS']);
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
    hdr.alignment = { horizontal: 'center', vertical: 'middle' };
    hdr.height = 20;

    // Data
    rows.forEach((p, i) => {
      const r = ws.addRow([
        i + 1,
        p.employee.code,
        p.employee.name,
        p.employee.bankAccount ?? '',
        Number(p.baseSalary),
        Number(p.varianceDeductions),
        Number(p.otherDeductions),
        Number(p.netPay),
        p.status,
      ]);
      if (i % 2 === 0) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      r.getCell(5).numFmt = '#,##0.00';
      r.getCell(6).numFmt = '#,##0.00';
      r.getCell(7).numFmt = '#,##0.00';
      r.getCell(8).numFmt = '#,##0.00';
      r.getCell(8).font   = { bold: true, color: { argb: Number(p.netPay) < 0 ? 'FFDC2626' : 'FF166534' } };
      r.getCell(9).font   = { color: { argb: p.status === 'PAID' ? 'FF166534' : p.status === 'APPROVED' ? 'FF1D4ED8' : 'FF6B7280' } };
    });

    // Totals
    ws.addRow([]);
    const tot = ws.addRow([
      '', '', '', 'TOTAL',
      rows.reduce((s, p) => s + Number(p.baseSalary), 0),
      rows.reduce((s, p) => s + Number(p.varianceDeductions), 0),
      rows.reduce((s, p) => s + Number(p.otherDeductions), 0),
      rows.reduce((s, p) => s + Number(p.netPay), 0),
      `${rows.length} staff`,
    ]);
    tot.font = { bold: true };
    tot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
    [5,6,7,8].forEach(c => { tot.getCell(c).numFmt = '#,##0.00'; });

    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
  }

  if (graderRows.length > 0) {
    const ws = wb.addWorksheet('GRADERS', { properties: { tabColor: { argb: 'FF1E3A5F' } } });
    buildSheet(ws, graderRows, 'Graders');
  }

  if (shopkeeperRows.length > 0) {
    const ws = wb.addWorksheet('SHOPKEEPERS', { properties: { tabColor: { argb: 'FF065F46' } } });
    buildSheet(ws, shopkeeperRows, 'Shopkeepers');
  }

  // Combined summary if both present
  if (graderRows.length > 0 && shopkeeperRows.length > 0) {
    const sumWs = wb.addWorksheet('SUMMARY', { properties: { tabColor: { argb: 'FFDC2626' } } });
    sumWs.columns = [{ width: 20 }, { width: 12 }, { width: 16 }];
    const st = sumWs.addRow(['GUTORIA DAIRIES — PAYROLL SUMMARY']);
    st.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
    sumWs.mergeCells('A1:C1');
    sumWs.addRow([`Period: ${periodLabel}`]);
    sumWs.mergeCells('A2:C2');
    sumWs.addRow([]);

    const sh = sumWs.addRow(['CATEGORY', 'STAFF COUNT', 'TOTAL NET PAY (KES)']);
    sh.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };

    const gTotal = graderRows.reduce((s, p) => s + Number(p.netPay), 0);
    const sTotal = shopkeeperRows.reduce((s, p) => s + Number(p.netPay), 0);

    const gr = sumWs.addRow(['Graders', graderRows.length, gTotal]);
    gr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FF' } };
    gr.getCell(3).numFmt = '#,##0.00';

    const sr = sumWs.addRow(['Shopkeepers', shopkeeperRows.length, sTotal]);
    sr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5EE' } };
    sr.getCell(3).numFmt = '#,##0.00';

    sumWs.addRow([]);
    const totalRow = sumWs.addRow(['GRAND TOTAL', filtered.length, gTotal + sTotal]);
    totalRow.font = { bold: true, size: 12 };
    totalRow.getCell(3).numFmt = '#,##0.00';
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  }

  const filename = `Gutoria_Payroll_${periodLabel.replace(/\s/g, '_')}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ── GET /api/payroll/employees ────────────────────────────────
export async function getEmployees(req: Request, res: Response) {
  const { role, search } = req.query;
  const where: any = { isActive: true };
  if (role)   where.role = String(role).toUpperCase();
  if (search) where.name = { contains: String(search) };

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json(employees);
}

// ── POST /api/payroll/employees ───────────────────────────────
export async function createEmployee(req: Request, res: Response) {
  const { name, role, salary, bankAccount, bankName, phone, paymentMethod } = req.body;
  if (!name || !role || !salary) throw new AppError(400, 'name, role, salary required');

  // Auto-generate code
  const prefix  = role === 'GRADER' ? 'GR' : role === 'SHOPKEEPER' ? 'SK' : 'EMP';
  const count   = await prisma.employee.count({ where: { role: String(role).toUpperCase() } });
  const code    = `${prefix}${String(count + 1).padStart(3, '0')}`;

  const employee = await prisma.employee.create({
    data: {
      code,
      name:          String(name).toUpperCase().trim(),
      phone:         phone ?? '0000000000',
      role:          String(role).toUpperCase(),
      salary:        Number(salary),
      paymentMethod: paymentMethod ?? 'K-UNITY',
      bankName:      bankName ?? 'K-Unity SACCO',
      bankAccount:   bankAccount ?? '',
      isActive:      true,
      passwordHash:  '',
    } as any,
  });
  res.status(201).json(employee);
}

// ── PUT /api/payroll/employees/:id ────────────────────────────
export async function updateEmployee(req: Request, res: Response) {
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data:  req.body,
  });
  res.json(employee);
}

// ── DELETE /api/payroll/employees/:id ─────────────────────────
export async function deactivateEmployee(req: Request, res: Response) {
  await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data:  { isActive: false },
  });
  res.json({ message: 'Employee deactivated' });
}
