// src/utils/syncService.ts
import { getPendingCollections, markSynced, cacheFarmers, getCachedFarmerCount } from './offlineStore';
import { collectionsApi, farmersApi, authApi } from '../api/client';

// Sync pending collections to server
export async function syncPendingCollections(): Promise<{ synced: number; failed: number }> {
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

// Download all farmers for a grader's route and cache offline
export async function downloadFarmersForGrader(routeId?: number): Promise<number> {
  try {
    // First try to get grader's own route
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

    if (farmers.length > 0) {
      await cacheFarmers(farmers);
    }
    return farmers.length;
  } catch (e) {
    console.error('Failed to download farmers:', e);
    return 0;
  }
}

// Get grader's route info
export async function getGraderRoute(): Promise<{ id: number; name: string } | null> {
  try {
    const res = await authApi.myRoute();
    return res.data?.route ?? null;
  } catch {
    return null;
  }
}

// Sync pending collections to server
export async function syncPendingCollections(): Promise<{ synced: number; failed: number }> {
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

// Download all farmers for a grader's route and cache offline
export async function downloadFarmersForGrader(routeId?: number): Promise<number> {
  try {
    // Download all active farmers (optionally filtered by route)
    const params: any = { isActive: true, limit: 2000 };
    if (routeId) params.routeId = routeId;
    
    const res = await farmersApi.list(params);
    const farmers = res.data?.data ?? [];
    
    if (farmers.length > 0) {
      await cacheFarmers(farmers);
    }
    return farmers.length;
  } catch (e) {
    console.error('Failed to download farmers:', e);
    return 0;
  }
}

// Get grader's route info from server
export async function getGraderRoute(graderId: number): Promise<any | null> {
  try {
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/collections/grader-total?graderId=${graderId}&date=${new Date().toISOString().split('T')[0]}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.route ?? null;
  } catch {
    return null;
  }
}
