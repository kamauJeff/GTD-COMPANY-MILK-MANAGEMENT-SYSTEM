import { Router } from 'express';
import { getFarmerStatement } from '../controllers/farmerPortal.controller';

const router = Router();

// Public endpoint - no auth required
// GET /api/farmer-portal/statement?code=FM0668&month=9&year=2024&period=end
router.get('/statement', getFarmerStatement);

export default router;
