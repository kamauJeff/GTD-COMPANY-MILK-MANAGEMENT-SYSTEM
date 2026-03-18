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
