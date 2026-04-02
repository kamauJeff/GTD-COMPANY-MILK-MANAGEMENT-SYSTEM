import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const getFarmerStatement = async (req: Request, res: Response) => {
  const { code, month, year, period } = req.query;
  if (!code || !month || !year) return res.status(400).json({ error: 'code, month, and year are required' });

  const m    = parseInt(month as string);
  const y    = parseInt(year  as string);
  const isMid = period === 'mid';
  if (isNaN(m) || isNaN(y) || m < 1 || m > 12) return res.status(400).json({ error: 'Invalid month or year' });

  // Use findFirst — code is unique per dairy, not globally
  const farmer = await prisma.farmer.findFirst({
    where: { dairyId: 1, code: (code as string).toUpperCase() },
  });
  if (!farmer) return res.status(404).json({ error: 'Farmer not found. Please check your code.' });

  const startDate = new Date(Date.UTC(y, m - 1, 1));
  const midEnd    = new Date(Date.UTC(y, m - 1, 16));
  const fullEnd   = new Date(Date.UTC(y, m, 1));
  const collEnd   = isMid ? midEnd : fullEnd;

  const [collections, advances, deductions] = await Promise.all([
    prisma.milkCollection.findMany({
      where: { farmerId: farmer.id, collectedAt: { gte: startDate, lt: collEnd } },
      orderBy: { collectedAt: 'asc' },
    }),
    prisma.farmerAdvance.findMany({
      where: { farmerId: farmer.id, advanceDate: { gte: startDate, lt: collEnd } },
    }),
    prisma.farmerDeduction.findMany({
      where: { farmerId: farmer.id, periodMonth: m, periodYear: y },
    }),
  ]);

  const dailyMap: Record<number, number> = {};
  for (const c of collections) {
    const iso = c.collectedAt instanceof Date ? c.collectedAt.toISOString() : String(c.collectedAt);
    const day = parseInt(iso.slice(8, 10), 10);
    dailyMap[day] = (dailyMap[day] || 0) + Number(c.litres);
  }

  const daysInPeriod = isMid ? 15 : new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dailyCollections = Array.from({ length: daysInPeriod }, (_, i) => ({ day: i + 1, litres: dailyMap[i + 1] || 0 }));
  const totalLitres    = dailyCollections.reduce((s, d) => s + d.litres, 0);
  const pricePerLitre  = Number(farmer.pricePerLitre);
  const totalMilkValue = totalLitres * pricePerLitre;
  const totalAdvances  = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalDeductions = deductions.reduce((s, d) => s + Number(d.amount), 0);
  const netPay = totalMilkValue - totalAdvances - totalDeductions;

  const payment = await prisma.farmerPayment.findFirst({
    where: { farmerId: farmer.id, periodMonth: m, periodYear: y, isMidMonth: isMid },
  });

  return res.json({
    farmer: {
      code: farmer.code, name: farmer.name, phone: farmer.phone,
      paymentMethod: farmer.paymentMethod, mpesaPhone: farmer.mpesaPhone,
      bankName: farmer.bankName, bankAccount: farmer.bankAccount, pricePerLitre: farmer.pricePerLitre,
      routeId: farmer.routeId,
    },
    period: isMid ? 'mid' : 'end', month: m, year: y,
    collections: dailyCollections,
    summary: {
      totalLitres: parseFloat(totalLitres.toFixed(2)),
      totalMilkValue: parseFloat(totalMilkValue.toFixed(2)),
      advances: parseFloat(totalAdvances.toFixed(2)),
      deductions: parseFloat(totalDeductions.toFixed(2)),
      netPay: parseFloat(netPay.toFixed(2)),
    },
    payment: payment ? { status: payment.status, grossPay: payment.grossPay, netPay: payment.netPay, paidAt: payment.paidAt, kopokopoRef: payment.kopokopoRef } : null,
  });
};
