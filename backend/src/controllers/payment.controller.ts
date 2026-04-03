// src/controllers/payment.controller.ts
// Handles advance-related logic called from AI controller
import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export async function createAdvance(req: Request, res: Response) {
  const { farmerId, farmerCode, amount, notes, date } = req.body;
  let fId = farmerId;
  if (!fId && farmerCode) {
    const farmer = await prisma.farmer.findFirst({
      where: { dairyId: req.dairyId!, code: farmerCode.toUpperCase() }
    });
    if (!farmer) return res.status(404).json({ error: `Farmer ${farmerCode} not found` });
    fId = farmer.id;
  }
  // Normalize date to UTC noon
  let advanceDate: Date;
  if (date) {
    const match = String(date).match(/(\d{4})-(\d{2})-(\d{2})/);
    advanceDate = match
      ? new Date(Date.UTC(+match[1], +match[2]-1, +match[3], 12, 0, 0))
      : new Date(date);
  } else {
    const now = new Date();
    advanceDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  }
  const advance = await prisma.farmerAdvance.create({
    data: { dairyId: req.dairyId!, farmerId: Number(fId), amount: Number(amount), advanceDate, notes: notes || null },
    include: { farmer: { select: { code: true, name: true } } },
  });
  res.status(201).json(advance);
}

export async function upsertFarmerPayment(dairyId: number, r: any) {
  return prisma.farmerPayment.upsert({
    where: {
      dairyId_farmerId_periodMonth_periodYear_isMidMonth: {
        dairyId, farmerId: r.farmerId, periodMonth: r.periodMonth,
        periodYear: r.periodYear, isMidMonth: r.isMidMonth,
      },
    },
    update: { grossPay: r.grossPay, totalAdvances: r.totalAdvances, totalDeductions: r.totalDeductions, netPay: r.netPay, status: 'APPROVED' },
    create: { dairyId, ...r, status: 'APPROVED' },
  });
}
