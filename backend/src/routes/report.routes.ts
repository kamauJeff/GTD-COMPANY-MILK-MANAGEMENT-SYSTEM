import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getOverview, getCollectionsReport, getFarmersReport, getGradersReport, getFactoryReport, getPaymentsReport, getDailyLedger, getShopsReport } from '../controllers/report.controller';

const router = Router();
router.use(authenticate);

router.get('/overview',      getOverview);
router.get('/collections',   getCollectionsReport);
router.get('/farmers',       getFarmersReport);
router.get('/graders',       getGradersReport);
router.get('/factory',       getFactoryReport);
router.get('/payments',      getPaymentsReport);
router.get('/daily-ledger',  getDailyLedger);
router.get('/shops',         getShopsReport);

export default router;
