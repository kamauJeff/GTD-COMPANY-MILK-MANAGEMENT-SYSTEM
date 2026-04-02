import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// GET /api/payroll — list payrolls for a period
export const getPayrolls = async (req: Request, res: Response) => {
  const { month, year } = req.query;
  const where: any = { dairyId: req.dairyId! };
  if (month) where.periodMonth = Number(month);
  if (year)  where.periodYear  = Number(year);

  const payrolls = await prisma.payroll.findMany({
    where,
    include: { employee: { select: { id: true, code: true, name: true, role: true, paymentMethod: true, mpesaPhone: true, bankName: true, bankAccount: true } } },
    orderBy: { employee: { name: 'asc' } },
  });
  res.json(payrolls);
};

// POST /api/payroll/run — compute payroll for all employees
export const runPayroll = async (req: Request, res: Response) => {
  const { month, year } = req.body;
  const m = Number(month); const y = Number(year);
  const dairyId = req.dairyId!;

  const employees = await prisma.employee.findMany({
    where: { dairyId, isActive: true, role: { not: 'SUPER_ADMIN' } },
  });

  const created = [];
  for (const emp of employees) {
    const variances = await prisma.varianceRecord.findMany({
      where: { dairyId, employeeId: emp.id, periodMonth: m, periodYear: y, applied: false },
    });
    const varianceDeductions = variances.reduce((s, v) => s + Number(v.amount), 0);
    const netPay = Number(emp.salary) - varianceDeductions;

    const payroll = await prisma.payroll.upsert({
      where: {
        dairyId_employeeId_periodMonth_periodYear: {
          dairyId, employeeId: emp.id, periodMonth: m, periodYear: y,
        },
      },
      create: { dairyId, employeeId: emp.id, periodMonth: m, periodYear: y, baseSalary: emp.salary, varianceDeductions, otherDeductions: 0, netPay, status: 'PENDING' },
      update: { baseSalary: emp.salary, varianceDeductions, netPay },
    });

    if (variances.length > 0) {
      await prisma.varianceRecord.updateMany({
        where: { dairyId, employeeId: emp.id, periodMonth: m, periodYear: y },
        data: { applied: true },
      });
    }
    created.push(payroll);
  }
  res.json({ processed: created.length, payrolls: created });
};

// PATCH /api/payroll/:id/approve — approve a single payroll
export const approvePayroll = async (req: Request, res: Response) => {
  const payroll = await prisma.payroll.update({
    where: { id: Number(req.params.id) },
    data: { status: 'APPROVED' },
    include: { employee: { select: { name: true, code: true } } },
  });
  res.json(payroll);
};

// PATCH /api/payroll/:id/pay — mark as paid with ref
export const markPayrollPaid = async (req: Request, res: Response) => {
  const { kopokopoRef } = req.body;
  const payroll = await prisma.payroll.update({
    where: { id: Number(req.params.id) },
    data: { status: 'PAID', kopokopoRef: kopokopoRef || null, paidAt: new Date() },
  });
  res.json(payroll);
};
