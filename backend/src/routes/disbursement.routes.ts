import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { previewDisbursement, getKopokopoBalance } from '../controllers/disbursement.controller';

const router = Router();
router.use(authenticate);

router.get('/preview', authorize('ADMIN', 'OFFICE'), previewDisbursement);
router.get('/balance', authorize('ADMIN', 'OFFICE'), getKopokopoBalance);

export default router;
