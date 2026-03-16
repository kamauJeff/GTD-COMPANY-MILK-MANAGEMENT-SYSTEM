import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import { getFarmers, getFarmer, createFarmer, updateFarmer, deleteFarmer, importFarmers, exportFarmers, fixPhoneNumbers } from '../controllers/farmer.controller';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
router.use(authenticate);

router.get('/', getFarmers);
router.get('/export', exportFarmers);
router.post('/fix-phones', authorize('ADMIN'), fixPhoneNumbers);
router.get('/:id', getFarmer);
router.post('/', authorize('ADMIN', 'OFFICE'), createFarmer);
router.put('/:id', authorize('ADMIN', 'OFFICE'), updateFarmer);
router.delete('/:id', authorize('ADMIN'), deleteFarmer);
router.post('/import', authorize('ADMIN', 'OFFICE'), upload.single('file'), importFarmers);

export default router;
