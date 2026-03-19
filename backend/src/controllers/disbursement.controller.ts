// src/controllers/disbursement.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { disburseBatch, getBalance } from '../services/kopokopo.service';

export async function previewDisbursement(req: Request, res: Response) {
  const { month, year, isMidMonth, routeId } = req.query;
  const m = Number(month); const y = Number(year); const mid = isMidMonth === 'true';

  const where: any = { periodMonth: m, periodYear: y, isMidMonth: mid, status: 'APPROVED', netPay: { gt: 0 } };
  if (routeId) where.farmer = { routeId: Number(routeId) };

  const payments = await prisma.farmerPayment.findMany({
    where,
    include: { farmer: { include: { route: { select: { name: true } } } } },
  });

  const mpesa = payments.filter(p => p.farmer.paymentMethod === 'MPESA');
  const bank  = payments.filter(p => p.farmer.paymentMethod === 'BANK');

  res.json({
    total: payments.length,
    mpesaCount: mpesa.length,
    bankCount: bank.length,
    totalAmount: payments.filter(p => Number(p.netPay) > 0).reduce((s, p) => s + Number(p.netPay), 0),
    mpesaAmount: mpesa.reduce((s, p) => s + Number(p.netPay), 0),
    bankAmount:  bank.reduce((s, p) => s + Number(p.netPay), 0),
  });
}

export async function getKopokopoBalance(req: Request, res: Response) {
  const balance = await getBalance();
  res.json(balance || { amount: 0, currency: 'KES' });
}
