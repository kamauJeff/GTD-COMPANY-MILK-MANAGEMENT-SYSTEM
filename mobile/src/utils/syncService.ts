// src/utils/syncService.ts
// No @react-native-community/netinfo needed — we just try the request
import { getPendingCollections, markSynced } from './offlineStore';
import { collectionsApi } from '../api/client';

export async function syncPendingCollections(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingCollections();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  const records = pending.map((p: any) => ({
    farmerId:    p.farmer_id,
    routeId:     p.route_id,
    graderId:    p.grader_id,
    litres:      p.litres,
    collectedAt: p.collected_at,
  }));

  try {
    const result = await collectionsApi.batchSync(records);
    await markSynced(pending.map((p: any) => p.id));
    return {
      synced: result.data.created ?? pending.length,
      failed: result.data.failed ?? 0,
    };
  } catch {
    return { synced: 0, failed: pending.length };
  }
}
