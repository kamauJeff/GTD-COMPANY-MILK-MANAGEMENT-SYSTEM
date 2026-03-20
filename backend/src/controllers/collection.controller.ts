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

  const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

  for (const r of records) {
    try {
      const farmer = await prisma.farmer.findUnique({ where: { id: r.farmerId } });
      if (!farmer) { results.failed++; results.errors.push(`Unknown farmer ${r.farmerId}`); continue; }

      const collectedAt = new Date(r.collectedAt);
      // Check if a record already exists for this farmer on this exact day
      const dayStart = new Date(collectedAt); dayStart.setHours(0,0,0,0);
      const dayEnd   = new Date(collectedAt); dayEnd.setHours(23,59,59,999);

      const existing = await prisma.milkCollection.findFirst({
        where: { farmerId: r.farmerId, collectedAt: { gte: dayStart, lte: dayEnd } },
        orderBy: { collectedAt: 'desc' },
      });

      if (existing) {
        // REPLACE — update the existing record with the new litres value
        await prisma.milkCollection.update({
          where: { id: existing.id },
          data: { litres: r.litres, collectedAt, receiptNo: r.receiptNo ?? existing.receiptNo },
        });
        results.updated++;
      } else {
        // CREATE new record
        await prisma.milkCollection.create({
          data: {
            farmerId:    r.farmerId,
            routeId:     farmer.routeId,
            graderId:    (req.user as any).sub,
            litres:      r.litres,
            collectedAt,
            receiptNo:   r.receiptNo,
            synced:      true,
          },
        });
        results.created++;
      }

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

// Get daily total for a specific grader (their route's collections)
export async function getGraderDailyTotal(req: Request, res: Response) {
  const { graderId, date } = req.query;
  if (!graderId) throw new AppError(400, 'graderId required');

  const d = date ? new Date(String(date)) : new Date();
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);

  // Get grader's route
  const grader = await prisma.employee.findUnique({
    where: { id: Number(graderId) },
    include: { supervisedRoutes: { select: { id: true, code: true, name: true } } },
  });
  if (!grader) throw new AppError(404, 'Grader not found');

  const route = grader.supervisedRoutes[0];

  // Total collected by this grader on this date
  const agg = await prisma.milkCollection.aggregate({
    where: {
      graderId: Number(graderId),
      collectedAt: { gte: d, lt: next },
    },
    _sum: { litres: true },
    _count: { id: true },
  });

  // Also get per-farmer breakdown
  const breakdown = await prisma.milkCollection.findMany({
    where: { graderId: Number(graderId), collectedAt: { gte: d, lt: next } },
    include: { farmer: { select: { code: true, name: true } } },
    orderBy: { collectedAt: 'asc' },
  });

  res.json({
    grader: { id: grader.id, name: grader.name, code: grader.code },
    route,
    date: d.toISOString().split('T')[0],
    totalCollected: Number(agg._sum.litres || 0),
    farmerCount: agg._count.id,
    breakdown: breakdown.map(c => ({
      farmer: c.farmer.name,
      code: c.farmer.code,
      litres: Number(c.litres),
      time: c.collectedAt,
    })),
  });
}

// Journal grid — farmers x days for a given month/route
export async function getJournalGrid(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year) || new Date().getFullYear();

  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);

  const where: any = { collectedAt: { gte: start, lt: end } };
  if (routeId) where.routeId = Number(routeId);

  const collections = await prisma.milkCollection.findMany({
    where,
    include: {
      farmer: { select: { id: true, code: true, name: true } },
      route:  { select: { id: true, code: true, name: true } },
    },
    orderBy: { collectedAt: 'asc' },
  });

  // Build grid: { farmerId -> { name, code, route, days: { day: litres }, total } }
  const farmerMap: Record<number, any> = {};
  for (const c of collections) {
    const fid = c.farmerId;
    const day = new Date(c.collectedAt).getDate();
    if (!farmerMap[fid]) {
      farmerMap[fid] = {
        id: fid,
        code: c.farmer.code,
        name: c.farmer.name,
        route: c.route,
        days: {},
        total: 0,
      };
    }
    farmerMap[fid].days[day] = (farmerMap[fid].days[day] || 0) + Number(c.litres);
    farmerMap[fid].total += Number(c.litres);
  }

  // Route totals per day
  const dayTotals: Record<number, number> = {};
  for (const f of Object.values(farmerMap)) {
    for (const [day, litres] of Object.entries(f.days)) {
      dayTotals[Number(day)] = (dayTotals[Number(day)] || 0) + Number(litres);
    }
  }

  const daysInMonth = new Date(y, m, 0).getDate();
  const farmers = Object.values(farmerMap).sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    farmers,
    dayTotals,
    daysInMonth,
    month: m,
    year: y,
    grandTotal: farmers.reduce((s, f) => s + f.total, 0),
  });
}

