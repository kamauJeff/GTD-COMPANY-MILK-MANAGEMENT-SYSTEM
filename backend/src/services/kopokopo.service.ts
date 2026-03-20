import axios from 'axios';

const BASE_URL = process.env.KOPOKOPO_ENV === 'production'
  ? 'https://api.kopokopo.com'
  : 'https://sandbox.kopokopo.com';

async function getAccessToken(): Promise<string> {
  const res = await axios.post(
    `${BASE_URL}/oauth/token`,
    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     process.env.KOPOKOPO_CLIENT_ID || '',
      client_secret: process.env.KOPOKOPO_CLIENT_SECRET || '',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

export interface PayRecipient {
  firstName:  string;
  lastName:   string;
  phone:      string;
  amount:     number;
  narration:  string;
  paymentId?: number;
}

export async function disburseSingle(token: string, recipient: PayRecipient): Promise<string> {
  const callbackUrl = `${process.env.BACKEND_URL || 'https://zippy-integrity-production-62f2.up.railway.app'}/api/webhooks/kopokopo`;

  // Step 1: Add pay recipient
  const recipientRes = await axios.post(
    `${BASE_URL}/api/v1/pay_recipients`,
    {
      type: 'mobile_wallet',
      pay_recipient: {
        first_name:   recipient.firstName,
        last_name:    recipient.lastName,
        phone_number: recipient.phone,
        network:      'Safaricom',
        email:        'payments@gutoriadairies.co.ke',
      },
    },
    {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
    }
  );

  const recipientLocation = recipientRes.headers.location;
  if (!recipientLocation) throw new Error('No recipient location returned');

  // Step 2: Create payment
  const payRes = await axios.post(
    `${BASE_URL}/api/v1/payments`,
    {
      payment_channel: 'Mobile Wallet',
      till_identifier: process.env.KOPOKOPO_TILL_IDENTIFIER || process.env.KOPOKOPO_TILL || '',
      amount: {
        currency: 'KES',
        value:    recipient.amount.toFixed(2),
      },
      metadata: {
        notes:      recipient.narration,
        payment_id: String(recipient.paymentId || ''),
      },
      _links: {
        callback_url: callbackUrl,
        pay_recipient: recipientLocation,
      },
    },
    {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
    }
  );

  return payRes.headers.location || 'sent';
}

export async function disburseBatch(
  recipients: PayRecipient[],
  narration: string
): Promise<{ successful: { phone: string; ref: string }[]; failed: { phone: string; error: string }[] }> {
  if (!process.env.KOPOKOPO_CLIENT_ID || !process.env.KOPOKOPO_CLIENT_SECRET) {
    throw new Error('KopoKopo credentials not set. Add KOPOKOPO_CLIENT_ID and KOPOKOPO_CLIENT_SECRET to Railway.');
  }

  const token = await getAccessToken();
  const successful: { phone: string; ref: string }[] = [];
  const failed: { phone: string; error: string }[]   = [];

  // Process 3 at a time to avoid rate limits
  const CHUNK = 3;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async r => {
      try {
        const ref = await disburseSingle(token, { ...r, narration });
        successful.push({ phone: r.phone, ref });
      } catch (e: any) {
        const msg = e?.response?.data?.error_description
          || e?.response?.data?.message
          || JSON.stringify(e?.response?.data || e.message);
        failed.push({ phone: r.phone, error: msg });
      }
    }));
    if (i + CHUNK < recipients.length) await new Promise(r => setTimeout(r, 1000));
  }

  return { successful, failed };
}

export async function getBalance(): Promise<{ amount: number; currency: string } | null> {
  try {
    const token = await getAccessToken();
    const res = await axios.get(`${BASE_URL}/api/v1/merchant_wallets`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const wallet = res.data?.data?.[0];
    return wallet ? { amount: Number(wallet.available_amount || 0), currency: 'KES' } : null;
  } catch {
    return null;
  }
}
