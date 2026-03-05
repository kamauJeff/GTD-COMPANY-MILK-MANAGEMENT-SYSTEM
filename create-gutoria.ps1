# ============================================================
# Gutoria Dairies - Full Project Scaffold for Windows
# Open VS Code terminal (PowerShell) and run:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\create-gutoria.ps1
# ============================================================
$base = "gutoria-dairies"
function New-Dir($path) { New-Item -ItemType Directory -Force -Path "$base\$path" | Out-Null }
function New-File {
    param($path, $content)
    $full = "$base\$path"
    $dir = Split-Path $full -Parent
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Set-Content -Path $full -Value $content -Encoding UTF8
}
Write-Host "`n Gutoria Dairies Scaffold" -ForegroundColor Green


New-File "backend\.env.example" @'
# ─── Server ───────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001

# ─── Database (SQL Server via Prisma) ─────────────────────────────────────────
DATABASE_URL="sqlserver://localhost:1433;database=gutoria;user=sa;password=YourPassword;encrypt=true;trustServerCertificate=true"

# ─── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=7d

# ─── Redis (Bull queues) ──────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── Africa's Talking SMS ─────────────────────────────────────────────────────
AT_API_KEY=your_at_api_key
AT_USERNAME=sandbox          # change to your username in production
AT_SENDER_ID=GUTORIA

# ─── Kopokopo ─────────────────────────────────────────────────────────────────
KOPOKOPO_CLIENT_ID=your_client_id
KOPOKOPO_CLIENT_SECRET=your_client_secret
KOPOKOPO_API_URL=https://sandbox.kopokopo.com   # change to live in production
KOPOKOPO_WEBHOOK_SECRET=your_webhook_secret

# ─── Frontend CORS origin ─────────────────────────────────────────────────────
FRONTEND_URL=http://localhost:5173

'@

New-File "backend\package.json" @'
{
  "name": "gutoria-backend",
  "version": "1.0.0",
  "description": "Gutoria Dairies – REST API",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "test": "jest --passWithNoTests",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "africastalking": "^0.6.5",
    "bcryptjs": "^2.4.3",
    "bull": "^4.12.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "exceljs": "^4.4.0",
    "express": "^4.19.2",
    "express-async-errors": "^3.1.1",
    "express-rate-limit": "^7.3.1",
    "express-validator": "^7.1.0",
    "helmet": "^7.1.0",
    "ioredis": "^5.4.1",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "pdfkit": "^0.15.0",
    "winston": "^3.13.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/bull": "^4.10.0",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/morgan": "^1.9.9",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.14.9",
    "@types/pdfkit": "^0.13.4",
    "@typescript-eslint/eslint-plugin": "^7.14.1",
    "@typescript-eslint/parser": "^7.14.1",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "prisma": "^5.14.0",
    "ts-jest": "^29.1.5",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.5.2"
  }
}

'@

New-File "backend\tsconfig.json" @'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}

'@

New-File "backend\prisma\schema.prisma" @'
// prisma/schema.prisma
// Gutoria Dairies – full data model

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum PaymentMethod {
  MPESA
  BANK
}

enum EmployeeRole {
  GRADER
  DRIVER
  SHOPKEEPER
  FACTORY
  OFFICE
  ADMIN
}

enum PayrollStatus {
  PENDING
  APPROVED
  PAID
}

enum VarianceType {
  GRADER_COLLECTION
  DRIVER_DELIVERY
  SHOP_REMITTANCE
}

// ─── Route & Farmer ───────────────────────────────────────────────────────────

