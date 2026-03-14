import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getTrips, upsertTrip, createDrop, updateDrop, deleteDrop,
  createExpense, updateExpense, deleteExpense, getDriverSummary,
} from '../controllers/driver.controller';

const router = Router();
router.use(authenticate);

router.get('/trips', getTrips);
router.post('/trips/upsert', upsertTrip);
router.get('/summary', getDriverSummary);
router.post('/drops', createDrop);
router.put('/drops/:id', updateDrop);
router.delete('/drops/:id', deleteDrop);
router.post('/expenses', createExpense);
router.put('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

export default router;
