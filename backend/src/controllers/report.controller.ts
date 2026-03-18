import { Request, Response } from 'express';
import prisma from '../config/prisma';

function periodBounds(month: number, year: number) {
  return {
    start: new Date(year, month - 1, 1),
    end:   new Date(year, month, 1),
  };
}

// ─── Overview ────────────────────────────────────────────────────────────────
export async function getOverview(req: Request, res: Response) {
  const m = Number(req.query.month) || new Date().getMonth() + 1;
  const y = Number(req.query.year)  || new Date().getFullYear();
  const { start, end } = periodBounds(m, y);

  const [collAgg, advAgg, receiptsAgg, shopAgg, payments, batchAgg] = await Promise.all([
    prisma.milkCollection.aggregate({ where: { collectedAt: { gte: start, lt: end } }, _sum: { litres: true }, _count: { farmerId: true } }),
    prisma.farmerAdvance.aggregate({ where: { advanceDate: { gte: start, lt: end } }, _sum: { amount: true }, _count: { farmerId: true } }),
    prisma.factoryReceipt.aggregate({ where: { receivedAt: { gte: start, lt: end } }, _sum: { litres: true } }),
    prisma.shopSale.aggregate({ where: { saleDate: { gte: start, lt: end } }, _sum: { litresSold: true } }).catch(() => ({ _sum: { litresSold: 0 } })),
    prisma.farmerPayment.findMany({ where: { periodMonth: m, periodYear: y } }),
    prisma.pasteurizationBatch.aggregate({ where: { processedAt: { gte: start, lt: end } }, _sum: { inputLitres: true, outputLitres: true, lossLitres: true } }).catch(() => ({ _sum: { inputLitres: 0, outputLitres: 0, lossLitres: 0 } })),
  ]);

  const totalLitres   = Number(collAgg._sum.litres || 0);
  const totalAdvances = Number(advAgg._sum.amount || 0);
  const grossPayments = totalLitres * 46;
  const netPayments   = payments.reduce((s, p) => s + Number(p.netPay), 0);
  const negativeBalances = payments.filter(p => Number(p.netPay) < 0).length;
  const factoryReceived = Number(receiptsAgg._sum.litres || 0);
  const totalVariance = factoryReceived - totalLitres;

  res.json({
    totalLitres, grossPayments, totalAdvances, netPayments,
    factoryReceived, totalVariance,
    activeFarmers: collAgg._count.farmerId,
    farmersWithAdvances: advAgg._count.farmerId,
    negativeBalances,
    shopSales: Number(shopAgg._sum.litresSold || 0),
    pasteurized: Number(batchAgg._sum.outputLitres || 0),
    activeShops: 38,
  });
}

// ─── Collections by Route ─────────────────────────────────────────────────────
export async function getCollectionsReport(req: Request, res: Response) {
  const m = Number(req.query.month) || new Date().getMonth() + 1;
  const y = Number(req.query.year)  || new Date().getFullYear();
  const { start, end } = periodBounds(m, y);

  const byRoute = await prisma.milkCollection.groupBy({
    by: ['routeId'],
    where: { collectedAt: { gte: start, lt: end } },
    _sum: { litres: true },
    _count: { farmerId: true },
  });

  const routes = await prisma.route.findMany({ select: { id: true, code: true, name: true } });
  const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));

  const totalLitres = byRoute.reduce((s, r) => s + Number(r._sum.litres || 0), 0);

  // Zero-litre farmers
  const activeFarmerIds = await prisma.milkCollection.findMany({
    where: { collectedAt: { gte: start, lt: end } },
    select: { farmerId: true },
    distinct: ['farmerId'],
  });
  const totalFarmers = await prisma.farmer.count({ where: { isActive: true } });
  const zeroFarmers = totalFarmers - activeFarmerIds.length;

  const routeData = byRoute.map(r => ({
    routeId: r.routeId,
    routeName: routeMap[r.routeId]?.name ?? 'Unknown',
    routeCode: routeMap[r.routeId]?.code ?? '',
    totalLitres: Number(r._sum.litres || 0),
    farmerCount: r._count.farmerId,
  })).sort((a, b) => b.totalLitres - a.totalLitres);

  if (req.query.format === 'csv') {
    const header = 'Route,Total Litres,Farmer Count,Avg/Farmer,Value KES';
    const rows = routeData.map(r =>
      `"${r.routeName}",${Number(r.totalLitres).toFixed(1)},${r.farmerCount},${r.farmerCount > 0 ? (Number(r.totalLitres)/r.farmerCount).toFixed(1) : 0},${(Number(r.totalLitres)*46).toFixed(0)}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="collections-report.csv"`);
    return res.send(`${header}\n${rows}`);
  }

  res.json({ byRoute: routeData, totalLitres, activeFarmers: activeFarmerIds.length, zeroFarmers });
}

