// src/utils/syncService.ts
import { getPendingCollections, markSynced, cacheFarmers } from './offlineStore';
import { collectionsApi, farmersApi, authApi } from '../api/client';

export async function syncPendingCollections(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingCollections();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  const records = pending.map((p: any) => ({
    farmerId: p.farmerId,
    litres: p.litres,
    collectedAt: p.collectedAt,
    receiptNo: p.receiptNo,
  }));

  try {
    const result = await collectionsApi.batchSync(records);
    await markSynced(pending.map((p: any) => p.id));
    return { synced: result.data.created, failed: result.data.failed };
  } catch {
    return { synced: 0, failed: pending.length };
  }
}

export async function downloadFarmersForGrader(routeId?: number): Promise<number> {
  try {
    if (!routeId) {
      try {
        const routeRes = await authApi.myRoute();
        routeId = routeRes.data?.route?.id;
      } catch {}
    }
    const params: any = { isActive: true, limit: 2000 };
    if (routeId) params.routeId = routeId;
    const res = await farmersApi.list(params);
    const farmers = res.data?.data ?? [];
    if (farmers.length > 0) await cacheFarmers(farmers);
    return farmers.length;
  } catch {
    return 0;
  }
}

export async function getGraderRoute(): Promise<{ id: number; name: string } | null> {
  try {
    const res = await authApi.myRoute();
    return res.data?.route ?? null;
  } catch {
    return null;
  }
}
