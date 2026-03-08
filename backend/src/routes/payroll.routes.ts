// src/routes/payroll.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getPayroll, runPayroll, approvePayroll, addDeduction,
  getRemittance, getEmployees, createEmployee, updateEmployee,
  deactivateEmployee, setSalary, removeFromPayroll,
} from '../controllers/payroll.controller';

const router = Router();
router.use(authenticate);

// ── Payroll entries ───────────────────────────────────────────
router.get('/',                    getPayroll);
router.get('/remittance',          getRemittance);
router.post('/run',                authorize('ADMIN', 'OFFICE'), runPayroll);
router.post('/approve',            authorize('ADMIN', 'OFFICE'), approvePayroll);
router.post('/deduction',          authorize('ADMIN', 'OFFICE'), addDeduction);
router.post('/set-salary',         authorize('ADMIN', 'OFFICE'), setSalary);
router.delete('/:id',              authorize('ADMIN', 'OFFICE'), removeFromPayroll);

// ── Employees / Staff ─────────────────────────────────────────
router.get('/employees',           getEmployees);
router.post('/employees',          authorize('ADMIN', 'OFFICE'), createEmployee);
router.put('/employees/:id',       authorize('ADMIN', 'OFFICE'), updateEmployee);
router.delete('/employees/:id',    authorize('ADMIN'),           deactivateEmployee);

export default router;
