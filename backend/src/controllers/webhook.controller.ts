// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { logger } from '../config/logger';

function verifySignature(rawBody: Buffer, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.KOPOKOPO_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function kopokopoTillWebhook(req: Request, res: Response) {
  const signature = req.headers['x-kopokopo-signature'] as string;
  if (!signature || !verifySignature(req.body as Buffer, signature)) {
    logger.warn('Kopokopo webhook: invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const payload = JSON.parse((req.body as Buffer).toString());
  logger.info('Kopokopo webhook received', { event: payload.event?.type });

  // Acknowledge immediately
  res.status(200).send('OK');

  try {
    const { data } = payload;
    if (!data) return;

    const tillNumber = data.resource?.till_number;
    const amount = parseFloat(data.resource?.amount ?? '0');
    const ref = data.resource?.reference;
    const txnDate = new Date(data.resource?.origination_time ?? Date.now());

    if (!tillNumber || !ref) return;

    const shop = await prisma.shop.findFirst({ where: { tillNumber } });
    if (!shop) {
      logger.warn(`Kopokopo: no shop for till ${tillNumber}`);
      return;
    }

    await prisma.kopokopoTransaction.upsert({
      where: { transactionRef: ref },
      create: { shopId: shop.id, tillNumber, amount, transactionRef: ref, transactionDate: txnDate },
      update: {},
    });

    // Try to match today's ShopSale
    const startOfDay = new Date(txnDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const sale = await prisma.shopSale.findFirst({
      where: { shopId: shop.id, saleDate: { gte: startOfDay, lt: endOfDay }, reconciled: false },
    });

    if (sale) {
      await prisma.shopSale.update({
        where: { id: sale.id },
        data: { tillAmount: { increment: amount }, reconciled: true },
      });
    }
  } catch (err) {
    logger.error('Kopokopo webhook processing error', err);
  }
}

