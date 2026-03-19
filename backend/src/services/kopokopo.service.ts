// KopoKopo Pay API Service
// Sandbox: https://sandbox.kopokopo.com
// Production: https://api.kopokopo.com

import axios from 'axios';

const BASE_URL = process.env.KOPOKOPO_ENV === 'production'
  ? 'https://api.kopokopo.com'
  : 'https://sandbox.kopokopo.com';

async function getAccessToken(): Promise<string> {
  const res = await axios.post(`${BASE_URL}/oauth/token`, {
    grant_type:    'client_credentials',
    client_id:     process.env.KOPOKOPO_CLIENT_ID,
    client_secret: process.env.KOPOKOPO_CLIENT_SECRET,
  });
  return res.data.access_token;
}

export interface PayRecipient {
  firstName:  string;
  lastName:   string;
  phone:      string;   // 254XXXXXXXXX
  amount:     number;
  narration:  string;
  paymentId?: number;   // internal reference
}

// Add a mobile wallet recipient then send payment
export async function disburseSingle(token: string, recipient: PayRecipient): Promise<string> {
  const callbackUrl = `${process.env.BACKEND_URL || 'https://zippy-integrity-production-62f2.up.railway.app'}/api/webhooks/kopokopo`;

  // Step 1: Register recipient
  const recipientRes = await axios.post(
    `${BASE_URL}/api/v1/pay_recipients`,
    {
      type: 'mobile_wallet',
      pay_recipient: {
        first_name:   recipient.firstName,
        last_name:    recipient.lastName,
        phone_number: recipient.phone,
        network:      'Safaricom',
        email:        '',
      },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  const recipientLocation = recipientRes.headers.location;

  // Step 2: Send payment
  const payRes = await axios.post(
    `${BASE_URL}/api/v1/payments`,
    {
      payment_channel: 'Mobile Wallet',
      till_identifier: process.env.KOPOKOPO_TILL_IDENTIFIER || '',
      subscriber: { phone_number: recipient.phone },
      amount: { value: String(recipient.amount.toFixed(2)), currency: 'KES' },
      metadata: { notes: recipient.narration },
      _links: {
        callback_url: callbackUrl,
        pay_recipient: recipientLocation,
      },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  return payRes.headers.location || payRes.data?.data?.id || 'sent';
}

export async function disburseBatch(
  recipients: PayRecipient[],
  narration: string
): Promise<{ successful: { phone: string; ref: string }[]; failed: { phone: string; error: string }[] }> {
  const token = await getAccessToken();
  const successful: { phone: string; ref: string }[] = [];
  const failed: { phone: string; error: string }[]   = [];

  // Process in chunks of 5 to avoid rate limits
  const CHUNK = 5;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async r => {
      try {
        const ref = await disburseSingle(token, { ...r, narration });
        successful.push({ phone: r.phone, ref });
      } catch (e: any) {
        const errMsg = e?.response?.data?.error_description
          || e?.response?.data?.message
          || e.message;
        failed.push({ phone: r.phone, error: errMsg });
      }
    }));
    // Small delay between chunks
    if (i + CHUNK < recipients.length) await new Promise(r => setTimeout(r, 500));
  }

  return { successful, failed };
}

export async function getBalance(): Promise<{ amount: number; currency: string } | null> {
  try {
    const token = await getAccessToken();
    const res = await axios.get(`${BASE_URL}/api/v1/merchant_wallets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const wallet = res.data?.data?.[0];
    return wallet ? { amount: Number(wallet.available_amount || 0), currency: 'KES' } : null;
  } catch {
    return null;
  }
}