model Route {
  id          Int      @id @default(autoincrement())
  code        String   @unique
  name        String
  supervisorId Int?

  supervisor  Employee?  @relation("RouteSupervisor", fields: [supervisorId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  farmers     Farmer[]
  collections MilkCollection[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Farmer {
  id            Int      @id @default(autoincrement())
  code          String   @unique
  name          String
  idNumber      String?
  phone         String
  routeId       Int
  pricePerLitre Decimal  @db.Decimal(10, 2)
  paymentMethod PaymentMethod @default(MPESA)
  mpesaPhone    String?
  bankName      String?
  bankAccount   String?
  paidOn15th    Boolean  @default(false)
  isActive      Boolean  @default(true)

  route         Route    @relation(fields: [routeId], references: [id])
  collections   MilkCollection[]
  advances      FarmerAdvance[]
  deductions    FarmerDeduction[]
  payments      FarmerPayment[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// ─── Employee ─────────────────────────────────────────────────────────────────

model Employee {
  id            Int          @id @default(autoincrement())
  code          String       @unique
  name          String
  phone         String
  role          EmployeeRole
  salary        Decimal      @db.Decimal(10, 2)
  paymentMethod PaymentMethod @default(MPESA)
  mpesaPhone    String?
  bankName      String?
  bankAccount   String?
  isActive      Boolean      @default(true)

  supervisedRoutes  Route[]  @relation("RouteSupervisor")
  managedShop       Shop?    @relation("ShopKeeper")
  collections       MilkCollection[]
  factoryReceipts   FactoryReceipt[]
  deliveries        DeliveryToShop[]
  varianceRecords   VarianceRecord[]
  payrolls          Payroll[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// ─── Milk Collection ──────────────────────────────────────────────────────────

model MilkCollection {
  id          Int      @id @default(autoincrement())
  farmerId    Int
  routeId     Int
  graderId    Int
  litres      Decimal  @db.Decimal(10, 2)
  collectedAt DateTime
  synced      Boolean  @default(false)
  smsSent     Boolean  @default(false)
  receiptNo   String?

  farmer      Farmer   @relation(fields: [farmerId], references: [id])
  route       Route    @relation(fields: [routeId], references: [id])
  grader      Employee @relation(fields: [graderId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([collectedAt])
  @@index([farmerId, collectedAt])
  @@index([routeId, collectedAt])
  @@index([graderId, collectedAt])
}

// ─── Factory ──────────────────────────────────────────────────────────────────

model FactoryReceipt {
  id          Int      @id @default(autoincrement())
  graderId    Int
  litres      Decimal  @db.Decimal(10, 2)
  receivedAt  DateTime
  notes       String?

  grader      Employee @relation(fields: [graderId], references: [id])
  batches     PasteurizationBatch[] @relation("BatchReceipts")

  createdAt   DateTime @default(now())
}

model PasteurizationBatch {
  id              Int      @id @default(autoincrement())
  batchNo         String   @unique
  inputLitres     Decimal  @db.Decimal(10, 2)
  outputLitres    Decimal  @db.Decimal(10, 2)
  lossLitres      Decimal  @db.Decimal(10, 2)  @default(0)
  processedAt     DateTime
  qualityNotes    String?

  receipts        FactoryReceipt[] @relation("BatchReceipts")
  deliveries      DeliveryToShop[]

  createdAt       DateTime @default(now())
}

// ─── Shop & Sales ─────────────────────────────────────────────────────────────

model Shop {
  id              Int      @id @default(autoincrement())
  code            String   @unique
  name            String
  location        String?
  keeperId        Int      @unique
  tillNumber      String?  // Kopokopo till

  keeper          Employee @relation("ShopKeeper", fields: [keeperId], references: [id])
  deliveries      DeliveryToShop[]
  sales           ShopSale[]
  kopokopoTxns    KopokopoTransaction[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model DeliveryToShop {
  id          Int      @id @default(autoincrement())
  batchId     Int
  shopId      Int
  driverId    Int
  litres      Decimal  @db.Decimal(10, 2)
  sellingPrice Decimal @db.Decimal(10, 2)
  deliveredAt DateTime

  batch       PasteurizationBatch @relation(fields: [batchId], references: [id])
  shop        Shop     @relation(fields: [shopId], references: [id])
  driver      Employee @relation(fields: [driverId], references: [id])

  createdAt   DateTime @default(now())
}

model ShopSale {
  id              Int      @id @default(autoincrement())
  shopId          Int
  saleDate        DateTime
  litresSold      Decimal  @db.Decimal(10, 2)
  expectedRevenue Decimal  @db.Decimal(10, 2)
  cashCollected   Decimal  @db.Decimal(10, 2)
  tillAmount      Decimal  @db.Decimal(10, 2) @default(0)
  variance        Decimal  @db.Decimal(10, 2) @default(0)
  reconciled      Boolean  @default(false)

  shop            Shop     @relation(fields: [shopId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ─── Payments ─────────────────────────────────────────────────────────────────

model FarmerAdvance {
  id          Int      @id @default(autoincrement())
  farmerId    Int
  amount      Decimal  @db.Decimal(10, 2)
  advanceDate DateTime
  notes       String?

  farmer      Farmer   @relation(fields: [farmerId], references: [id])
  createdAt   DateTime @default(now())
}

model FarmerDeduction {
  id          Int      @id @default(autoincrement())
  farmerId    Int
  amount      Decimal  @db.Decimal(10, 2)
  reason      String
  deductionDate DateTime
  periodMonth Int
  periodYear  Int

  farmer      Farmer   @relation(fields: [farmerId], references: [id])
  createdAt   DateTime @default(now())
}

model FarmerPayment {
  id              Int      @id @default(autoincrement())
  farmerId        Int
  periodMonth     Int
  periodYear      Int
  isMidMonth      Boolean  @default(false)
  grossPay        Decimal  @db.Decimal(10, 2)
  totalAdvances   Decimal  @db.Decimal(10, 2)
  totalDeductions Decimal  @db.Decimal(10, 2)
  netPay          Decimal  @db.Decimal(10, 2)
  status          PayrollStatus @default(PENDING)
  kopokopoRef     String?
  paidAt          DateTime?

  farmer          Farmer   @relation(fields: [farmerId], references: [id])
  createdAt       DateTime @default(now())

  @@unique([farmerId, periodMonth, periodYear, isMidMonth])
}

// ─── Staff Payroll ────────────────────────────────────────────────────────────

model Payroll {
  id              Int      @id @default(autoincrement())
  employeeId      Int
  periodMonth     Int
  periodYear      Int
  baseSalary      Decimal  @db.Decimal(10, 2)
  varianceDeductions Decimal @db.Decimal(10, 2) @default(0)
  otherDeductions Decimal  @db.Decimal(10, 2) @default(0)
  netPay          Decimal  @db.Decimal(10, 2)
  status          PayrollStatus @default(PENDING)
  kopokopoRef     String?
  paidAt          DateTime?

  employee        Employee @relation(fields: [employeeId], references: [id])
  createdAt       DateTime @default(now())

  @@unique([employeeId, periodMonth, periodYear])
}

model VarianceRecord {
  id          Int          @id @default(autoincrement())
  employeeId  Int
  type        VarianceType
  amount      Decimal      @db.Decimal(10, 2)
  recordDate  DateTime
  periodMonth Int
  periodYear  Int
  description String?
  applied     Boolean      @default(false)

  employee    Employee     @relation(fields: [employeeId], references: [id])
  createdAt   DateTime     @default(now())
}

// ─── Kopokopo ─────────────────────────────────────────────────────────────────

model KopokopoTransaction {
  id              Int      @id @default(autoincrement())
  shopId          Int
  tillNumber      String
  amount          Decimal  @db.Decimal(10, 2)
  transactionRef  String   @unique
  transactionDate DateTime
  matched         Boolean  @default(false)

  shop            Shop     @relation(fields: [shopId], references: [id])
  createdAt       DateTime @default(now())
}

'@

New-File "backend\src\index.ts" @'
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
import payrollRoutes from './routes/payroll.routes';
import reportRoutes from './routes/report.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security & middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Raw body for webhook signature verification (must come before json parser)
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit public endpoints
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
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/webhooks', webhookRoutes);

// ─── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🐄 Gutoria API running on http://localhost:${PORT}`);
});

export default app;

'@

New-File "backend\src\config\prisma.ts" @'
// src/config/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

'@

New-File "backend\src\config\logger.ts" @'
// src/config/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.colorize(),
    process.env.NODE_ENV === 'production'
      ? winston.format.simple()
      : winston.format.printf(({ level, message, timestamp, stack }) =>
          `${timestamp} [${level}]: ${stack || message}`
        )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

'@

New-File "backend\src\middleware\auth.ts" @'
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { EmployeeRole } from '@prisma/client';

export interface AuthPayload {
  sub: number;       // employee id
  role: EmployeeRole;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

export function authorize(...roles: EmployeeRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

'@

New-File "backend\src\middleware\errorHandler.ts" @'
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Prisma unique constraint
  if ((err as any).code === 'P2002') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }

  logger.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

'@

New-File "backend\src\controllers\auth.controller.ts" @'
// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export async function login(req: Request, res: Response) {
  const { code, password } = req.body;
  if (!code || !password) throw new AppError(400, 'code and password are required');

  const employee = await prisma.employee.findUnique({ where: { code } });
  if (!employee || !(employee as any).passwordHash) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, (employee as any).passwordHash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  const token = jwt.sign(
    { sub: employee.id, role: employee.role, name: employee.name },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({ token, employee: { id: employee.id, name: employee.name, role: employee.role } });
}

export async function me(req: Request, res: Response) {
  const employee = await prisma.employee.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, code: true, name: true, phone: true, role: true },
  });
  if (!employee) throw new AppError(404, 'Employee not found');
  res.json(employee);
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const employee = await prisma.employee.findUnique({ where: { id: req.user!.sub } });
  if (!employee) throw new AppError(404, 'Employee not found');

  const valid = await bcrypt.compare(currentPassword, (employee as any).passwordHash ?? '');
  if (!valid) throw new AppError(401, 'Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.employee.update({ where: { id: employee.id }, data: { passwordHash: hash } as any });
  res.json({ message: 'Password updated' });
}

'@

New-File "backend\src\controllers\farmer.controller.ts" @'
// src/controllers/farmer.controller.ts
import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

export async function getFarmers(req: Request, res: Response) {
  const { routeId, search, page = '1', limit = '50' } = req.query;
  const where: any = { isActive: true };
  if (routeId) where.routeId = Number(routeId);
  if (search) where.name = { contains: String(search) };

  const [total, farmers] = await Promise.all([
    prisma.farmer.count({ where }),
    prisma.farmer.findMany({
      where,
      include: { route: { select: { id: true, code: true, name: true } } },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { name: 'asc' },
    }),
  ]);

  res.json({ data: farmers, total, page: Number(page), limit: Number(limit) });
}

export async function getFarmer(req: Request, res: Response) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      route: true,
      collections: { orderBy: { collectedAt: 'desc' }, take: 31 },
      advances: { orderBy: { advanceDate: 'desc' }, take: 10 },
    },
  });
  if (!farmer) throw new AppError(404, 'Farmer not found');
  res.json(farmer);
}

export async function createFarmer(req: Request, res: Response) {
  const farmer = await prisma.farmer.create({ data: req.body });
  res.status(201).json(farmer);
}

export async function updateFarmer(req: Request, res: Response) {
  const farmer = await prisma.farmer.update({
    where: { id: Number(req.params.id) },
    data: req.body,
  });
  res.json(farmer);
}

export async function deleteFarmer(req: Request, res: Response) {
  await prisma.farmer.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.json({ message: 'Farmer deactivated' });
}

// ─── Excel Import ──────────────────────────────────────────────────────────────
export async function importFarmers(req: Request, res: Response) {
  if (!req.file) throw new AppError(400, 'No file uploaded');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);
  const ws = wb.worksheets[0];

  const rows: any[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    rows.push({
      code: String(row.getCell(1).value ?? '').trim(),
      name: String(row.getCell(2).value ?? '').trim(),
      idNumber: String(row.getCell(3).value ?? '').trim() || null,
      phone: String(row.getCell(4).value ?? '').trim(),
      routeId: Number(row.getCell(5).value),
      pricePerLitre: Number(row.getCell(6).value),
      paymentMethod: String(row.getCell(7).value ?? 'MPESA').toUpperCase(),
      mpesaPhone: String(row.getCell(8).value ?? '').trim() || null,
      paidOn15th: String(row.getCell(9).value ?? '').toLowerCase() === 'yes',
    });
  });

  let created = 0, updated = 0;
  for (const data of rows) {
    if (!data.code || !data.name) continue;
    await prisma.farmer.upsert({
      where: { code: data.code },
      create: data,
      update: data,
    });
    created++;
  }

  res.json({ message: `Import complete: ${created} records processed` });
}

// ─── Excel Export ──────────────────────────────────────────────────────────────
export async function exportFarmers(req: Request, res: Response) {
  const farmers = await prisma.farmer.findMany({
    where: { isActive: true },
    include: { route: true },
    orderBy: { name: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Farmers');
  ws.columns = [
    { header: 'Code', key: 'code', width: 12 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'ID Number', key: 'idNumber', width: 16 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Route', key: 'route', width: 20 },
    { header: 'Price/Litre', key: 'pricePerLitre', width: 12 },
    { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    { header: 'M-Pesa Phone', key: 'mpesaPhone', width: 16 },
    { header: 'Paid on 15th', key: 'paidOn15th', width: 12 },
  ];

  farmers.forEach((f) =>
    ws.addRow({
      ...f,
      route: f.route.name,
      paidOn15th: f.paidOn15th ? 'Yes' : 'No',
    })
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=farmers.xlsx');
  await wb.xlsx.write(res);
  res.end();
}

'@

New-File "backend\src\controllers\collection.controller.ts" @'
// src/controllers/collection.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendCollectionSMS } from '../services/sms.service';

export async function getCollections(req: Request, res: Response) {
  const { routeId, farmerId, date, page = '1', limit = '100' } = req.query;
  const where: any = {};
  if (routeId) where.routeId = Number(routeId);
  if (farmerId) where.farmerId = Number(farmerId);
  if (date) {
    const d = new Date(String(date));
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    where.collectedAt = { gte: d, lt: next };
  }

  const [total, collections] = await Promise.all([
    prisma.milkCollection.count({ where }),
    prisma.milkCollection.findMany({
      where,
      include: {
        farmer: { select: { id: true, code: true, name: true, phone: true } },
        route: { select: { id: true, name: true } },
        grader: { select: { id: true, name: true } },
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { collectedAt: 'desc' },
    }),
  ]);

  res.json({ data: collections, total });
}

export async function createCollection(req: Request, res: Response) {
  const { farmerId, litres, collectedAt } = req.body;

  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
  if (!farmer) throw new AppError(404, 'Farmer not found');

  const collection = await prisma.milkCollection.create({
    data: {
      farmerId,
      routeId: farmer.routeId,
      graderId: req.user!.sub,
      litres,
      collectedAt: new Date(collectedAt),
      synced: true,
    },
  });

  // Fire-and-forget SMS
  sendCollectionSMS(farmer, collection).catch(() => {});

  res.status(201).json(collection);
}

// Bulk sync from offline mobile app
export async function batchSync(req: Request, res: Response) {
  const records: any[] = req.body.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new AppError(400, 'records array is required');
  }

  const results = { created: 0, failed: 0, errors: [] as string[] };

  for (const r of records) {
    try {
      const farmer = await prisma.farmer.findUnique({ where: { id: r.farmerId } });
      if (!farmer) { results.failed++; results.errors.push(`Unknown farmer ${r.farmerId}`); continue; }

      await prisma.milkCollection.create({
        data: {
          farmerId: r.farmerId,
          routeId: farmer.routeId,
          graderId: req.user!.sub,
          litres: r.litres,
          collectedAt: new Date(r.collectedAt),
          receiptNo: r.receiptNo,
          synced: true,
        },
      });
      results.created++;

      sendCollectionSMS(farmer, { litres: r.litres, collectedAt: r.collectedAt } as any).catch(() => {});
    } catch (e: any) {
      results.failed++;
      results.errors.push(e.message);
    }
  }

  res.json(results);
}

export async function getDailyRouteTotals(req: Request, res: Response) {
  const { date } = req.query;
  const d = date ? new Date(String(date)) : new Date();
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);

  const totals = await prisma.milkCollection.groupBy({
    by: ['routeId'],
    where: { collectedAt: { gte: d, lt: next } },
    _sum: { litres: true },
    _count: { farmerId: true },
  });

  const routes = await prisma.route.findMany({ select: { id: true, code: true, name: true } });
  const routeMap = Object.fromEntries(routes.map((r) => [r.id, r]));

  res.json(
    totals.map((t) => ({
      route: routeMap[t.routeId],
      totalLitres: t._sum.litres ?? 0,
      farmerCount: t._count.farmerId,
    }))
  );
}

'@

New-File "backend\src\controllers\report.controller.ts" @'
// src/controllers/report.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

// Monthly grid: rows = farmers, columns = days 1-31, cells = litres
export async function collectionGrid(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');

  const m = Number(month);
  const y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const where: any = { collectedAt: { gte: start, lt: end } };
  if (routeId) where.routeId = Number(routeId);

  const collections = await prisma.milkCollection.findMany({
    where,
    select: { farmerId: true, litres: true, collectedAt: true },
  });

  const farmerIds = [...new Set(collections.map((c) => c.farmerId))];
  const farmers = await prisma.farmer.findMany({
    where: { id: { in: farmerIds } },
    select: { id: true, code: true, name: true, pricePerLitre: true },
    orderBy: { name: 'asc' },
  });

  // Build grid
  const daysInMonth = new Date(y, m, 0).getDate();
  const grid = farmers.map((farmer) => {
    const days: Record<number, number> = {};
    for (let d = 1; d <= daysInMonth; d++) days[d] = 0;

    collections
      .filter((c) => c.farmerId === farmer.id)
      .forEach((c) => {
        const day = new Date(c.collectedAt).getDate();
        days[day] = (days[day] ?? 0) + Number(c.litres);
      });

    const total = Object.values(days).reduce((a, b) => a + b, 0);
    return { farmer, days, total, grossPay: total * Number(farmer.pricePerLitre) };
  });

  res.json({ month: m, year: y, daysInMonth, data: grid });
}

export async function monthlyFarmerStatement(req: Request, res: Response) {
  const { farmerId } = req.params;
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');

  const m = Number(month);
  const y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const [farmer, collections, advances, deductions] = await Promise.all([
    prisma.farmer.findUnique({ where: { id: Number(farmerId) } }),
    prisma.milkCollection.findMany({ where: { farmerId: Number(farmerId), collectedAt: { gte: start, lt: end } }, orderBy: { collectedAt: 'asc' } }),
    prisma.farmerAdvance.findMany({ where: { farmerId: Number(farmerId), advanceDate: { gte: start, lt: end } } }),
    prisma.farmerDeduction.findMany({ where: { farmerId: Number(farmerId), periodMonth: m, periodYear: y } }),
  ]);

  if (!farmer) throw new AppError(404, 'Farmer not found');

  const totalLitres = collections.reduce((s, c) => s + Number(c.litres), 0);
  const grossPay = totalLitres * Number(farmer.pricePerLitre);
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
  const netPay = grossPay - totalAdvances - totalDeductions;

  res.json({ farmer, collections, advances, deductions, summary: { totalLitres, grossPay, totalAdvances, totalDeductions, netPay } });
}

export async function factoryEfficiency(req: Request, res: Response) {
  const { month, year } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year are required');
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 1);

  const batches = await prisma.pasteurizationBatch.findMany({
    where: { processedAt: { gte: start, lt: end } },
  });

  const totalInput = batches.reduce((s, b) => s + Number(b.inputLitres), 0);
  const totalOutput = batches.reduce((s, b) => s + Number(b.outputLitres), 0);
  const totalLoss = batches.reduce((s, b) => s + Number(b.lossLitres), 0);
  const efficiencyPct = totalInput > 0 ? ((totalOutput / totalInput) * 100).toFixed(2) : '0';

  res.json({ batches, summary: { totalInput, totalOutput, totalLoss, efficiencyPct } });
}

'@

New-File "backend\src\controllers\webhook.controller.ts" @'
// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { logger } from '../config/logger';

function verifySignature(rawBody: Buffer, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.KOPOKOPO_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function kopokopoTillWebhook(req: Request, res: Response) {
  const signature = req.headers['x-kopokopo-signature'] as string;
  if (!signature || !verifySignature(req.body as Buffer, signature)) {
    logger.warn('Kopokopo webhook: invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const payload = JSON.parse((req.body as Buffer).toString());
  logger.info('Kopokopo webhook received', { event: payload.event?.type });

  // Acknowledge immediately
  res.status(200).send('OK');

  try {
    const { data } = payload;
    if (!data) return;

    const tillNumber = data.resource?.till_number;
    const amount = parseFloat(data.resource?.amount ?? '0');
    const ref = data.resource?.reference;
    const txnDate = new Date(data.resource?.origination_time ?? Date.now());

    if (!tillNumber || !ref) return;

    const shop = await prisma.shop.findFirst({ where: { tillNumber } });
    if (!shop) {
      logger.warn(`Kopokopo: no shop for till ${tillNumber}`);
      return;
    }

    await prisma.kopokopoTransaction.upsert({
      where: { transactionRef: ref },
      create: { shopId: shop.id, tillNumber, amount, transactionRef: ref, transactionDate: txnDate },
      update: {},
    });

    // Try to match today's ShopSale
    const startOfDay = new Date(txnDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const sale = await prisma.shopSale.findFirst({
      where: { shopId: shop.id, saleDate: { gte: startOfDay, lt: endOfDay }, reconciled: false },
    });

    if (sale) {
      await prisma.shopSale.update({
        where: { id: sale.id },
        data: { tillAmount: { increment: amount }, reconciled: true },
      });
    }
  } catch (err) {
    logger.error('Kopokopo webhook processing error', err);
  }
}

'@

New-File "backend\src\services\sms.service.ts" @'
// src/services/sms.service.ts
import AfricasTalking from 'africastalking';
import { Farmer, MilkCollection } from '@prisma/client';
import { logger } from '../config/logger';

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY!,
  username: process.env.AT_USERNAME!,
});
const sms = at.SMS;

export async function sendCollectionSMS(farmer: Farmer, collection: Pick<MilkCollection, 'litres' | 'collectedAt'>) {
  if (!farmer.phone) return;

  const date = new Date(collection.collectedAt).toLocaleDateString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const message = `Dear ${farmer.name}, we received ${collection.litres}L of milk on ${date}. Thank you - Gutoria Dairies.`;

  try {
    await sms.send({
      to: [farmer.phone],
      message,
      from: process.env.AT_SENDER_ID,
    });
    logger.info(`SMS sent to farmer ${farmer.code}`);
  } catch (err) {
    logger.error(`SMS failed for farmer ${farmer.code}:`, err);
    throw err;
  }
}

export async function sendPaymentSMS(phone: string, name: string, amount: number, period: string) {
  const message = `Dear ${name}, your milk payment of KES ${amount.toLocaleString()} for ${period} has been sent. Thank you - Gutoria Dairies.`;
  return sms.send({ to: [phone], message, from: process.env.AT_SENDER_ID });
}

'@

New-File "backend\src\routes\auth.routes.ts" @'
// src/routes/auth.routes.ts
import { Router } from 'express';
import { login, me, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, changePassword);

export default router;

'@

New-File "backend\src\routes\farmer.routes.ts" @'
// src/routes/farmer.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import {
  getFarmers,
  getFarmer,
  createFarmer,
  updateFarmer,
  deleteFarmer,
  importFarmers,
  exportFarmers,
} from '../controllers/farmer.controller';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(authenticate);

router.get('/', getFarmers);
router.get('/export', exportFarmers);
router.get('/:id', getFarmer);
router.post('/', authorize('ADMIN', 'OFFICE'), createFarmer);
router.put('/:id', authorize('ADMIN', 'OFFICE'), updateFarmer);
router.delete('/:id', authorize('ADMIN'), deleteFarmer);
router.post('/import', authorize('ADMIN', 'OFFICE'), upload.single('file'), importFarmers);

export default router;

'@

New-File "backend\src\routes\collection.routes.ts" @'
// src/routes/collection.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getCollections, createCollection, batchSync, getDailyRouteTotals } from '../controllers/collection.controller';

const router = Router();
router.use(authenticate);

router.get('/', getCollections);
router.get('/daily-totals', getDailyRouteTotals);
router.post('/', authorize('GRADER', 'ADMIN'), createCollection);
router.post('/batch', authorize('GRADER', 'ADMIN'), batchSync);

export default router;

'@

New-File "backend\src\routes\route.routes.ts" @'
// src/routes/route.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const routes = await prisma.route.findMany({ include: { supervisor: { select: { id: true, name: true } } }, orderBy: { code: 'asc' } });
  res.json(routes);
});

router.post('/', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const route = await prisma.route.create({ data: req.body });
  res.status(201).json(route);
});

router.put('/:id', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const route = await prisma.route.update({ where: { id: Number(req.params.id) }, data: req.body });
  res.json(route);
});

export default router;

'@

New-File "backend\src\routes\employee.routes.ts" @'
// src/routes/employee.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { role } = req.query;
  const where: any = { isActive: true };
  if (role) where.role = role;
  const employees = await prisma.employee.findMany({ where, orderBy: { name: 'asc' } });
  res.json(employees);
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const { password, ...data } = req.body;
  const passwordHash = await bcrypt.hash(password || 'Gutoria@2024', 12);
  const employee = await prisma.employee.create({ data: { ...data, passwordHash } as any });
  res.status(201).json(employee);
});

router.put('/:id', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const employee = await prisma.employee.update({ where: { id: Number(req.params.id) }, data: req.body });
  res.json(employee);
});

export default router;

'@

New-File "backend\src\routes\factory.routes.ts" @'
// src/routes/factory.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// Factory Receipts
router.get('/receipts', async (req, res) => {
  const { date } = req.query;
  const where: any = {};
  if (date) { const d = new Date(String(date)); const n = new Date(d); n.setDate(n.getDate()+1); where.receivedAt = { gte: d, lt: n }; }
  const receipts = await prisma.factoryReceipt.findMany({ where, include: { grader: { select: { id: true, name: true } } }, orderBy: { receivedAt: 'desc' } });
  res.json(receipts);
});
router.post('/receipts', authorize('FACTORY', 'ADMIN'), async (req, res) => {
  const receipt = await prisma.factoryReceipt.create({ data: { ...req.body, receivedAt: new Date(req.body.receivedAt) } });
  res.status(201).json(receipt);
});

// Pasteurization Batches
router.get('/batches', async (_req, res) => {
  const batches = await prisma.pasteurizationBatch.findMany({ include: { deliveries: true }, orderBy: { processedAt: 'desc' } });
  res.json(batches);
});
router.post('/batches', authorize('FACTORY', 'ADMIN'), async (req, res) => {
  const { inputLitres, outputLitres } = req.body;
  const lossLitres = Number(inputLitres) - Number(outputLitres);
  const batch = await prisma.pasteurizationBatch.create({
    data: { ...req.body, lossLitres, processedAt: new Date(req.body.processedAt) },
  });
  res.status(201).json(batch);
});

export default router;

'@

New-File "backend\src\routes\shop.routes.ts" @'
// src/routes/shop.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const shops = await prisma.shop.findMany({ include: { keeper: { select: { id: true, name: true } } } });
  res.json(shops);
});
router.post('/', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const shop = await prisma.shop.create({ data: req.body });
  res.status(201).json(shop);
});
router.put('/:id', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const shop = await prisma.shop.update({ where: { id: Number(req.params.id) }, data: req.body });
  res.json(shop);
});

