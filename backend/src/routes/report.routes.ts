// src/routes/report.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { collectionGrid, monthlyFarmerStatement, factoryEfficiency } from '../controllers/report.controller';

const router = Router();
router.use(authenticate);
router.get('/collection-grid', collectionGrid);
router.get('/farmer-statement/:farmerId', monthlyFarmerStatement);
router.get('/factory-efficiency', factoryEfficiency);
export default router;

