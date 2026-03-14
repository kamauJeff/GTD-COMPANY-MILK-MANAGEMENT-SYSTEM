import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { aiChat } from '../controllers/ai.controller';

const router = Router();

// POST /api/ai/chat — protected, requires login
router.post('/chat', authenticate, aiChat);

export default router;