// ─── Farmers Report ───────────────────────────────────────────────────────────
export async function getFarmersReport(req: Request, res: Response) {
  const m = Number(req.query.month) || new Date().getMonth() + 1;
  const y = Number(req.query.year)  || new Date().getFullYear();
  const { start, end } = periodBounds(m, y);

  const [collections, advances, payments] = await Promise.all([
    prisma.milkCollection.groupBy({
      by: ['farmerId'],
      where: { collectedAt: { gte: start, lt: end } },
      _sum: { litres: true },
    }),
    prisma.farmerAdvance.groupBy({
      by: ['farmerId'],
      where: { advanceDate: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.farmerPayment.findMany({
      where: { periodMonth: m, periodYear: y },
      include: { farmer: { include: { route: { select: { name: true } } } } },
    }),
  ]);

  const collMap = Object.fromEntries(collections.map(c => [c.farmerId, Number(c._sum.litres || 0)]));
  const advMap  = Object.fromEntries(advances.map(a => [a.farmerId, Number(a._sum.amount || 0)]));

  const farmers = payments.map(p => ({
    farmerId:    p.farmerId,
    farmerCode:  p.farmer.code,
    farmerName:  p.farmer.name,
    routeName:   p.farmer.route?.name ?? '–',
    totalLitres: collMap[p.farmerId] ?? 0,
    grossPay:    Number(p.grossPay),
    advances:    advMap[p.farmerId] ?? Number(p.totalAdvances),
    bfDebt:      0,
    netPay:      Number(p.netPay),
    period:      p.isMidMonth ? 'Mid' : 'End',
  })).sort((a, b) => a.farmerName.localeCompare(b.farmerName));

  if (req.query.format === 'csv') {
    const header = 'Code,Name,Route,Litres,Gross Pay,Advances,Net Pay,Period,Status';
    const rows = farmers.map(f =>
      `"${f.farmerCode}","${f.farmerName}","${f.routeName}",${f.totalLitres.toFixed(1)},${f.grossPay.toFixed(0)},${f.advances.toFixed(0)},${f.netPay.toFixed(0)},${f.period},${f.netPay < 0 ? 'Negative' : 'Payable'}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="farmers-report.csv"`);
    return res.send(`${header}\n${rows}`);
  }

  res.json({ farmers });
}

// ─── Graders Report ───────────────────────────────────────────────────────────
export async function getGradersReport(req: Request, res: Response) {
  const m = Number(req.query.month) || new Date().getMonth() + 1;
  const y = Number(req.query.year)  || new Date().getFullYear();
  const { start, end } = periodBounds(m, y);

  const graders = await prisma.employee.findMany({
    where: { role: 'GRADER', isActive: true },
    include: { supervisedRoutes: { select: { id: true, name: true, code: true } } },
    orderBy: { code: 'asc' },
  });

  const results = await Promise.all(graders.map(async g => {
    const route = g.supervisedRoutes[0] ?? null;
    const collWhere: any = {
      collectedAt: { gte: start, lt: end },
      OR: [
        { graderId: g.id },
        ...(route ? [{ routeId: route.id }] : []),
      ],
    };
    const [collAgg, recvAgg] = await Promise.all([
      prisma.milkCollection.aggregate({ where: collWhere, _sum: { litres: true } }),
      prisma.factoryReceipt.aggregate({ where: { graderId: g.id, receivedAt: { gte: start, lt: end } }, _sum: { litres: true } }),
    ]);
    const collected = Number(collAgg._sum.litres || 0);
    const received  = Number(recvAgg._sum.litres || 0);
    return {
      graderId: g.id, graderCode: g.code, graderName: g.name,
      routeName: route?.name ?? '–', routeCode: route?.code ?? '–',
      collected, received, variance: received - collected,
    };
  }));

  if (req.query.format === 'csv') {
    const header = 'Code,Grader,Route,Collected (L),Received (L),Variance (L),Variance (KES),Status';
    const rows = results.map(g =>
      `"${g.graderCode}","${g.graderName}","${g.routeName}",${g.collected.toFixed(1)},${g.received.toFixed(1)},${g.variance.toFixed(1)},${(Math.abs(g.variance)*46).toFixed(0)},${g.variance < 0 ? 'Missing' : g.variance === 0 ? 'Perfect' : 'Excess'}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="graders-report.csv"`);
    return res.send(`${header}\n${rows}`);
  }

  res.json({ graders: results });
}

// ─── Factory Report ───────────────────────────────────────────────────────────
export async function getFactoryReport(req: Request, res: Response) {
  const m = Number(req.query.month) || new Date().getMonth() + 1;
  const y = Number(req.query.year)  || new Date().getFullYear();
  const { start, end } = periodBounds(m, y);

  const [receiptsAgg, batchAgg, delivAgg] = await Promise.all([
    prisma.factoryReceipt.aggregate({ where: { receivedAt: { gte: start, lt: end } }, _sum: { litres: true } }),
    prisma.pasteurizationBatch.aggregate({ where: { processedAt: { gte: start, lt: end } }, _sum: { inputLitres: true, outputLitres: true, lossLitres: true }, _count: { id: true } }).catch(() => ({ _sum: { inputLitres: 0, outputLitres: 0, lossLitres: 0 }, _count: { id: 0 } })),
    prisma.shopSale.aggregate({ where: { saleDate: { gte: start, lt: end } }, _sum: { litresSold: true } }).catch(() => ({ _sum: { litresSold: 0 } })),
  ]);

  const input  = Number(batchAgg._sum.inputLitres || 0);
  const output = Number(batchAgg._sum.outputLitres || 0);
  const efficiency = input > 0 ? ((output / input) * 100).toFixed(1) : '–';

  res.json({
    received:  Number(receiptsAgg._sum.litres || 0),
    input, output,
    loss:      Number(batchAgg._sum.lossLitres || 0),
    efficiency,
    batches:   batchAgg._count.id,
    delivered: Number(delivAgg._sum.litresSold || 0),
  });
}

// ─── Payments Report ─────────────────────────────────────────────────────────
export async function getPaymentsReport(req: Request, res: Response) {
  const m = Number(req.query.month) || new Date().getMonth() + 1;
  const y = Number(req.query.year)  || new Date().getFullYear();

  const payments = await prisma.farmerPayment.findMany({
    where: { periodMonth: m, periodYear: y },
    include: { farmer: { select: { code: true, name: true } } },
  });

  const totalGross    = payments.reduce((s, p) => s + Number(p.grossPay), 0);
  const totalAdvances = payments.reduce((s, p) => s + Number(p.totalAdvances), 0);
  const totalNet      = payments.reduce((s, p) => s + Number(p.netPay), 0);
  const negativeCount = payments.filter(p => Number(p.netPay) < 0).length;
  const carriedForward = payments.filter(p => Number(p.netPay) < 0).reduce((s, p) => s + Math.abs(Number(p.netPay)), 0);
  const midMonthCount = payments.filter(p => p.isMidMonth).length;
  const endMonthCount = payments.filter(p => !p.isMidMonth).length;

  if (req.query.format === 'csv') {
    const header = 'Code,Farmer,Gross Pay,Advances,Net Pay,Period,Status';
    const rows = payments.map(p =>
      `"${p.farmer.code}","${p.farmer.name}",${Number(p.grossPay).toFixed(0)},${Number(p.totalAdvances).toFixed(0)},${Number(p.netPay).toFixed(0)},${p.isMidMonth ? 'Mid' : 'End'},${Number(p.netPay) < 0 ? 'Negative' : 'Paid'}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payments-report.csv"`);
    return res.send(`${header}\n${rows}`);
  }

  res.json({ paidCount: payments.length, totalGross, totalAdvances, totalNet, negativeCount, carriedForward, midMonthCount, endMonthCount });
}
