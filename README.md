# 🥛 Gutoria Dairies Management System

A full-stack dairy farm management platform built for **Gutoria Dairies**, handling 1,698+ farmers across 28 milk collection routes. The system digitizes the entire dairy operation — from daily milk collection at the farm gate, through factory processing, to farmer payment disbursement via M-Pesa and bank remittance.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Modules](#modules)
- [Payment Flow](#payment-flow)
- [KopoKopo Integration](#kopokopo-integration)

---

## Overview

Gutoria Dairies operates across multiple milk collection routes in Kenya. Before this system, operations were managed entirely on Excel spreadsheets — 28 separate route journals, manual advance tracking, and manual payment calculations every month.

This platform replaces that workflow with a real-time web application that:

- Records daily milk collections per farmer per route
- Tracks farmer advances by payment slot (5th, 10th, 15th, 20th, 25th, Emergency/AI)
- Computes mid-month and end-month net pay automatically
- Disburses M-Pesa payments via KopoKopo API
- Exports bank remittance schedules (Equity, KCB, Co-op, Family, Fariji SACCO, K-Unity SACCO, TAI SACCO)
- Manages 64 distribution shops across 6 units (KCU, KCQ, KDE, KCN, KBP, OTHERS)
- Tracks factory pasteurization batches and deliveries

---

## Features

### 🌾 Farmers
- 1,698 active farmers with full profiles (name, code, route, bank/M-Pesa details)
- Per-farmer pricing (price per litre)
- Bank and M-Pesa payment methods
- Searchable, paginated farmer list with route drill-down

### 🚛 Routes
- 28 milk collection routes
- Route summary cards with farmer counts and total litres
- Per-route farmer list with collection history

### 🥛 Collections
- Daily milk recording by grader
- Farmer search with autocomplete
- Route/date filter with running totals
- Estimated value preview before saving

### 💰 Farmer Payments
- Excel-style journal grid: farmers as rows, days 1–31 as columns
- Daily litres, total litres, gross pay
- Advance slots: 5th / 10th / 15th / 20th / 25th / Emergency AI
- Mid-month reconciliation (days 1–15)
- End-month net pay calculation
- Negative balances highlighted in red
- Bulk approve for mid-month or end-month

### 💸 Disbursements
- **M-Pesa**: KopoKopo API integration — one-click bulk disburse to all M-Pesa farmers
- **Bank**: Automated Excel remittance export per bank/SACCO (formatted for bulk upload)
- Phone number validation before sending
- Real-time disbursement status tracking via KopoKopo webhooks
- Preview before confirming (shows exactly who gets paid and how much)

### 🏪 Shops
- 64 distribution shops across 6 units
- Excel-style monthly sales grid (days 1–31 per shop)
- Per-unit colour-coded sections matching the operations journal
- Daily sale recording with cash vs expected comparison
- KopoKopo till reconciliation

### 🏭 Factory
- Pasteurization batch tracking
- Deliveries to shops
- Variance records

### 👥 Staff Payroll
- Employee profiles
- Monthly payroll runs

---

## Tech Stack

### Backend
| Package | Purpose |
|---|---|
| Node.js + Express | REST API server |
| TypeScript | Type safety |
| Prisma ORM | Database access |
| SQL Server (MSSQL) | Primary database |
| ExcelJS | Excel report generation |
| jsonwebtoken + bcryptjs | Authentication |
| Winston | Logging |
| Zod | Request validation |
| Helmet + Rate Limiting | Security |
| Africa's Talking | SMS notifications |
| Bull + Redis | Background job queues |

### Frontend
| Package | Purpose |
|---|---|
| React 18 + Vite | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| React Router | Navigation |
| Axios | API calls |
| TanStack Query | Server state |
| Recharts | Charts |
| Radix UI | Accessible components |
| React Hook Form + Zod | Form validation |
| Zustand | Client state |

---

## Project Structure

```
gutoria-dairies/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database models
│   ├── src/
│   │   ├── controllers/           # Route handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── collection.controller.ts
│   │   │   ├── disbursement.controller.ts
│   │   │   ├── farmer.controller.ts
│   │   │   ├── payment.controller.ts
│   │   │   ├── report.controller.ts
│   │   │   └── webhook.controller.ts
│   │   ├── routes/                # Express routers
│   │   ├── services/
│   │   │   └── kopokopo.service.ts  # KopoKopo API client
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT middleware
│   │   │   └── errorHandler.ts
│   │   ├── config/
│   │   │   ├── prisma.ts
│   │   │   └── logger.ts
│   │   └── index.ts               # App entry point
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── DashboardPage.tsx
    │   │   ├── FarmersPage.tsx
    │   │   ├── RoutesPage.tsx
    │   │   ├── CollectionsPage.tsx
    │   │   ├── PaymentsPage.tsx   # Excel-style journal grid
    │   │   ├── ShopsPage.tsx      # Monthly sales grid
    │   │   ├── FactoryPage.tsx
    │   │   └── ReportsPage.tsx
    │   ├── components/
    │   │   └── DisbursementPanel.tsx  # M-Pesa + bank remittance
    │   ├── api/
    │   │   └── client.ts          # Axios API client
    │   └── main.tsx
    └── package.json
```

---

## Database Schema

15 models in the `GTD` SQL Server database:

| Model | Description |
|---|---|
| `Farmer` | 1,698 farmers with bank/M-Pesa details and pricing |
| `Route` | 28 milk collection routes |
| `MilkCollection` | Daily collection records per farmer |
| `FarmerAdvance` | Advances by date (bucketed into payment slots) |
| `FarmerPayment` | Monthly payment records with KopoKopo reference |
| `FarmerDeduction` | Deductions applied to payments |
| `Shop` | 64 distribution shops across 6 units |
| `ShopSale` | Daily shop sales (upsert by shop + date) |
| `KopokopoTransaction` | Till payments received via KopoKopo webhook |
| `Employee` | Staff profiles |
| `Payroll` | Monthly payroll records |
| `FactoryReceipt` | Factory milk intake records |
| `PasteurizationBatch` | Processing batches |
| `DeliveryToShop` | Factory → shop delivery records |
| `VarianceRecord` | Milk variance tracking |

---

## Getting Started

### Prerequisites
- Node.js 18+
- SQL Server (local or remote)
- Redis (for background jobs)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/gutoria-dairies.git
cd gutoria-dairies

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Database Setup

```bash
cd backend

# Push schema to SQL Server
npx prisma db push

# Seed farmers (1,698 from Excel journal)
npx ts-node --transpile-only src/seedFarmers.ts

# Seed shops (64 distribution shops)
npx ts-node --transpile-only src/seedShops.ts
```

### Running

```bash
# Backend (runs on port 3001)
cd backend
npm run dev

# Frontend (runs on port 5173)
cd frontend
npm run dev
```

---

## Environment Variables

Create `backend/.env`:

```env
# Server
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL="sqlserver://localhost:1433;database=GTD;user=YOUR_USER;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=true;"

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://localhost:6379

# Africa's Talking SMS
AT_API_KEY=your_at_api_key
AT_USERNAME=sandbox
AT_SENDER_ID=GUTORIA

# KopoKopo (M-Pesa disbursements)
KOPOKOPO_CLIENT_ID=your_kopokopo_client_id
KOPOKOPO_CLIENT_SECRET=your_kopokopo_client_secret
KOPOKOPO_API_URL=https://sandbox.kopokopo.com
KOPOKOPO_WEBHOOK_SECRET=your_webhook_secret
BACKEND_URL=https://your-public-domain.com

# Frontend
FRONTEND_URL=http://localhost:5173
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register new user |

### Farmers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/farmers` | List farmers (paginated, searchable) |
| GET | `/api/farmers/:id` | Farmer detail |
| POST | `/api/farmers` | Create farmer |
| PUT | `/api/farmers/:id` | Update farmer |

### Collections
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/collections` | List collections (filter by route/date) |
| POST | `/api/collections` | Record collection |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/payments` | Journal grid (daily litres + pay calc) |
| GET | `/api/payments/routes` | Route list for filter |
| POST | `/api/payments/advance` | Record advance |
| DELETE | `/api/payments/advance/:id` | Delete advance |
| POST | `/api/payments/approve` | Bulk approve payments |

### Disbursements
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/disbursements/preview` | Preview who gets paid |
| POST | `/api/disbursements/mpesa` | Trigger KopoKopo M-Pesa bulk disburse |
| GET | `/api/disbursements/remittance` | Download bank remittance Excel |
| GET | `/api/disbursements/status` | Sync payment status from KopoKopo |
| POST | `/api/disbursements/webhook` | KopoKopo callback (auto-update status) |

### Shops
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/shops` | List shops (filter by unit) |
| GET | `/api/shops/monthly-grid` | Monthly sales grid |
| GET | `/api/shops/daily-summary` | Daily totals |
| POST | `/api/shop-sales` | Record sale (upsert) |
| POST | `/api/shop-sales/bulk` | Bulk entry |

---

## Payment Flow

```
Daily milk recorded by grader
        ↓
Collections stored per farmer per day
        ↓
Payments page shows journal grid (mirrors Excel)
  → Days 1–15  = Mid Month
  → Days 1–31  = End Month
        ↓
Advances deducted by slot (5th/10th/15th/20th/25th/EmerAI)
        ↓
Net Pay = Gross Pay − Total Advances
        ↓
Admin clicks "Approve" → status: PENDING → APPROVED
        ↓
Admin clicks "Disburse Payments"
  → M-Pesa farmers  → KopoKopo API → money sent to phone
  → Bank farmers    → Remittance Excel exported per bank
                      → Upload to Equity/KCB/Co-op/SACCO portal
        ↓
KopoKopo webhook confirms → status: APPROVED → PAID
```

---

## KopoKopo Integration

The system uses KopoKopo's Merchant Transfer API to disburse M-Pesa payments directly to farmer phones.

**Setup:**
1. Log in at [app.kopokopo.com](https://app.kopokopo.com)
2. Go to **Settings → Apps** → get your Client ID and Client Secret
3. Go to **Settings → Webhooks** → set callback URL to `https://yourdomain.com/api/disbursements/webhook`
4. Paste credentials into `.env`
5. Switch `KOPOKOPO_API_URL` from sandbox to `https://api.kopokopo.com` for production

**Supported banks for remittance export:**
- Equity Bank
- KCB Bank
- Co-operative Bank
- Family Bank
- Fariji SACCO
- K-Unity SACCO
- TAI SACCO

---

## License

Private — Gutoria Dairies. All rights reserved.
