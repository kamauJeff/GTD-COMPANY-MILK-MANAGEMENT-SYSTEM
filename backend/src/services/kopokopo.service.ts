// src/services/kopokopo.service.ts
import axios from 'axios';
import { logger } from '../config/logger';

const BASE_URL = process.env.KOPOKOPO_API_URL ?? 'https://api.kopokopo.com';
const CLIENT_ID = process.env.KOPOKOPO_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.KOPOKOPO_CLIENT_SECRET ?? '';

let _token: string | null = null;
let _tokenExpiry = 0;

// ── Get / refresh OAuth2 bearer token ─────────────────────────
export async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await axios.post(`${BASE_URL}/oauth/token`, {
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  _token       = res.data.access_token;
  _tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000; // 1 min buffer
  logger.info('KopoKopo: token refreshed');
  return _token!;
}

// ── Send money to a farmer's M-Pesa ───────────────────────────
export interface DisbursePayload {
  phone:       string;   // 2547XXXXXXXX format (no + prefix)
  amount:      number;
  firstName:   string;
  lastName:    string;   // remaining names after first — e.g. "KAMAU NJOROGE"
  remarks:     string;   // narration e.g. "Mid Month Payment - March 2026"
  callbackUrl: string;
}

export async function disburseMpesa(payload: DisbursePayload): Promise<string> {
  const token = await getToken();

  const res = await axios.post(
    `${BASE_URL}/api/v1/transfers/outgoing`,
    {
      transfer_type: 'mobile_wallet',
      currency:      'KES',
      amount:        String(payload.amount.toFixed(2)),
      metadata:      { remarks: payload.remarks },
      destination_reference: payload.phone,
      destination_type:      'mobile_wallet',
      destination: {
        first_name: payload.firstName,
        last_name:  payload.lastName,
        phone:      payload.phone,
        network:    'Safaricom',
        email:      '',
      },
      _links: {
        callback_url: payload.callbackUrl,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // KopoKopo returns the transfer URL in the Location header
  const location: string = res.headers?.location ?? '';
  const transferId = location.split('/').pop() ?? res.data?.id ?? '';
  logger.info(`KopoKopo: disbursed KES ${payload.amount} to ${payload.phone} (${payload.firstName} ${payload.lastName}) → ref ${transferId}`);
  return transferId;
}

// ── Check transfer status ──────────────────────────────────────
export async function getTransferStatus(transferId: string): Promise<string> {
  const token = await getToken();
  const res   = await axios.get(`${BASE_URL}/api/v1/transfers/outgoing/${transferId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data?.data?.attributes?.status ?? 'unknown';
}
