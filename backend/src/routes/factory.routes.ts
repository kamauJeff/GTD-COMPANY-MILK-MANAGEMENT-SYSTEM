// src/routes/factory.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listReceipts, createReceipt, deleteReceipt,
  listBatches, createBatch, updateBatch, deleteBatch,
  listDeliveries, createDelivery, deleteDelivery,
  factoryStats, nextBatchNo, listGraders, listDrivers,
  getLiquidGrid, saveLiquidRecord, deleteLiquidRecord, chargeLiquidLoss, liquidExcel,
} from '../controllers/factory.controller';

const router = Router();
router.use(authenticate);

router.get('/stats',           factoryStats);
router.get('/next-batch-no',   nextBatchNo);
router.get('/graders',         listGraders);
router.get('/drivers',         listDrivers);

router.get('/receipts',        listReceipts);
router.post('/receipts',       createReceipt);
router.delete('/receipts/:id', deleteReceipt);

router.get('/batches',         listBatches);
router.post('/batches',        createBatch);
router.put('/batches/:id',     updateBatch);
router.delete('/batches/:id',  deleteBatch);

router.get('/deliveries',      listDeliveries);
router.post('/deliveries',     createDelivery);
router.delete('/deliveries/:id', deleteDelivery);

// Liquid reconciliation — order matters: excel before :id
router.get('/liquid',           getLiquidGrid);
router.get('/liquid/excel',     liquidExcel);
router.post('/liquid',          saveLiquidRecord);
router.delete('/liquid/:id',    deleteLiquidRecord);
router.post('/liquid/charge',   chargeLiquidLoss);

export default router;
