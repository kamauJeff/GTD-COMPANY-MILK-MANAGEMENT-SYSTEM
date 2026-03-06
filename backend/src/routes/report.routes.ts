import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { collectionGrid, monthlyFarmerStatement, factoryEfficiency } from '../controllers/report.controller';
import { exportJournal } from '../controllers/journal.controller';

const router = Router();
router.use(authenticate);
router.get('/collection-grid', collectionGrid);
router.get('/farmer-statement/:farmerId', monthlyFarmerStatement);
router.get('/factory-efficiency', factoryEfficiency);
router.get('/journal', authorize('ADMIN','OFFICE'), exportJournal);
export default router;
