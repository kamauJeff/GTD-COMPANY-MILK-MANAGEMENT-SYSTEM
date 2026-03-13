// src/services/sms.service.ts
// @ts-ignore
import AfricasTalking from 'africastalking';
import { Farmer, MilkCollection } from '@prisma/client';
import { logger } from '../config/logger';

// Lazy init — only create AT client when keys are available
function getSms() {
  const apiKey  = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!apiKey || !username) {
    logger.warn('Africa\'s Talking credentials not set — SMS disabled');
    return null;
  }
  try {
    const at = AfricasTalking({ apiKey, username });
    return at.SMS;
  } catch (err) {
    logger.warn('Africa\'s Talking init failed — SMS disabled');
    return null;
  }
}

export async function sendCollectionSMS(
  farmer: Farmer,
  collection: Pick<MilkCollection, 'litres' | 'collectedAt'>
) {
  if (!farmer.phone) return;
  const sms = getSms();
  if (!sms) return; // SMS not configured — skip silently

  const date = new Date(collection.collectedAt).toLocaleDateString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const message = `Dear ${farmer.name}, we received ${collection.litres}L of milk on ${date}. Thank you - Gutoria Dairies.`;

  try {
    await sms.send({ to: [farmer.phone], message, from: process.env.AT_SENDER_ID });
    logger.info(`SMS sent to farmer ${farmer.code}`);
  } catch (err) {
    logger.error(`SMS failed for farmer ${farmer.code}:`, err);
    // Don't rethrow — SMS failure should not break collection saving
  }
}

export async function sendPaymentSMS(phone: string, name: string, amount: number, period: string) {
  const sms = getSms();
  if (!sms) return;
  const message = `Dear ${name}, your milk payment of KES ${amount.toLocaleString()} for ${period} has been sent. Thank you - Gutoria Dairies.`;
  try {
    await sms.send({ to: [phone], message, from: process.env.AT_SENDER_ID });
  } catch (err) {
    logger.error('Payment SMS failed:', err);
  }
}
