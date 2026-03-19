// KopoKopo STK Push / B2C Disbursement Service
// Docs: https://app.kopokopo.com/push_api

import axios from 'axios';

const KOPOKOPO_BASE = 'https://sandbox.kopokopo.com'; // Change to https://api.kopokopo.com for production

interface KopokopoConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  callbackUrl: string;
}

interface PaymentRecipient {
  firstName: string;
  lastName: string;
  phone: string;    // 254XXXXXXXXX format
  amount: number;
  notes: string;
}

// Get OAuth access token
async function getAccessToken(config: KopokopoConfig): Promise<string> {
  const res = await axios.post(`${KOPOKOPO_BASE}/oauth/token`, {
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  return res.data.access_token;
}

// Send money to multiple recipients (Pay Merchant)
export async function disburseBatch(
  recipients: PaymentRecipient[],
  narration: string
): Promise<{ successful: string[]; failed: { phone: string; error: string }[] }> {
  const config: KopokopoConfig = {
    clientId:     process.env.KOPOKOPO_CLIENT_ID || '',
    clientSecret: process.env.KOPOKOPO_CLIENT_SECRET || '',
    apiKey:       process.env.KOPOKOPO_API_KEY || '',
    callbackUrl:  `${process.env.BACKEND_URL || 'https://zippy-integrity-production-62f2.up.railway.app'}/api/webhooks/kopokopo`,
  };

  if (!config.clientId || !config.clientSecret) {
    throw new Error('KopoKopo credentials not configured. Set KOPOKOPO_CLIENT_ID and KOPOKOPO_CLIENT_SECRET in Railway.');
  }

  const token = await getAccessToken(config);
  const successful: string[] = [];
  const failed: { phone: string; error: string }[] = [];

  for (const r of recipients) {
    try {
      const res = await axios.post(
        `${KOPOKOPO_BASE}/api/v1/pay_recipients`,
        {
          type: 'mobile_wallet',
          pay_recipient: {
            first_name: r.firstName,
            last_name: r.lastName,
            phone_number: r.phone,
            network: 'Safaricom',
            email: '',
          },
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      const recipientRef = res.headers.location || res.data.data?.id;

      // Now create the payment
      await axios.post(
        `${KOPOKOPO_BASE}/api/v1/payments`,
        {
          payment_channel: 'Mobile Wallet',
          till_identifier: process.env.KOPOKOPO_TILL || '',
          subscriber: { phone_number: r.phone },
          amount: { value: r.amount.toFixed(2), currency: 'KES' },
          metadata: { notes: narration },
          _links: {
            callback_url: config.callbackUrl,
            pay_recipient: recipientRef,
          },
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Source-Reference': `gutoria-${Date.now()}` } }
      );

      successful.push(r.phone);
    } catch (e: any) {
      failed.push({ phone: r.phone, error: e?.response?.data?.error_description || e.message });
    }
  }

  return { successful, failed };
}

// Verify account balance
export async function getBalance(): Promise<{ amount: number; currency: string } | null> {
  try {
    const config = {
      clientId:     process.env.KOPOKOPO_CLIENT_ID || '',
      clientSecret: process.env.KOPOKOPO_CLIENT_SECRET || '',
    };
    if (!config.clientId) return null;
    const token = await getAccessToken(config as KopokopoConfig);
    const res = await axios.get(`${KOPOKOPO_BASE}/api/v1/merchant_wallets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const wallet = res.data?.data?.[0];
    return wallet ? { amount: Number(wallet.available_amount), currency: 'KES' } : null;
  } catch {
    return null;
  }
}
