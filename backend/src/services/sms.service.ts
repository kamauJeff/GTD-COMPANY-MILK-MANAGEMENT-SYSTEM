// eslint-disable-next-line @typescript-eslint/no-require-imports
// src/services/sms.service.ts
// @ts-ignore
import AfricasTalking from 'africastalking';
import { Farmer, MilkCollection } from '@prisma/client';
import { logger } from '../config/logger';

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY!,
  username: process.env.AT_USERNAME!,
});
const sms = at.SMS;

export async function sendCollectionSMS(farmer: Farmer, collection: Pick<MilkCollection, 'litres' | 'collectedAt'>) {
  if (!farmer.phone) return;

  const date = new Date(collection.collectedAt).toLocaleDateString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const message = `Dear ${farmer.name}, we received ${collection.litres}L of milk on ${date}. Thank you - Gutoria Dairies.`;

  try {
    await sms.send({
      to: [farmer.phone],
      message,
      from: process.env.AT_SENDER_ID,
    });
    logger.info(`SMS sent to farmer ${farmer.code}`);
  } catch (err) {
    logger.error(`SMS failed for farmer ${farmer.code}:`, err);
    throw err;
  }
}

export async function sendPaymentSMS(phone: string, name: string, amount: number, period: string) {
  const message = `Dear ${name}, your milk payment of KES ${amount.toLocaleString()} for ${period} has been sent. Thank you - Gutoria Dairies.`;
  return sms.send({ to: [phone], message, from: process.env.AT_SENDER_ID });
}
