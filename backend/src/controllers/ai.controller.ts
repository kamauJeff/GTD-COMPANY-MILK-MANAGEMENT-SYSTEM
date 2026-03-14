import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Schema context for the AI ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Gutoria AI, the intelligent assistant for Gutoria Dairies Management System in Kenya.
You have full access to the dairy's database and can answer questions, pull reports, and perform actions.

COMPANY CONTEXT:
- 1,693 farmers across 29 collection routes
- 35 graders, 38 shopkeepers, 1 driver, admin
- Price per litre: KES 46 (default)
- Payment cycles: Mid-month (1st–15th) and End-month (16th–last day)
- TL = Total Litres, TM = Total Milk Value (TL × price), AD = Advances, NetPay = TM - AD - Deductions
- Bank: K-Unity Sacco
- Payment via KopoKopo M-Pesa

THE 29 ROUTES:
RT001 KARIAINI, RT002 KAMAE, RT003 SULMAC, RT004 KAGERAINI, RT005 GATHWARIGA,
RT006 ITOMBOYA, RT007 RURII, RT008 KADAI, RT009 BENKA, RT010 MAGANA MERI,
RT011 THIRIRIKA, RT012 AMIGO, RT013 HEROES, RT014 NGUMO, RT015 GATAMAIYU,
RT016 MUIRI, RT017 GITHOITO, RT018 BURUGU, RT019 KARIKO, RT020 KIANDUTU,
RT021 KAGUONGO, RT022 HATO, RT023 CIRINGI IKUMI, RT024 MUSEVENI,
RT025 KING'ARATUA, RT026 BATHI, RT027 NDURIRI, RT028 KANGUCHU, RT029 EVENING SHIFT

