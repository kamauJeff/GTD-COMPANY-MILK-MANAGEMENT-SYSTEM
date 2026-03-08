// src/routes/report.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  collectionGrid, collectionGridExcel,
  monthlyFarmerStatement,
  routePerformance, routePerformanceExcel,
  paymentSummary, paymentSummaryExcel,
  factoryEfficiency,
} from '../controllers/report.controller';

const router = Router();
router.use(authenticate);

router.get('/collection-grid',            collectionGrid);
router.get('/collection-grid/excel',      collectionGridExcel);
router.get('/farmer-statement/:farmerId', monthlyFarmerStatement);
router.get('/route-performance',          routePerformance);
router.get('/route-performance/excel',    routePerformanceExcel);
router.get('/payment-summary',            paymentSummary);
router.get('/payment-summary/excel',      paymentSummaryExcel);
router.get('/factory-efficiency',         factoryEfficiency);

export default router;
