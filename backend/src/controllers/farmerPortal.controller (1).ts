import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// GET /api/farmer-portal/statement?code=FM0668&month=9&year=2024&period=end
export const getFarmerStatement = async (req: Request, res: Response) => {
  const { code, month, year, period } = req.query;

  if (!code || !month || !year) {
    return res.status(400).json({ error: 'code, month, and year are required' });
  }

  const m = parseInt(month as string);
  const y = parseInt(year as string);
  const isMid = period === 'mid';

  if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
    return res.status(400).json({ error: 'Invalid month or year' });
  }

  // Find farmer
  const farmer = await prisma.farmer.findUnique({
    where: { code: (code as string).toUpperCase() },
    include: { route: { select: { code: true, name: true } } },
  });

  if (!farmer) {
    return res.status(404).json({ error: 'Farmer not found. Please check your code.' });
  }

  // Date range for the period
  const startDate = new Date(y, m - 1, 1);
  const midDate   = new Date(y, m - 1, 15, 23, 59, 59);
  const endDate   = new Date(y, m - 1 + 1, 0, 23, 59, 59); // last day of month

  const collectionEnd = isMid ? midDate : endDate;

  // Collections
  const collections = await prisma.milkCollection.findMany({
    where: {
      farmerId: farmer.id,
      collectedAt: { gte: startDate, lte: collectionEnd },
    },
    orderBy: { collectedAt: 'asc' },
  });

  // Build day-by-day array
  const daysInPeriod = isMid ? 15 : new Date(y, m, 0).getDate();
  const dailyMap: Record<number, number> = {};
  for (const c of collections) {
    const day = new Date(c.collectedAt).getDate();
    dailyMap[day] = (dailyMap[day] || 0) + Number(c.litres);
  }
  const dailyCollections = Array.from({ length: daysInPeriod }, (_, i) => ({
    day: i + 1,
    litres: dailyMap[i + 1] || 0,
  }));

  const totalLitres = dailyCollections.reduce((s, d) => s + d.litres, 0);
  const pricePerLitre = Number(farmer.pricePerLitre);
  const totalMilkValue = totalLitres * pricePerLitre;

  // Advances in this period
  const advanceStart = isMid ? startDate : new Date(y, m - 1, 16);
  const advances = await prisma.farmerAdvance.findMany({
    where: {
      farmerId: farmer.id,
      advanceDate: { gte: isMid ? startDate : startDate, lte: collectionEnd },
    },
  });
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);

  // Deductions
  const deductions = await prisma.farmerDeduction.findMany({
    where: {
      farmerId: farmer.id,
      periodMonth: m,
      periodYear: y,
    },
  });
  const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);

  const netPay = totalMilkValue - totalAdvances - totalDeductions;

  // Payment record
  const payment = await prisma.farmerPayment.findUnique({
    where: {
      dairyId_farmerId_periodMonth_periodYear_isMidMonth: {
        farmerId: farmer.id,
        periodMonth: m,
        periodYear: y,
        isMidMonth: isMid,
      },
    },
  });

  return res.json({
    farmer: {
      code: farmer.code,
      name: farmer.name,
      phone: farmer.phone,
      paymentMethod: farmer.paymentMethod,
      mpesaPhone: farmer.mpesaPhone,
      bankName: farmer.bankName,
      bankAccount: farmer.bankAccount,
      pricePerLitre: farmer.pricePerLitre,
      route: farmer.route,
    },
    period: isMid ? 'mid' : 'end',
    month: m,
    year: y,
    collections: dailyCollections,
    summary: {
      totalLitres: parseFloat(totalLitres.toFixed(2)),
      totalMilkValue: parseFloat(totalMilkValue.toFixed(2)),
      advances: parseFloat(totalAdvances.toFixed(2)),
      deductions: parseFloat(totalDeductions.toFixed(2)),
      netPay: parseFloat(netPay.toFixed(2)),
    },
    payment: payment
      ? {
          status: payment.status,
          grossPay: payment.grossPay,
          netPay: payment.netPay,
          paidAt: payment.paidAt,
          kopokopoRef: payment.kopokopoRef,
        }
      : null,
  });
};