export default router;

'@

New-File "backend\src\routes\delivery.routes.ts" @'
// src/routes/delivery.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { date } = req.query;
  const where: any = {};
  if (date) { const d = new Date(String(date)); const n = new Date(d); n.setDate(n.getDate()+1); where.deliveredAt = { gte: d, lt: n }; }
  const deliveries = await prisma.deliveryToShop.findMany({
    where,
    include: {
      shop: { select: { id: true, name: true } },
      driver: { select: { id: true, name: true } },
      batch: { select: { id: true, batchNo: true } },
    },
    orderBy: { deliveredAt: 'desc' },
  });
  res.json(deliveries);
});

router.post('/', authorize('DRIVER', 'ADMIN'), async (req, res) => {
  const delivery = await prisma.deliveryToShop.create({
    data: { ...req.body, driverId: req.body.driverId ?? req.user!.sub, deliveredAt: new Date(req.body.deliveredAt) },
  });
  res.status(201).json(delivery);
});

export default router;

'@

New-File "backend\src\routes\shopSale.routes.ts" @'
// src/routes/shopSale.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { shopId, date } = req.query;
  const where: any = {};
  if (shopId) where.shopId = Number(shopId);
  if (date) { const d = new Date(String(date)); const n = new Date(d); n.setDate(n.getDate()+1); where.saleDate = { gte: d, lt: n }; }
  const sales = await prisma.shopSale.findMany({ where, include: { shop: { select: { id: true, name: true } } }, orderBy: { saleDate: 'desc' } });
  res.json(sales);
});

