// src/routes/payment.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getMonthlyPayments,
  recordAdvance,
  deleteAdvance,
  processPayment,
  approvePayments,
  getRouteSummary,
} from '../controllers/payment.controller';

const router = Router();
router.use(authenticate);

router.get('/',           getMonthlyPayments);
router.get('/routes',     getRouteSummary);
router.post('/advance',   authorize('ADMIN', 'OFFICE'), recordAdvance);
router.delete('/advance/:id', authorize('ADMIN', 'OFFICE'), deleteAdvance);
router.post('/process',   authorize('ADMIN', 'OFFICE'), processPayment);
router.post('/approve',   authorize('ADMIN', 'OFFICE'), approvePayments);

export default router;
