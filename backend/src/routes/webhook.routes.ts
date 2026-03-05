// src/routes/webhook.routes.ts
import { Router } from 'express';
import { kopokopoTillWebhook } from '../controllers/webhook.controller';

const router = Router();
router.post('/kopokopo/till', kopokopoTillWebhook);
export default router;