router.post('/', async (req, res) => {
  const { shopId, saleDate, litresSold, cashCollected, sellingPrice } = req.body;
  const expectedRevenue = Number(litresSold) * Number(sellingPrice);
  const sale = await prisma.shopSale.create({
    data: { shopId, saleDate: new Date(saleDate), litresSold, cashCollected, expectedRevenue, variance: expectedRevenue - Number(cashCollected) },
  });
  res.status(201).json(sale);
});

export default router;

'@

New-File "backend\src\routes\payment.routes.ts" @'
// src/routes/payment.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// Record advance
router.post('/advances', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const advance = await prisma.farmerAdvance.create({ data: { ...req.body, advanceDate: new Date(req.body.advanceDate) } });
  res.status(201).json(advance);
});

// Preview month-end payment for a farmer
router.get('/preview/:farmerId', async (req, res) => {
  const { month, year, isMidMonth } = req.query;
  if (!month || !year) throw new AppError(400, 'month and year required');
  const m = Number(month); const y = Number(year);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const farmer = await prisma.farmer.findUnique({ where: { id: Number(req.params.farmerId) } });
  if (!farmer) throw new AppError(404, 'Farmer not found');

  const collections = await prisma.milkCollection.findMany({ where: { farmerId: farmer.id, collectedAt: { gte: start, lt: end } } });
  const advances = await prisma.farmerAdvance.findMany({ where: { farmerId: farmer.id, advanceDate: { gte: start, lt: end } } });
  const deductions = await prisma.farmerDeduction.findMany({ where: { farmerId: farmer.id, periodMonth: m, periodYear: y } });

  const totalLitres = collections.reduce((s, c) => s + Number(c.litres), 0);
  const grossPay = totalLitres * Number(farmer.pricePerLitre);
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
  const netPay = grossPay - totalAdvances - totalDeductions;

  res.json({ farmer, totalLitres, grossPay, totalAdvances, totalDeductions, netPay });
});

