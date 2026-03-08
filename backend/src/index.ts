// src/index.ts
import 'express-async-errors';
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './config/logger';

// Routes
import authRoutes from './routes/auth.routes';
import farmerRoutes from './routes/farmer.routes';
import routeRoutes from './routes/route.routes';
import employeeRoutes from './routes/employee.routes';
import collectionRoutes from './routes/collection.routes';
import factoryRoutes from './routes/factory.routes';
import shopRoutes from './routes/shop.routes';
import deliveryRoutes from './routes/delivery.routes';
import shopSaleRoutes from './routes/shopSale.routes';
import paymentRoutes from './routes/payment.routes';
import disbursementRoutes from './routes/disbursement.routes';
import payrollRoutes from './routes/payroll.routes';
import reportRoutes from './routes/report.routes';
import webhookRoutes from './routes/webhook.routes';
import driverRoutes from './routes/driver.routes';  // ← moved here with the others

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  '/api/',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false })
);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/factory', factoryRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/shop-sales', shopSaleRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/disbursements', disbursementRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/driver', driverRoutes);  // ← moved here with the others

// ─── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🐄 Gutoria API running on http://localhost:${PORT}`);
});

export default app;