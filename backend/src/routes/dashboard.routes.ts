import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();
router.use(authenticate);

// GET /api/dashboard — all data for the dashboard in one call
router.get('/', async (req, res) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const day   = now.getDate();

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 1);
  const midEnd     = new Date(year, month - 1, 16);  // end of 1-15 window

  try {
    // Run all queries in parallel
    const [
      // Today's collections per route
      todayCollections,
      // Factory receipts today
      todayReceipts,
      // Shop deliveries today
      todayDeliveries,
      // Shop sales today
      todaySales,
      // Total active farmers
      totalFarmers,
      // paidOn15th farmers count
      midFarmers,
      // Month collections total (for payment readiness)
      monthMidColl,    // 1-15 collections (for mid-month farmers)
      monthEndColl,    // 16-end collections (for end-month split of paidOn15th)
      monthFullColl,   // 1-end (for full-month farmers)
      // Pending payments
      pendingPayments,
      approvedPayments,
      // Already paid this month
      paidMidCount,
      paidEndCount,
    ] = await Promise.all([
      // Today collections
      prisma.milkCollection.groupBy({
        by: ['routeId'],
        where: { collectedAt: { gte: today, lt: tomorrow } },
        _sum: { litres: true },
        _count: { id: true },
      }),
      // Factory receipts today
      prisma.factoryReceipt.aggregate({
        where: { receivedAt: { gte: today, lt: tomorrow } },
        _sum: { litres: true }, _count: true,
      }),
      // Deliveries today
      prisma.deliveryToShop.aggregate({
        where: { deliveredAt: { gte: today, lt: tomorrow } },
        _sum: { litres: true }, _count: true,
      }),
      // Sales today
      prisma.shopSale.aggregate({
        where: { saleDate: { gte: today, lt: tomorrow } },
        _sum: { litresSold: true, cashCollected: true, tillAmount: true }, _count: true,
      }),
      // Total active farmers
      prisma.farmer.count({ where: { isActive: true } }),
      // paidOn15th farmers
      prisma.farmer.count({ where: { isActive: true, paidOn15th: true } }),
      // 1-15 collections this month (for mid-month readiness)
      prisma.milkCollection.groupBy({
        by: ['farmerId'],
        where: { collectedAt: { gte: monthStart, lt: midEnd } },
        _sum: { litres: true },
      }),
      // 16-end collections this month
      prisma.milkCollection.groupBy({
        by: ['farmerId'],
        where: { collectedAt: { gte: midEnd, lt: monthEnd } },
        _sum: { litres: true },
      }),
      // 1-end collections this month (all)
      prisma.milkCollection.groupBy({
        by: ['farmerId'],
        where: { collectedAt: { gte: monthStart, lt: monthEnd } },
        _sum: { litres: true },
      }),
      // Pending payments
      prisma.farmerPayment.groupBy({
        by: ['isMidMonth'],
        where: { periodMonth: month, periodYear: year, status: 'PENDING' },
        _count: true, _sum: { netPay: true },
      }),
      // Approved payments
      prisma.farmerPayment.groupBy({
        by: ['isMidMonth'],
        where: { periodMonth: month, periodYear: year, status: 'APPROVED' },
        _count: true, _sum: { netPay: true },
      }),
      // Already paid mid-month
      prisma.farmerPayment.count({
        where: { periodMonth: month, periodYear: year, isMidMonth: true, status: 'PAID' },
      }),
      // Already paid end-month
      prisma.farmerPayment.count({
        where: { periodMonth: month, periodYear: year, isMidMonth: false, status: 'PAID' },
      }),
    ]);

    // ── Daily reconciliation ──────────────────────────────────────────────────
    const collectedToday = todayCollections.reduce((s, r) => s + Number(r._sum.litres || 0), 0);
    const receivedToday  = Number(todayReceipts._sum.litres || 0);
    const deliveredToday = Number(todayDeliveries._sum.litres || 0);
    const soldToday      = Number(todaySales._sum.litresSold || 0);
    const revenueToday   = Number(todaySales._sum.cashCollected || 0) + Number(todaySales._sum.tillAmount || 0);
    const collVsReceived = receivedToday - collectedToday; // positive = factory got more than graders recorded
    const delivVsSold    = deliveredToday - soldToday;     // positive = unsold stock in shops

    // ── Route reporting status ────────────────────────────────────────────────
    const allRoutes = await prisma.route.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });
    const reportedRouteIds = new Set(todayCollections.map(c => c.routeId).filter(Boolean));
    const routeStatus = allRoutes.map(r => ({
      id: r.id, code: r.code, name: r.name,
      reported: reportedRouteIds.has(r.id),
      litres: Number(todayCollections.find(c => c.routeId === r.id)?._sum?.litres || 0),
    }));

    // ── Payment readiness ─────────────────────────────────────────────────────
    // Mid-month: ready if day >= 13 (2 days before 15th) and paidOn15th farmers have 1-15 collections
    const midFarmersWithColl = monthMidColl.filter(c => Number(c._sum.litres || 0) > 0).length;
    const midTotalLitres     = monthMidColl.reduce((s, c) => s + Number(c._sum.litres || 0), 0);
    // Estimate mid gross (use KES 50 as default price for estimate)
    const midEstGross        = midTotalLitres * 50;

    // End-month: ready if day >= 28 (for paidOn15th split + full month farmers)
    const endFarmersWithColl = monthEndColl.filter(c => Number(c._sum.litres || 0) > 0).length;
    const fullFarmersWithColl = monthFullColl.filter(c => Number(c._sum.litres || 0) > 0).length;
    const endTotalLitres     = monthEndColl.reduce((s, c) => s + Number(c._sum.litres || 0), 0);
    const fullTotalLitres    = monthFullColl.reduce((s, c) => s + Number(c._sum.litres || 0), 0);
    const endEstGross        = (endTotalLitres + (fullTotalLitres - midTotalLitres)) * 50;

    // Mid-month readiness
    const midReady    = day >= 13 && midFarmersWithColl > 0;
    const midAlerted  = paidMidCount === 0 && day > 15; // overdue
    // End-month readiness
    const endReady    = day >= 28 && (endFarmersWithColl > 0 || fullFarmersWithColl > 0);
    const endAlerted  = paidEndCount === 0 && day > 31;

    // Pending / approved payment summaries
    const pendingMid  = pendingPayments.find(p => p.isMidMonth);
    const pendingEnd  = pendingPayments.find(p => !p.isMidMonth);
    const approvedMid = approvedPayments.find(p => p.isMidMonth);
    const approvedEnd = approvedPayments.find(p => !p.isMidMonth);

    res.json({
      today: today.toISOString().split('T')[0],
      day, month, year,

      // Daily reconciliation
      reconciliation: {
        collectedLitres: parseFloat(collectedToday.toFixed(2)),
        receivedLitres:  parseFloat(receivedToday.toFixed(2)),
        deliveredLitres: parseFloat(deliveredToday.toFixed(2)),
        soldLitres:      parseFloat(soldToday.toFixed(2)),
        revenueToday:    parseFloat(revenueToday.toFixed(2)),
        collVsReceived:  parseFloat(collVsReceived.toFixed(2)),
        delivVsSold:     parseFloat(delivVsSold.toFixed(2)),
        routesReported:  reportedRouteIds.size,
        routesTotal:     allRoutes.length,
        isBalanced:      Math.abs(collVsReceived) < 1 && Math.abs(delivVsSold) < 20,
      },

      // Route-by-route today
      routeStatus,

      // Farmers overview
      farmers: { total: totalFarmers, midMonth: midFarmers, endOnly: totalFarmers - midFarmers },

      // Payment readiness
      paymentReadiness: {
        mid: {
          ready: midReady,
          overdue: midAlerted,
          alreadyPaid: paidMidCount > 0,
          farmersWithCollections: midFarmersWithColl,
          estimatedGross: Math.round(midEstGross),
          totalLitres: parseFloat(midTotalLitres.toFixed(1)),
          pending: pendingMid ? { count: pendingMid._count, amount: Math.round(Number(pendingMid._sum.netPay || 0)) } : null,
          approved: approvedMid ? { count: approvedMid._count, amount: Math.round(Number(approvedMid._sum.netPay || 0)) } : null,
        },
        end: {
          ready: endReady,
          overdue: endAlerted,
          alreadyPaid: paidEndCount > 0,
          farmersWithCollections: Math.max(endFarmersWithColl, fullFarmersWithColl),
          estimatedGross: Math.round(endEstGross),
          totalLitres: parseFloat((endTotalLitres + fullTotalLitres).toFixed(1)),
          pending: pendingEnd ? { count: pendingEnd._count, amount: Math.round(Number(pendingEnd._sum.netPay || 0)) } : null,
          approved: approvedEnd ? { count: approvedEnd._count, amount: Math.round(Number(approvedEnd._sum.netPay || 0)) } : null,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Dashboard error' });
  }
});

export default router;
