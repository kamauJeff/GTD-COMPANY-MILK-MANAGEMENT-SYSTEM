// src/routes/payroll.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const where: any = { dairyId: req.dairyId! };
  if (month) where.periodMonth = Number(month);
  if (year) where.periodYear = Number(year);
  const payrolls = await prisma.payroll.findMany({
    where,
    include: { employee: { select: { id: true, code: true, name: true, role: true } } },
    orderBy: { employee: { name: 'asc' } },
  });
  res.json(payrolls);
});

router.post('/run', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year } = req.body;
  const m = Number(month); const y = Number(year);
  const employees = await prisma.employee.findMany({ where: { dairyId: req.dairyId!, isActive: true } });
  const created = [];
  for (const emp of employees) {
    const variances = await prisma.varianceRecord.findMany({ where: { dairyId: req.dairyId!, employeeId: emp.id, periodMonth: m, periodYear: y, applied: false } });
    const varianceDeductions = variances.reduce((s, v) => s + Number(v.amount), 0);
    const netPay = Number(emp.salary) - varianceDeductions;
    const payroll = await prisma.payroll.upsert({
      where: { dairyId_employeeId_periodMonth_periodYear: { dairyId: req.dairyId!, employeeId: emp.id, periodMonth: m, periodYear: y } },
      create: { dairyId: req.dairyId!, employeeId: emp.id, periodMonth: m, periodYear: y, baseSalary: emp.salary, varianceDeductions, netPay },
      update: { baseSalary: emp.salary, varianceDeductions, netPay },
    });
    await prisma.varianceRecord.updateMany({ where: { dairyId: req.dairyId!, employeeId: emp.id, periodMonth: m, periodYear: y }, data: { applied: true } });
    created.push(payroll);
  }
  res.json({ processed: created.length });
});

export default router;