DATABASE SCHEMA (Prisma models):
- Farmer: id, code(FM####), name, phone, routeId, pricePerLitre, paymentMethod(MPESA/BANK), mpesaPhone, bankName, bankAccount, isActive
- Route: id, code(RT###), name, supervisorId
- Employee: id, code, name, phone, role(GRADER/DRIVER/SHOPKEEPER/ADMIN), salary, paymentMethod, bankAccount, isActive
- MilkCollection: id, farmerId, routeId, graderId, litres, collectedAt(DateTime)
- FarmerPayment: id, farmerId, periodMonth, periodYear, isMidMonth(bool), grossPay, totalAdvances, totalDeductions, netPay, status(PENDING/APPROVED/PAID), paidAt
- FarmerAdvance: id, farmerId, amount, advanceDate, notes
- FarmerDeduction: id, farmerId, amount, reason, deductionDate, periodMonth, periodYear
- Payroll: id, employeeId, periodMonth, periodYear, baseSalary, varianceDeductions, otherDeductions, netPay, status(PENDING/APPROVED/PAID), paidAt
- Shop: id, code, name, keeperId, tillNumber
- ShopSale: id, shopId, saleDate, litresSold, expectedRevenue, cashCollected, variance, reconciled
- DeliveryToShop: id, batchId, shopId, driverId, litres, sellingPrice, deliveredAt
- PasteurizationBatch: id, batchNo, inputLitres, outputLitres, lossLitres, processedAt
- FactoryReceipt: id, graderId, litres, receivedAt
- VarianceRecord: id, employeeId, type, amount, recordDate, periodMonth, periodYear, applied
- KopokopoTransaction: id, shopId, amount, transactionRef, transactionDate, matched

You have access to tools to query the database. ALWAYS use tools to get real data — never guess or fabricate numbers.
When the user asks about "this month", "today", "last month" — use the current date context provided.
Respond in a friendly, professional tone. Format results as clear tables when returning lists.
After returning data, suggest relevant follow-up actions when appropriate.`;

// ─── Tool definitions ────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'query_farmers',
    description: 'Query farmers with filters. Use for: listing farmers, finding by route, checking payment method, searching by name/code.',
    input_schema: {
      type: 'object' as const,
      properties: {
        routeCode: { type: 'string', description: 'Filter by route code e.g. RT001' },
        routeName: { type: 'string', description: 'Filter by route name e.g. KARIAINI' },
        paymentMethod: { type: 'string', enum: ['MPESA', 'BANK'] },
        isActive: { type: 'boolean' },
        search: { type: 'string', description: 'Search by name or code' },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'query_farmer_payments',
    description: 'Query farmer payment records. Use for: paid/unpaid farmers, negative balances, mid/end month payments, payment status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        periodMonth: { type: 'number', description: '1-12' },
        periodYear: { type: 'number' },
        isMidMonth: { type: 'boolean', description: 'true=mid-month, false=end-month' },
        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'PAID'] },
        routeCode: { type: 'string' },
        negativeOnly: { type: 'boolean', description: 'Only return farmers with netPay < 0' },
        limit: { type: 'number', default: 100 },
      },
      required: ['periodMonth', 'periodYear'],
    },
  },
  {
    name: 'query_collections',
    description: 'Query milk collections. Use for: daily totals, route totals, farmer totals, zero-litre farmers, collection summaries.',
    input_schema: {
      type: 'object' as const,
      properties: {
        farmerId: { type: 'number' },
        routeCode: { type: 'string' },
        dateFrom: { type: 'string', description: 'ISO date string YYYY-MM-DD' },
        dateTo: { type: 'string', description: 'ISO date string YYYY-MM-DD' },
        groupBy: { type: 'string', enum: ['farmer', 'route', 'day', 'grader'], description: 'Aggregate results by this dimension' },
        zeroLitresOnly: { type: 'boolean', description: 'Find farmers who delivered 0 litres in period' },
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'query_payroll',
    description: 'Query staff payroll (graders, shopkeepers, driver). Use for: payroll status, who is paid, salary totals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        periodMonth: { type: 'number' },
        periodYear: { type: 'number' },
        role: { type: 'string', enum: ['GRADER', 'SHOPKEEPER', 'DRIVER', 'ADMIN'] },
        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'PAID'] },
      },
    },
  },
  {
    name: 'query_advances',
    description: 'Query farmer advances/deductions. Use for: who took advances, advance totals, deduction records.',
    input_schema: {
      type: 'object' as const,
      properties: {
        farmerId: { type: 'number' },
        routeCode: { type: 'string' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
        type: { type: 'string', enum: ['advance', 'deduction', 'both'], default: 'both' },
      },
    },
  },
  {
    name: 'query_factory',
    description: 'Query factory data: batches, receipts, deliveries, liquid ledger stats.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
        type: { type: 'string', enum: ['batches', 'receipts', 'deliveries', 'summary'] },
      },
    },
  },
  {
    name: 'query_shops',
    description: 'Query shop sales, variances, deliveries. Use for: shop performance, variance analysis, unsettled amounts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shopCode: { type: 'string' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
        unreconciledOnly: { type: 'boolean' },
      },
    },
  },
  {
    name: 'get_summary_stats',
    description: 'Get high-level summary statistics for dashboard overview questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        month: { type: 'number' },
        year: { type: 'number' },
        metric: { type: 'string', enum: ['farmers', 'collections', 'payments', 'payroll', 'factory', 'all'] },
      },
    },
  },
  {
    name: 'approve_farmer_payments',
    description: 'Approve farmer payments for a period. Changes status from PENDING to APPROVED.',
    input_schema: {
      type: 'object' as const,
      properties: {
        periodMonth: { type: 'number', description: '1-12' },
        periodYear: { type: 'number' },
        isMidMonth: { type: 'boolean' },
        routeCode: { type: 'string', description: 'Approve only for this route, or omit for all routes' },
      },
      required: ['periodMonth', 'periodYear', 'isMidMonth'],
    },
  },
  {
    name: 'record_advance',
    description: 'Record a farmer advance/loan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        farmerCode: { type: 'string', description: 'e.g. FM0668' },
        amount: { type: 'number' },
        notes: { type: 'string' },
        date: { type: 'string', description: 'ISO date, defaults to today' },
      },
      required: ['farmerCode', 'amount'],
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────
async function executeTool(name: string, input: any): Promise<any> {
  switch (name) {

    case 'query_farmers': {
      const where: any = {};
      if (input.isActive !== undefined) where.isActive = input.isActive;
      if (input.paymentMethod) where.paymentMethod = input.paymentMethod;
      if (input.search) where.OR = [
        { name: { contains: input.search, mode: 'insensitive' } },
        { code: { contains: input.search, mode: 'insensitive' } },
      ];
      if (input.routeCode || input.routeName) {
        where.route = {};
        if (input.routeCode) where.route.code = input.routeCode.toUpperCase();
        if (input.routeName) where.route.name = { contains: input.routeName, mode: 'insensitive' };
      }
      const farmers = await prisma.farmer.findMany({
        where,
        include: { route: { select: { code: true, name: true } } },
        take: input.limit || 50,
        orderBy: { name: 'asc' },
      });
      return { count: farmers.length, farmers: farmers.map(f => ({
        code: f.code, name: f.name, phone: f.phone,
        route: f.route.name, paymentMethod: f.paymentMethod,
        pricePerLitre: Number(f.pricePerLitre), isActive: f.isActive,
      }))};
    }

    case 'query_farmer_payments': {
      const where: any = {
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
      };
      if (input.isMidMonth !== undefined) where.isMidMonth = input.isMidMonth;
      if (input.status) where.status = input.status;
      if (input.negativeOnly) where.netPay = { lt: 0 };
      if (input.routeCode) where.farmer = { route: { code: input.routeCode.toUpperCase() } };

      const payments = await prisma.farmerPayment.findMany({
        where,
        include: {
          farmer: {
            include: { route: { select: { code: true, name: true } } },
          },
        },
        take: input.limit || 100,
        orderBy: { netPay: 'asc' },
      });

      const totalNetPay = payments.reduce((s, p) => s + Number(p.netPay), 0);
      const totalGross = payments.reduce((s, p) => s + Number(p.grossPay), 0);
      const totalAdvances = payments.reduce((s, p) => s + Number(p.totalAdvances), 0);

      return {
        count: payments.length,
        summary: {
          totalGrossPay: totalGross.toFixed(2),
          totalAdvances: totalAdvances.toFixed(2),
          totalNetPay: totalNetPay.toFixed(2),
          negative: payments.filter(p => Number(p.netPay) < 0).length,
        },
        payments: payments.map(p => ({
          farmerCode: p.farmer.code,
          farmerName: p.farmer.name,
          route: p.farmer.route.name,
          period: p.isMidMonth ? 'Mid-Month' : 'End-Month',
          grossPay: Number(p.grossPay),
          advances: Number(p.totalAdvances),
          deductions: Number(p.totalDeductions),
          netPay: Number(p.netPay),
          status: p.status,
          paidAt: p.paidAt,
        })),
      };
    }

    case 'query_collections': {
      const where: any = {};
      if (input.farmerId) where.farmerId = input.farmerId;
      if (input.routeCode) where.route = { code: input.routeCode.toUpperCase() };
      if (input.dateFrom || input.dateTo) {
        where.collectedAt = {};
        if (input.dateFrom) where.collectedAt.gte = new Date(input.dateFrom);
        if (input.dateTo) where.collectedAt.lte = new Date(input.dateTo + 'T23:59:59');
      }

      if (input.groupBy === 'route') {
        const result = await prisma.milkCollection.groupBy({
          by: ['routeId'],
          where,
          _sum: { litres: true },
          _count: { id: true },
        });
        const routes = await prisma.route.findMany({ select: { id: true, code: true, name: true } });
        const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));
        return {
          groupBy: 'route',
          data: result.map(r => ({
            route: routeMap[r.routeId]?.name || r.routeId,
            routeCode: routeMap[r.routeId]?.code,
            totalLitres: Number(r._sum.litres || 0).toFixed(2),
            collections: r._count.id,
          })).sort((a, b) => Number(b.totalLitres) - Number(a.totalLitres)),
        };
      }

      if (input.groupBy === 'day') {
        const collections = await prisma.milkCollection.findMany({
          where, select: { litres: true, collectedAt: true }, orderBy: { collectedAt: 'asc' },
        });
        const byDay: Record<string, number> = {};
        for (const c of collections) {
          const day = c.collectedAt.toISOString().split('T')[0];
          byDay[day] = (byDay[day] || 0) + Number(c.litres);
        }
        return { groupBy: 'day', data: Object.entries(byDay).map(([date, litres]) => ({ date, litres: litres.toFixed(2) })) };
      }

      if (input.groupBy === 'farmer') {
        const result = await prisma.milkCollection.groupBy({
          by: ['farmerId'],
          where,
          _sum: { litres: true },
          _count: { id: true },
        });
        const farmerIds = result.map(r => r.farmerId);
        const farmers = await prisma.farmer.findMany({
          where: { id: { in: farmerIds } },
          include: { route: { select: { name: true } } },
        });
        const farmerMap = Object.fromEntries(farmers.map(f => [f.id, f]));
        return {
          groupBy: 'farmer',
          data: result.map(r => ({
            code: farmerMap[r.farmerId]?.code,
            name: farmerMap[r.farmerId]?.name,
            route: farmerMap[r.farmerId]?.route.name,
            totalLitres: Number(r._sum.litres || 0).toFixed(2),
            days: r._count.id,
          })).sort((a, b) => Number(b.totalLitres) - Number(a.totalLitres)).slice(0, input.limit || 100),
        };
      }

      // Default: return totals
      const agg = await prisma.milkCollection.aggregate({
        where,
        _sum: { litres: true },
        _count: { id: true },
      });
      return {
        totalLitres: Number(agg._sum.litres || 0).toFixed(2),
        totalCollections: agg._count.id,
        totalValue: (Number(agg._sum.litres || 0) * 46).toFixed(2),
      };
    }

    case 'query_payroll': {
      const where: any = {};
      if (input.periodMonth) where.periodMonth = input.periodMonth;
      if (input.periodYear) where.periodYear = input.periodYear;
      if (input.status) where.status = input.status;
      if (input.role) where.employee = { role: input.role };

      const payrolls = await prisma.payroll.findMany({
        where,
        include: { employee: { select: { code: true, name: true, role: true } } },
        orderBy: { employee: { name: 'asc' } },
      });

      const total = payrolls.reduce((s, p) => s + Number(p.netPay), 0);
      return {
        count: payrolls.length,
        totalNetPay: total.toFixed(2),
        payrolls: payrolls.map(p => ({
          code: p.employee.code,
          name: p.employee.name,
          role: p.employee.role,
          baseSalary: Number(p.baseSalary),
          varianceDeductions: Number(p.varianceDeductions),
          otherDeductions: Number(p.otherDeductions),
          netPay: Number(p.netPay),
          status: p.status,
          paidAt: p.paidAt,
        })),
      };
    }

    case 'query_advances': {
      const results: any = { advances: [], deductions: [] };

      if (input.type === 'advance' || input.type === 'both') {
        const where: any = {};
        if (input.farmerId) where.farmerId = input.farmerId;
        if (input.routeCode) where.farmer = { route: { code: input.routeCode.toUpperCase() } };
        if (input.dateFrom || input.dateTo) {
          where.advanceDate = {};
          if (input.dateFrom) where.advanceDate.gte = new Date(input.dateFrom);
          if (input.dateTo) where.advanceDate.lte = new Date(input.dateTo);
        }
        const advances = await prisma.farmerAdvance.findMany({
          where,
          include: { farmer: { include: { route: { select: { name: true } } } } },
          orderBy: { advanceDate: 'desc' },
        });
        results.advances = advances.map(a => ({
          farmerCode: a.farmer.code, farmerName: a.farmer.name,
          route: a.farmer.route.name, amount: Number(a.amount),
          date: a.advanceDate, notes: a.notes,
        }));
        results.totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0).toFixed(2);
      }

      if (input.type === 'deduction' || input.type === 'both') {
        const where: any = {};
        if (input.farmerId) where.farmerId = input.farmerId;
        if (input.routeCode) where.farmer = { route: { code: input.routeCode.toUpperCase() } };
        const deductions = await prisma.farmerDeduction.findMany({
          where,
          include: { farmer: { include: { route: { select: { name: true } } } } },
          orderBy: { deductionDate: 'desc' },
        });
        results.deductions = deductions.map(d => ({
          farmerCode: d.farmer.code, farmerName: d.farmer.name,
          route: d.farmer.route.name, amount: Number(d.amount),
          reason: d.reason, date: d.deductionDate,
        }));
        results.totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0).toFixed(2);
      }

      return results;
    }

    case 'query_factory': {
      const where: any = {};
      if (input.dateFrom || input.dateTo) {
        const dateField = input.type === 'receipts' ? 'receivedAt' : input.type === 'deliveries' ? 'deliveredAt' : 'processedAt';
        where[dateField] = {};
        if (input.dateFrom) where[dateField].gte = new Date(input.dateFrom);
        if (input.dateTo) where[dateField].lte = new Date(input.dateTo);
      }

      if (input.type === 'batches') {
        const batches = await prisma.pasteurizationBatch.findMany({ where, orderBy: { processedAt: 'desc' }, take: 50 });
        return { count: batches.length, batches: batches.map(b => ({ batchNo: b.batchNo, input: Number(b.inputLitres), output: Number(b.outputLitres), loss: Number(b.lossLitres), date: b.processedAt })) };
      }

      if (input.type === 'summary') {
        const [batches, receipts] = await Promise.all([
          prisma.pasteurizationBatch.aggregate({ _sum: { inputLitres: true, outputLitres: true, lossLitres: true }, _count: true }),
          prisma.factoryReceipt.aggregate({ _sum: { litres: true }, _count: true }),
        ]);
        return {
          totalReceived: Number(receipts._sum.litres || 0).toFixed(2),
          totalBatches: batches._count,
          totalInput: Number(batches._sum.inputLitres || 0).toFixed(2),
          totalOutput: Number(batches._sum.outputLitres || 0).toFixed(2),
          totalLoss: Number(batches._sum.lossLitres || 0).toFixed(2),
        };
      }

      return { message: 'Factory data retrieved' };
    }

    case 'query_shops': {
      const where: any = {};
      if (input.shopCode) where.shop = { code: input.shopCode };
      if (input.unreconciledOnly) where.reconciled = false;
      if (input.dateFrom || input.dateTo) {
        where.saleDate = {};
        if (input.dateFrom) where.saleDate.gte = new Date(input.dateFrom);
        if (input.dateTo) where.saleDate.lte = new Date(input.dateTo);
      }
      const sales = await prisma.shopSale.findMany({
        where,
        include: { shop: { select: { code: true, name: true } } },
        orderBy: { saleDate: 'desc' },
        take: 100,
      });
      const totalVariance = sales.reduce((s, s2) => s + Number(s2.variance), 0);
      return {
        count: sales.length,
        totalVariance: totalVariance.toFixed(2),
        sales: sales.map(s => ({
          shop: s.shop.name, date: s.saleDate,
          litresSold: Number(s.litresSold), expected: Number(s.expectedRevenue),
          collected: Number(s.cashCollected), variance: Number(s.variance),
          reconciled: s.reconciled,
        })),
      };
    }

    case 'get_summary_stats': {
      const month = input.month || new Date().getMonth() + 1;
      const year = input.year || new Date().getFullYear();

      const [farmerCount, routeCount, collAgg, midPayments, endPayments, payrollAgg] = await Promise.all([
        prisma.farmer.count({ where: { isActive: true } }),
        prisma.route.count(),
        prisma.milkCollection.aggregate({
          where: {
            collectedAt: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) },
          },
          _sum: { litres: true },
        }),
        prisma.farmerPayment.aggregate({
          where: { periodMonth: month, periodYear: year, isMidMonth: true },
          _sum: { netPay: true, grossPay: true },
          _count: true,
        }),
        prisma.farmerPayment.aggregate({
          where: { periodMonth: month, periodYear: year, isMidMonth: false },
          _sum: { netPay: true, grossPay: true },
          _count: true,
        }),
        prisma.payroll.aggregate({
          where: { periodMonth: month, periodYear: year },
          _sum: { netPay: true },
          _count: true,
        }),
      ]);

      return {
        month, year,
        activeFarmers: farmerCount,
        activeRoutes: routeCount,
        totalLitres: Number(collAgg._sum.litres || 0).toFixed(2),
        totalMilkValue: (Number(collAgg._sum.litres || 0) * 46).toFixed(2),
        midMonthPayments: { count: midPayments._count, totalNetPay: Number(midPayments._sum.netPay || 0).toFixed(2) },
        endMonthPayments: { count: endPayments._count, totalNetPay: Number(endPayments._sum.netPay || 0).toFixed(2) },
        staffPayroll: { count: payrollAgg._count, totalNetPay: Number(payrollAgg._sum.netPay || 0).toFixed(2) },
      };
    }

    case 'approve_farmer_payments': {
      const where: any = {
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        isMidMonth: input.isMidMonth,
        status: 'PENDING',
      };
      if (input.routeCode) where.farmer = { route: { code: input.routeCode.toUpperCase() } };

      const result = await prisma.farmerPayment.updateMany({ where, data: { status: 'APPROVED' } });
      return { approved: result.count, message: `Successfully approved ${result.count} payments.` };
    }

    case 'record_advance': {
      const farmer = await prisma.farmer.findUnique({ where: { code: input.farmerCode.toUpperCase() } });
      if (!farmer) return { error: `Farmer ${input.farmerCode} not found` };

      const advance = await prisma.farmerAdvance.create({
        data: {
          farmerId: farmer.id,
          amount: input.amount,
          advanceDate: input.date ? new Date(input.date) : new Date(),
          notes: input.notes || null,
        },
      });
      return { success: true, advance: { id: advance.id, farmerName: farmer.name, amount: input.amount, date: advance.advanceDate } };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main chat handler ────────────────────────────────────────────────────────
export const aiChat = async (req: Request, res: Response) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Set up SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendChunk = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const now = new Date();
    const dateContext = `Current date: ${now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Current month: ${now.getMonth() + 1}, Year: ${now.getFullYear()}.`;

    let apiMessages = [
      { role: 'user' as const, content: dateContext + '\n\n' + (messages[0]?.content || '') },
      ...messages.slice(1),
    ];

    // Agentic loop — keep going until no more tool calls
    let continueLoop = true;
    let fullResponse = '';
    let toolsUsed: string[] = [];

    while (continueLoop) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages: apiMessages,
      });

      // Process response blocks
      for (const block of response.content) {
        if (block.type === 'text') {
          fullResponse += block.text;
          sendChunk({ type: 'text', text: block.text });
        }

        if (block.type === 'tool_use') {
          toolsUsed.push(block.name);
          sendChunk({ type: 'tool_call', tool: block.name, input: block.input });

          // Execute tool
          const toolResult = await executeTool(block.name, block.input);
          sendChunk({ type: 'tool_result', tool: block.name, result: toolResult });

          // Add to message history for next loop
          apiMessages = [
            ...apiMessages,
            { role: 'assistant' as const, content: response.content },
            {
              role: 'user' as const,
              content: [{
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify(toolResult),
              }],
            },
          ];
        }
      }

      // Check if we should continue
      if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
        continueLoop = false;
      } else if (response.stop_reason === 'tool_use') {
        // Continue to process tool results
        continueLoop = true;
      } else {
        continueLoop = false;
      }
    }

    sendChunk({ type: 'done', toolsUsed });
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err: any) {
    console.error('AI chat error:', err);
    sendChunk({ type: 'error', message: err.message || 'AI service error' });
    res.end();
  }
};
