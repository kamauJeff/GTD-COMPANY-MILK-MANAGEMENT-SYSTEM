// src/routes/collection.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getCollections,
  createCollection,
  batchSync,
  getDailyRouteTotals,
  getCollectionJournal,
  recordDeduction,
  deleteDeduction,
  getDebtSummary,
} from '../controllers/collection.controller';

const router = Router();
router.use(authenticate);

router.get('/',              getCollections);
router.get('/daily-totals',  getDailyRouteTotals);
router.get('/journal',       getCollectionJournal);   // monthly grid per route
router.get('/debts',         getDebtSummary);          // debt summary across routes
router.post('/',             authorize('GRADER', 'ADMIN'), createCollection);
router.post('/batch',        authorize('GRADER', 'ADMIN'), batchSync);
router.post('/deduction',    authorize('ADMIN', 'OFFICE'), recordDeduction);
router.delete('/deduction/:id', authorize('ADMIN', 'OFFICE'), deleteDeduction);

export default router;