// Excel export of journal grid
export async function exportJournalExcel(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year) || new Date().getFullYear();

  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const where: any = { collectedAt: { gte: start, lt: end } };
  if (routeId) where.routeId = Number(routeId);

  const collections = await prisma.milkCollection.findMany({
    where,
    include: {
      farmer: { select: { id: true, code: true, name: true } },
      route:  { select: { id: true, code: true, name: true } },
    },
    orderBy: { collectedAt: 'asc' },
  });

  const daysInMonth = new Date(y, m, 0).getDate();

  // Build farmer map
  const farmerMap: Record<number, any> = {};
  for (const c of collections) {
    const fid = c.farmerId;
    const day = new Date(c.collectedAt).getDate();
    if (!farmerMap[fid]) {
      farmerMap[fid] = { code: c.farmer.code, name: c.farmer.name, route: c.route?.name ?? '', days: {}, total: 0 };
    }
    farmerMap[fid].days[day] = (farmerMap[fid].days[day] || 0) + Number(c.litres);
    farmerMap[fid].total += Number(c.litres);
  }

  const farmers = Object.values(farmerMap).sort((a, b) => a.name.localeCompare(b.name));

  // Build CSV (works without extra packages)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const header = ['Code', 'Farmer Name', 'Route', ...days.map(d => `${d}`), 'TOTAL'];
  const rows = farmers.map(f => [
    f.code,
    f.name,
    f.route,
    ...days.map(d => f.days[d] ? Number(f.days[d]).toFixed(1) : '0'),
    f.total.toFixed(1),
  ]);

  // Day totals row
  const dayTotals = days.map(d =>
    farmers.reduce((s, f) => s + (f.days[d] || 0), 0).toFixed(1)
  );
  const grandTotal = farmers.reduce((s, f) => s + f.total, 0).toFixed(1);
  rows.push(['', 'DAILY TOTAL', '', ...dayTotals, grandTotal]);

  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="collections-${MONTHS[m-1]}-${y}.csv"`);
  res.send(csv);
}

// Enhanced journal grid with B/f balance and advances
export async function getJournalGridFull(req: Request, res: Response) {
  const { month, year, routeId } = req.query;
  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year)  || new Date().getFullYear();
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 1);
  const ADVANCE_DATES = [5, 10, 20, 25]; // advance disbursement days (15th is payment day, not advance)

  const where: any = { collectedAt: { gte: start, lt: end } };
  if (routeId) where.routeId = Number(routeId);

  const [collections, advances] = await Promise.all([
    prisma.milkCollection.findMany({
      where,
      include: {
        farmer: { select: { id: true, code: true, name: true, pricePerLitre: true } },
        route:  { select: { id: true, code: true, name: true } },
      },
      orderBy: { collectedAt: 'asc' },
    }),
    prisma.farmerAdvance.findMany({
      where: { advanceDate: { gte: start, lt: end } },
      include: { farmer: { select: { id: true, code: true } } },
    }),
  ]);

  // Build farmer map
  const farmerMap: Record<number, any> = {};
  for (const c of collections) {
    const fid = c.farmerId;
    const day = new Date(c.collectedAt).getDate();
    if (!farmerMap[fid]) {
      farmerMap[fid] = {
        id: fid, code: c.farmer.code, name: c.farmer.name,
        pricePerLitre: Number(c.farmer.pricePerLitre),
        route: c.route, days: {}, total: 0,
        advances: { 5: 0, 10: 0, 20: 0, 25: 0 },
        totalAdvances: 0, bfBalance: 0,
      };
    }
    farmerMap[fid].days[day] = (farmerMap[fid].days[day] || 0) + Number(c.litres);
    farmerMap[fid].total += Number(c.litres);
  }

  // Map advances to exact disbursement date key
  for (const adv of advances) {
    const fid = adv.farmerId;
    if (!farmerMap[fid]) continue;
    const advDay = new Date(adv.advanceDate).getDate();
    // Use exact day if it's one of the advance dates, otherwise find nearest
    const exactMatch = ADVANCE_DATES.includes(advDay) ? advDay :
      ADVANCE_DATES.reduce((prev, curr) =>
        Math.abs(curr - advDay) < Math.abs(prev - advDay) ? curr : prev
      );
    farmerMap[fid].advances[exactMatch] = (farmerMap[fid].advances[exactMatch] || 0) + Number(adv.amount);
    farmerMap[fid].totalAdvances += Number(adv.amount);
  }

  // Get b/f: from previous month negative payments OR current month deductions marked as b/f corrections
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear  = m === 1 ? y - 1 : y;

  const [prevPayments, bfDeductions] = await Promise.all([
    prisma.farmerPayment.findMany({
      where: { periodMonth: prevMonth, periodYear: prevYear, netPay: { lt: 0 }, status: 'PAID' },
      select: { farmerId: true, netPay: true },
    }),
    prisma.farmerDeduction.findMany({
      where: {
        periodMonth: m, periodYear: y,
        reason: { contains: 'B/f' },
      },
      select: { farmerId: true, amount: true },
    }),
  ]);

  for (const pp of prevPayments) {
    if (farmerMap[pp.farmerId]) {
      farmerMap[pp.farmerId].bfBalance = Math.abs(Number(pp.netPay));
    }
  }
  // Overlay b/f corrections (office adjustments)
  for (const d of bfDeductions) {
    if (farmerMap[d.farmerId]) {
      farmerMap[d.farmerId].bfBalance = (farmerMap[d.farmerId].bfBalance || 0) + Number(d.amount);
    } else {
      // Farmer may have no collections but has b/f
      farmerMap[d.farmerId] = {
        id: d.farmerId, code: '', name: '', pricePerLitre: 46, route: null,
        days: {}, total: 0, advances: { 5: 0, 10: 0, 20: 0, 25: 0 }, totalAdvances: 0, bfBalance: Number(d.amount),
      };
    }
  }

  // Compute derived fields
  const farmers = Object.values(farmerMap).sort((a: any, b: any) => a.name.localeCompare(b.name));
  for (const f of farmers as any[]) {
    const total15 = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].reduce((s, d) => s + (f.days[d] || 0), 0);
    f.total15     = total15;
    f.totalLitres = f.total;
    f.totalMoney  = f.total * f.pricePerLitre;
    f.amtPayable  = f.totalMoney - f.totalAdvances - f.bfBalance;
    f.midTM       = total15 * f.pricePerLitre;
    f.midPayable  = f.midTM - (f.advances[5] || 0) - (f.advances[10] || 0);
  }

  const dayTotals: Record<number, number> = {};
  for (const f of farmers) {
    for (const [day, litres] of Object.entries(f.days)) {
      dayTotals[Number(day)] = (dayTotals[Number(day)] || 0) + Number(litres);
    }
  }

  res.json({
    farmers,
    dayTotals,
    daysInMonth: new Date(y, m, 0).getDate(),
    month: m, year: y,
    grandTotal: farmers.reduce((s, f) => s + f.total, 0),
    grandMoney: farmers.reduce((s, f) => s + f.totalMoney, 0),
    advanceDates: ADVANCE_DATES,
  });
}
