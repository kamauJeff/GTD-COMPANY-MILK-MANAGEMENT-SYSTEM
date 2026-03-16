import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getCollections, createCollection, batchSync, getDailyRouteTotals, getGraderDailyTotal } from '../controllers/collection.controller';

const router = Router();
router.use(authenticate);

router.get('/', getCollections);
router.get('/daily-totals', getDailyRouteTotals);
router.get('/grader-total', getGraderDailyTotal);
router.post('/', authorize('GRADER', 'ADMIN'), createCollection);
router.post('/batch', authorize('GRADER', 'ADMIN'), batchSync);

export default router;
