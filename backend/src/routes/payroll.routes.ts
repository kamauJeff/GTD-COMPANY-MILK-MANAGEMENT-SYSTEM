// src/routes/payroll.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getPayroll, runPayroll, approvePayroll, addDeduction,
  getRemittance, getEmployees, createEmployee, updateEmployee, deactivateEmployee,
} from '../controllers/payroll.controller';

const router = Router();
router.use(authenticate);

// Payroll
router.get('/',              getPayroll);
router.get('/remittance',    getRemittance);
router.post('/run',          authorize('ADMIN', 'OFFICE'), runPayroll);
router.post('/approve',      authorize('ADMIN', 'OFFICE'), approvePayroll);
router.post('/deduction',    authorize('ADMIN', 'OFFICE'), addDeduction);

// Employees (staff)
router.get('/employees',     getEmployees);
router.post('/employees',    authorize('ADMIN', 'OFFICE'), createEmployee);
router.put('/employees/:id', authorize('ADMIN', 'OFFICE'), updateEmployee);
router.delete('/employees/:id', authorize('ADMIN'), deactivateEmployee);

export default router;
