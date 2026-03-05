// src/utils/syncService.ts
import NetInfo from '@react-native-community/netinfo';
import { getPendingCollections, markSynced } from './offlineStore';
import { collectionsApi } from '../api/client';

export async function syncPendingCollections(): Promise<{ synced: number; failed: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return { synced: 0, failed: 0 };

  const pending = await getPendingCollections();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  const records = pending.map((p: any) => ({
    farmerId: p.farmer_id,
    litres: p.litres,
    collectedAt: p.collected_at,
    receiptNo: p.receipt_no,
  }));

  try {
    const result = await collectionsApi.batchSync(records);
    await markSynced(pending.map((p: any) => p.id));
    return { synced: result.data.created, failed: result.data.failed };
  } catch {
    return { synced: 0, failed: pending.length };
  }
}