// Run payment (creates FarmerPayment record)
router.post('/run', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { farmerIds, month, year, isMidMonth } = req.body;
  const created = [];
  for (const farmerId of farmerIds) {
    const m = Number(month); const y = Number(year);
    const start = new Date(y, m - 1, 1); const end = new Date(y, m, 1);
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer) continue;
    const collections = await prisma.milkCollection.findMany({ where: { farmerId, collectedAt: { gte: start, lt: end } } });
    const advances = await prisma.farmerAdvance.findMany({ where: { farmerId, advanceDate: { gte: start, lt: end } } });
    const deductions = await prisma.farmerDeduction.findMany({ where: { farmerId, periodMonth: m, periodYear: y } });
    const totalLitres = collections.reduce((s, c) => s + Number(c.litres), 0);
    const grossPay = totalLitres * Number(farmer.pricePerLitre);
    const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);
    const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
    const netPay = grossPay - totalAdvances - totalDeductions;
    const payment = await prisma.farmerPayment.upsert({
      where: { farmerId_periodMonth_periodYear_isMidMonth: { farmerId, periodMonth: m, periodYear: y, isMidMonth: !!isMidMonth } },
      create: { farmerId, periodMonth: m, periodYear: y, isMidMonth: !!isMidMonth, grossPay, totalAdvances, totalDeductions, netPay },
      update: { grossPay, totalAdvances, totalDeductions, netPay },
    });
    created.push(payment);
  }
  res.json({ created: created.length, records: created });
});

