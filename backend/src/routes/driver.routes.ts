// src/routes/driver.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getMyTrip, startTrip, addDrop, editDrop, deleteDrop,
  addExpense, deleteExpense, submitTrip, getShops, getTripHistory,
} from '../controllers/driver.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('DRIVER', 'ADMIN', 'FACTORY', 'MANAGER'));

router.get('/shops',              getShops);
router.get('/trip',               getMyTrip);
router.get('/history',            getTripHistory);
router.post('/trip/start',        startTrip);
router.post('/trip/:tripId/drop',              addDrop);
router.put('/trip/:tripId/drop/:dropId',       editDrop);
router.delete('/trip/:tripId/drop/:dropId',    deleteDrop);
router.post('/trip/:tripId/expense',           addExpense);
router.delete('/trip/:tripId/expense/:expenseId', deleteExpense);
router.post('/trip/:tripId/submit',            submitTrip);

export default router;
