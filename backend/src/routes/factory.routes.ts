import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getStats, getNextBatchNo, getGraders, getDrivers,
  getReceipts, createReceipt, deleteReceipt,
  getBatches, createBatch, updateBatch, deleteBatch,
  getDeliveries, createDelivery, deleteDelivery,
  getLiquidGrid, saveLiquid, deleteLiquid, chargeLoss, getLiquidExcel,
} from '../controllers/factory.controller';

const router = Router();
router.use(authenticate);

router.get('/stats', getStats);
router.get('/next-batch-no', getNextBatchNo);
router.get('/graders', getGraders);
router.get('/drivers', getDrivers);

router.get('/receipts', getReceipts);
router.post('/receipts', createReceipt);
router.delete('/receipts/:id', deleteReceipt);

router.get('/batches', getBatches);
router.post('/batches', createBatch);
router.put('/batches/:id', updateBatch);
router.delete('/batches/:id', deleteBatch);

router.get('/deliveries', getDeliveries);
router.post('/deliveries', createDelivery);
router.delete('/deliveries/:id', deleteDelivery);

router.get('/liquid', getLiquidGrid);
router.post('/liquid', saveLiquid);
router.delete('/liquid/:id', deleteLiquid);
router.post('/liquid/charge', chargeLoss);
router.get('/liquid/excel', getLiquidExcel);

export default router;