export default router;

'@

New-File "backend\src\routes\payroll.routes.ts" @'
// src/routes/payroll.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const where: any = {};
  if (month) where.periodMonth = Number(month);
  if (year) where.periodYear = Number(year);
  const payrolls = await prisma.payroll.findMany({
    where,
    include: { employee: { select: { id: true, code: true, name: true, role: true } } },
    orderBy: { employee: { name: 'asc' } },
  });
  res.json(payrolls);
});

router.post('/run', authorize('ADMIN', 'OFFICE'), async (req, res) => {
  const { month, year } = req.body;
  const m = Number(month); const y = Number(year);
  const employees = await prisma.employee.findMany({ where: { isActive: true } });
  const created = [];
  for (const emp of employees) {
    const variances = await prisma.varianceRecord.findMany({ where: { employeeId: emp.id, periodMonth: m, periodYear: y, applied: false } });
    const varianceDeductions = variances.reduce((s, v) => s + Number(v.amount), 0);
    const netPay = Number(emp.salary) - varianceDeductions;
    const payroll = await prisma.payroll.upsert({
      where: { employeeId_periodMonth_periodYear: { employeeId: emp.id, periodMonth: m, periodYear: y } },
      create: { employeeId: emp.id, periodMonth: m, periodYear: y, baseSalary: emp.salary, varianceDeductions, netPay },
      update: { baseSalary: emp.salary, varianceDeductions, netPay },
    });
    await prisma.varianceRecord.updateMany({ where: { employeeId: emp.id, periodMonth: m, periodYear: y }, data: { applied: true } });
    created.push(payroll);
  }
  res.json({ processed: created.length });
});

export default router;

'@

New-File "backend\src\routes\report.routes.ts" @'
// src/routes/report.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { collectionGrid, monthlyFarmerStatement, factoryEfficiency } from '../controllers/report.controller';

const router = Router();
router.use(authenticate);
router.get('/collection-grid', collectionGrid);
router.get('/farmer-statement/:farmerId', monthlyFarmerStatement);
router.get('/factory-efficiency', factoryEfficiency);
export default router;

'@

New-File "backend\src\routes\webhook.routes.ts" @'
// src/routes/webhook.routes.ts
import { Router } from 'express';
import { kopokopoTillWebhook } from '../controllers/webhook.controller';

const router = Router();
router.post('/kopokopo/till', kopokopoTillWebhook);
export default router;

'@

New-File "frontend\.env.example" @'
VITE_API_URL=http://localhost:3001

'@

New-File "frontend\package.json" @'
{
  "name": "gutoria-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.6.0",
    "@radix-ui/react-dialog": "^1.1.1",
    "@radix-ui/react-dropdown-menu": "^2.1.1",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-select": "^2.1.1",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.1",
    "@tanstack/react-query": "^5.49.2",
    "@tanstack/react-table": "^8.19.3",
    "axios": "^1.7.2",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.400.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.52.1",
    "react-router-dom": "^6.24.1",
    "recharts": "^2.12.7",
    "tailwind-merge": "^2.4.0",
    "zod": "^3.23.8",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@types/node": "^20.14.9",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.2",
    "vite": "^5.3.3"
  }
}

'@

New-File "frontend\vite.config.ts" @'
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});

'@

New-File "frontend\src\main.tsx" @'
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

'@

New-File "frontend\src\App.tsx" @'
// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FarmersPage from './pages/FarmersPage';
import RoutesPage from './pages/RoutesPage';
import CollectionsPage from './pages/CollectionsPage';
import FactoryPage from './pages/FactoryPage';
import ShopsPage from './pages/ShopsPage';
import PaymentsPage from './pages/PaymentsPage';
import PayrollPage from './pages/PayrollPage';
import ReportsPage from './pages/ReportsPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="farmers" element={<FarmersPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="factory" element={<FactoryPage />} />
        <Route path="shops" element={<ShopsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
    </Routes>
  );
}

'@

New-File "frontend\src\store\auth.store.ts" @'
// src/store/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { id: number; name: string; role: string } | null;
  setAuth: (token: string, user: AuthState['user']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'gutoria-auth' }
  )
);

'@

New-File "frontend\src\api\client.ts" @'
// src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── API helpers ──────────────────────────────────────────────────────────────

export const authApi = {
  login: (code: string, password: string) => api.post('/api/auth/login', { code, password }),
  me: () => api.get('/api/auth/me'),
};

export const farmersApi = {
  list: (params?: any) => api.get('/api/farmers', { params }),
  get: (id: number) => api.get(`/api/farmers/${id}`),
  create: (data: any) => api.post('/api/farmers', data),
  update: (id: number, data: any) => api.put(`/api/farmers/${id}`, data),
  importExcel: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post('/api/farmers/import', fd); },
  exportExcel: () => api.get('/api/farmers/export', { responseType: 'blob' }),
};

export const routesApi = {
  list: () => api.get('/api/routes'),
  create: (data: any) => api.post('/api/routes', data),
  update: (id: number, data: any) => api.put(`/api/routes/${id}`, data),
};

export const collectionsApi = {
  list: (params?: any) => api.get('/api/collections', { params }),
  dailyTotals: (date?: string) => api.get('/api/collections/daily-totals', { params: { date } }),
  create: (data: any) => api.post('/api/collections', data),
  batchSync: (records: any[]) => api.post('/api/collections/batch', { records }),
};

export const factoryApi = {
  receipts: (params?: any) => api.get('/api/factory/receipts', { params }),
  createReceipt: (data: any) => api.post('/api/factory/receipts', data),
  batches: () => api.get('/api/factory/batches'),
  createBatch: (data: any) => api.post('/api/factory/batches', data),
};

export const shopsApi = {
  list: () => api.get('/api/shops'),
  sales: (params?: any) => api.get('/api/shop-sales', { params }),
  createSale: (data: any) => api.post('/api/shop-sales', data),
};

export const paymentsApi = {
  preview: (farmerId: number, params: any) => api.get(`/api/payments/preview/${farmerId}`, { params }),
  runPayments: (data: any) => api.post('/api/payments/run', data),
  addAdvance: (data: any) => api.post('/api/payments/advances', data),
};

export const payrollApi = {
  list: (params?: any) => api.get('/api/payroll', { params }),
  run: (month: number, year: number) => api.post('/api/payroll/run', { month, year }),
};

export const reportsApi = {
  collectionGrid: (params: any) => api.get('/api/reports/collection-grid', { params }),
  farmerStatement: (farmerId: number, params: any) => api.get(`/api/reports/farmer-statement/${farmerId}`, { params }),
  factoryEfficiency: (params: any) => api.get('/api/reports/factory-efficiency', { params }),
};

'@

