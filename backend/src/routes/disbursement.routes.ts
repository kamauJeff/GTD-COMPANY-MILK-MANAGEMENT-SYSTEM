// src/routes/disbursement.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  previewDisbursement,
  disburseMpesaPayments,
  disbursementCallback,
  exportRemittance,
  syncDisbursementStatus,
} from '../controllers/disbursement.controller';

const router = Router();

// Webhook — no auth (KopoKopo calls this)
router.post('/webhook', disbursementCallback);

// All other routes require auth
router.use(authenticate);

router.get('/preview',    previewDisbursement);
router.post('/mpesa',     authorize('ADMIN', 'OFFICE'), disburseMpesaPayments);
router.get('/remittance', exportRemittance);
router.get('/status',     authorize('ADMIN', 'OFFICE'), syncDisbursementStatus);

export default router;