New-File "frontend\src\components\layout\Layout.tsx" @'
// src/components/layout/Layout.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  LayoutDashboard, Users, Route, Milk, Factory, Store,
  CreditCard, Briefcase, BarChart2, LogOut
} from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/farmers', icon: Users, label: 'Farmers' },
  { to: '/routes', icon: Route, label: 'Routes' },
  { to: '/collections', icon: Milk, label: 'Collections' },
  { to: '/factory', icon: Factory, label: 'Factory' },
  { to: '/shops', icon: Store, label: 'Shops' },
  { to: '/payments', icon: CreditCard, label: 'Farmer Payments' },
  { to: '/payroll', icon: Briefcase, label: 'Staff Payroll' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r flex flex-col">
        <div className="p-5 border-b">
          <div className="text-lg font-bold text-green-700">🐄 Gutoria Dairies</div>
          <div className="text-xs text-gray-500 mt-0.5">{user?.name} · {user?.role}</div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

'@

New-File "frontend\src\pages\LoginPage.tsx" @'
// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuthStore } from '../store/auth.store';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.login(code, password);
      setAuth(data.token, data.employee);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🐄</div>
          <h1 className="text-2xl font-bold text-gray-800">Gutoria Dairies</h1>
          <p className="text-sm text-gray-500 mt-1">Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. EMP001"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

'@

New-File "frontend\src\pages\DashboardPage.tsx" @'
// src/pages/DashboardPage.tsx
import { useQuery } from '@tanstack/react-query';
import { collectionsApi, farmersApi, routesApi } from '../api/client';
import { format } from 'date-fns';

export default function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: totals } = useQuery({ queryKey: ['daily-totals', today], queryFn: () => collectionsApi.dailyTotals(today) });
  const { data: farmers } = useQuery({ queryKey: ['farmers-count'], queryFn: () => farmersApi.list({ limit: 1 }) });
  const { data: routes } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });

  const routeData: any[] = totals?.data ?? [];
  const totalLitres = routeData.reduce((s: number, r: any) => s + Number(r.totalLitres), 0);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Today's Milk" value={`${totalLitres.toFixed(0)}L`} color="green" />
        <StatCard label="Active Farmers" value={farmers?.data?.total ?? '–'} color="blue" />
        <StatCard label="Active Routes" value={routes?.data?.length ?? '–'} color="purple" />
        <StatCard label="Routes Reporting" value={routeData.length} color="orange" />
      </div>

      {/* Route totals table */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Today's Route Totals</h2>
        {routeData.length === 0 ? (
          <p className="text-sm text-gray-400">No collections recorded yet today.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Route</th><th className="pb-2">Farmers</th><th className="pb-2 text-right">Litres</th>
            </tr></thead>
            <tbody>
              {routeData.map((r: any) => (
                <tr key={r.route?.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.route?.name}</td>
                  <td className="py-2 text-gray-500">{r.farmerCount}</td>
                  <td className="py-2 text-right font-mono font-semibold text-green-700">{Number(r.totalLitres).toFixed(1)}L</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700', orange: 'bg-orange-50 text-orange-700',
  };
  return (
    <div className={`rounded-xl p-5 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-75">{label}</div>
    </div>
  );
}

'@

New-File "frontend\src\pages\FarmersPage.tsx" @'
// src/pages/FarmersPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmersApi } from '../api/client';
import { Search, Upload, Download, Plus } from 'lucide-react';

export default function FarmersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['farmers', search, page],
    queryFn: () => farmersApi.list({ search, page, limit: 50 }),
  });

  const farmers: any[] = data?.data?.data ?? [];
  const total: number = data?.data?.total ?? 0;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { await farmersApi.importExcel(file); alert('Import successful!'); }
    catch { alert('Import failed. Check the file format.'); }
  };

  const handleExport = async () => {
    const res = await farmersApi.exportExcel();
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a'); a.href = url; a.download = 'farmers.xlsx'; a.click();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Farmers</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} farmers registered</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <Upload size={14} /> Import Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download size={14} /> Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Plus size={14} /> Add Farmer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search farmers…"
          className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Code', 'Name', 'Phone', 'Route', 'Price/L', 'Payment', 'Status'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : farmers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No farmers found.</td></tr>
            ) : farmers.map((f) => (
              <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.code}</td>
                <td className="px-4 py-3 font-medium">{f.name}</td>
                <td className="px-4 py-3 text-gray-500">{f.phone}</td>
                <td className="px-4 py-3">{f.route?.name ?? '–'}</td>
                <td className="px-4 py-3 font-mono">KES {Number(f.pricePerLitre).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.paymentMethod === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {f.paymentMethod}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${f.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {f.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {total > 50 && (
          <div className="flex justify-between items-center px-4 py-3 border-t text-sm text-gray-500">
            <span>Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= total} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'@

New-File "frontend\src\pages\RoutesPage.tsx" @'
// src/pages/RoutesPage.tsx
import { useQuery } from '@tanstack/react-query';
import { routesApi } from '../api/client';

export default function RoutesPage() {
  const { data } = useQuery({ queryKey: ['routes'], queryFn: () => routesApi.list() });
  const routes: any[] = data?.data ?? [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Routes</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {routes.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border p-5">
            <div className="font-mono text-xs text-gray-400 mb-1">{r.code}</div>
            <div className="font-semibold text-gray-800">{r.name}</div>
            {r.supervisor && <div className="text-sm text-gray-500 mt-1">Supervisor: {r.supervisor.name}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

'@

New-File "frontend\src\pages\CollectionsPage.tsx" @'
// src/pages/CollectionsPage.tsx
export default function CollectionsPage() {
  return <PageShell title="Milk Collections" desc="View and record daily milk collections from farmers." />;
}

// src/pages/FactoryPage.tsx - separate file
// src/pages/ShopsPage.tsx - separate file
// etc.

// Shared shell for pages under construction
function PageShell({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{title}</h1>
      <p className="text-sm text-gray-500 mb-8">{desc}</p>
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
        <div className="text-4xl mb-3">🚧</div>
        <p className="font-medium">This page is ready for implementation.</p>
        <p className="text-sm mt-1">All API endpoints and data models are wired up.</p>
      </div>
    </div>
  );
}

'@

New-File "frontend\src\pages\FactoryPage.tsx" @'
// src/pages/FactoryPage.tsx
export default function FactoryPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Factory</h1>
      <p className="text-sm text-gray-500 mb-8">Factory receipts, pasteurization batches, and quality control.</p>
      <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
        <div className="text-4xl mb-3">🏭</div>
        <p className="font-medium">Factory module — ready for implementation.</p>
      </div>
    </div>
  );
}

'@

New-File "frontend\src\pages\ShopsPage.tsx" @'

'@

New-File "frontend\src\pages\PaymentsPage.tsx" @'
export default function PaymentsPage(){return <div className="p-8"><h1 className="text-2xl font-bold">Farmer Payments</h1><p className="text-gray-500 mt-2">Advance recording and month-end payment runs via Kopokopo.</p></div>}

'@

New-File "frontend\src\pages\PayrollPage.tsx" @'
export default function PayrollPage(){return <div className="p-8"><h1 className="text-2xl font-bold">Staff Payroll</h1><p className="text-gray-500 mt-2">Monthly payroll with variance deductions.</p></div>}

'@

New-File "frontend\src\pages\ReportsPage.tsx" @'
export default function ReportsPage(){return <div className="p-8"><h1 className="text-2xl font-bold">Reports</h1><p className="text-gray-500 mt-2">Monthly collection grid, farmer statements, factory efficiency.</p></div>}

'@

New-File "mobile\.env.example" @'
EXPO_PUBLIC_API_URL=http://192.168.1.x:3001

'@

New-File "mobile\package.json" @'
{
  "name": "gutoria-mobile",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "1.23.1",
    "@react-navigation/bottom-tabs": "^6.5.20",
    "@react-navigation/native": "^6.1.17",
    "@react-navigation/stack": "^6.3.29",
    "@tanstack/react-query": "^5.49.2",
    "axios": "^1.7.2",
    "expo": "~51.0.14",
    "expo-bluetooth": "~0.1.0",
    "expo-print": "~13.0.1",
    "expo-sqlite": "~14.0.3",
    "expo-status-bar": "~1.12.1",
    "react": "18.2.0",
    "react-native": "0.74.3",
    "react-native-safe-area-context": "4.10.5",
    "react-native-screens": "3.31.1",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@types/react": "~18.2.79",
    "@types/react-native": "~0.73.0",
    "typescript": "^5.3.3"
  }
}

'@

New-File "mobile\src\api\client.ts" @'
// src/api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('gutoria_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (code: string, password: string) => api.post('/api/auth/login', { code, password }),
};

export const farmersApi = {
  list: (params?: any) => api.get('/api/farmers', { params }),
};

export const collectionsApi = {
  batchSync: (records: any[]) => api.post('/api/collections/batch', { records }),
};

'@

New-File "mobile\src\utils\offlineStore.ts" @'
// src/utils/offlineStore.ts
// SQLite-backed offline queue for milk collections

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export async function initDB() {
  db = await SQLite.openDatabaseAsync('gutoria.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_id INTEGER NOT NULL,
      litres REAL NOT NULL,
      collected_at TEXT NOT NULL,
      receipt_no TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export async function savePendingCollection(data: {
  farmerId: number;
  litres: number;
  collectedAt: string;
  receiptNo?: string;
}) {
  if (!db) await initDB();
  await db.runAsync(
    'INSERT INTO pending_collections (farmer_id, litres, collected_at, receipt_no) VALUES (?, ?, ?, ?)',
    [data.farmerId, data.litres, data.collectedAt, data.receiptNo ?? null]
  );
}

export async function getPendingCollections() {
  if (!db) await initDB();
  return db.getAllAsync<any>('SELECT * FROM pending_collections WHERE synced = 0');
}

export async function markSynced(ids: number[]) {
  if (!db) await initDB();
  await db.runAsync(
    `UPDATE pending_collections SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function clearSynced() {
  if (!db) await initDB();
  await db.runAsync('DELETE FROM pending_collections WHERE synced = 1');
}

'@

New-File "mobile\src\utils\syncService.ts" @'
// src/utils/syncService.ts
import NetInfo from '@react-native-community/netinfo';
import { getPendingCollections, markSynced } from './offlineStore';
import { collectionsApi } from '../api/client';

export async function syncPendingCollections(): Promise<{ synced: number; failed: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return { synced: 0, failed: 0 };

  const pending = await getPendingCollections();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  const records = pending.map((p: any) => ({
    farmerId: p.farmer_id,
    litres: p.litres,
    collectedAt: p.collected_at,
    receiptNo: p.receipt_no,
  }));

  try {
    const result = await collectionsApi.batchSync(records);
    await markSynced(pending.map((p: any) => p.id));
    return { synced: result.data.created, failed: result.data.failed };
  } catch {
    return { synced: 0, failed: pending.length };
  }
}

'@

New-File "mobile\src\screens\CollectionScreen.tsx" @'
// src/screens/CollectionScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { savePendingCollection } from '../utils/offlineStore';
import { syncPendingCollections } from '../utils/syncService';
import { farmersApi } from '../api/client';

export default function CollectionScreen() {
  const [farmers, setFarmers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [litres, setLitres] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (search.length >= 2) {
      farmersApi.list({ search, limit: 20 })
        .then((r) => setFarmers(r.data.data))
        .catch(() => {});
    } else {
      setFarmers([]);
    }
  }, [search]);

  const handleSave = async () => {
    if (!selectedFarmer || !litres) {
      Alert.alert('Validation', 'Please select a farmer and enter litres.');
      return;
    }
    setSaving(true);
    try {
      await savePendingCollection({
        farmerId: selectedFarmer.id,
        litres: parseFloat(litres),
        collectedAt: new Date().toISOString(),
      });
      Alert.alert('Saved', `${litres}L recorded for ${selectedFarmer.name}. Will sync when online.`);
      setSelectedFarmer(null);
      setLitres('');
      setSearch('');
    } catch {
      Alert.alert('Error', 'Failed to save collection.');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncPendingCollections();
    setSyncing(false);
    Alert.alert('Sync Complete', `Synced: ${result.synced}, Failed: ${result.failed}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Collection</Text>

      {/* Farmer search */}
      {!selectedFarmer ? (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Search farmer name or code…"
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={farmers}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.farmerRow} onPress={() => setSelectedFarmer(item)}>
                <Text style={styles.farmerName}>{item.name}</Text>
                <Text style={styles.farmerCode}>{item.code} · {item.route?.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        <View>
          <View style={styles.selectedFarmer}>
            <Text style={styles.farmerName}>{selectedFarmer.name}</Text>
            <Text style={styles.farmerCode}>{selectedFarmer.code}</Text>
            <TouchableOpacity onPress={() => setSelectedFarmer(null)}>
              <Text style={styles.changeBtn}>Change</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Litres collected"
            value={litres}
            onChangeText={setLitres}
            keyboardType="decimal-pad"
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Collection</Text>}
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
        {syncing ? <ActivityIndicator color="#16a34a" /> : <Text style={styles.syncBtnText}>⟳  Sync Pending Records</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 20 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10 },
  farmerRow: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  farmerName: { fontSize: 15, fontWeight: '600', color: '#111' },
  farmerCode: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  selectedFarmer: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 10, padding: 14, marginBottom: 14 },
  changeBtn: { color: '#16a34a', fontWeight: '600', marginTop: 6, fontSize: 13 },
  saveBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  syncBtn: { marginTop: 24, borderWidth: 1, borderColor: '#16a34a', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  syncBtnText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },
});

'@

New-File "frontend\index.html" @'
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Gutoria Dairies</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
'@

New-File "frontend\src\index.css" @'
@tailwind base;
@tailwind components;
@tailwind utilities;
'@

New-File "frontend\tailwind.config.js" @'
export default { content: ["./index.html","./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] }
'@

New-File "frontend\postcss.config.js" @'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
'@

New-File "frontend\tsconfig.json" @'
{
  "compilerOptions": {
    "target": "ES2020","module": "ESNext","moduleResolution": "bundler",
    "jsx": "react-jsx","strict": true,"skipLibCheck": true,
    "baseUrl": ".","paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
'@

New-File ".gitignore" @'
node_modules/
dist/
.env
*.log
'@

Write-Host "`n All files created!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. cd gutoria-dairies\backend  && npm install" -ForegroundColor White
Write-Host "  2. cd ..\frontend && npm install" -ForegroundColor White
Write-Host "  3. cd ..\mobile   && npm install" -ForegroundColor White
Write-Host "  4. Copy each .env.example to .env and fill in your values" -ForegroundColor White
Write-Host "  5. cd backend && npx prisma migrate dev" -ForegroundColor White
Write-Host "  6. npm run dev  (backend + frontend in separate terminals)" -ForegroundColor White
