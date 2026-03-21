// src/utils/offlineStore.ts — AsyncStorage based
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = 'gutoria_pending_collections';
const FARMERS_KEY = 'gutoria_cached_farmers';

export async function initDB() {}

// ─── Collections ─────────────────────────────────────────────────────────────

export async function savePendingCollection(data: {
  farmerId: number;
  farmerName?: string;
  routeId?: number;
  graderId?: number;
  litres: number;
  collectedAt: string;
  receiptNo?: string;
}) {
  const existing = await getAllCollections();
  const newRecord = {
    ...data,
    id: Date.now(),
    synced: 0,
    farmer_name: data.farmerName,
    farmer_id: data.farmerId,
    collected_at: data.collectedAt,
  };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...existing, newRecord]));
}

export async function getAllCollections(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getAllCollectionsToday(): Promise<any[]> {
  const all = await getAllCollections();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = all.filter(r => (r.collected_at || r.collectedAt || '').startsWith(todayStr));

  // Deduplicate: if same farmer has multiple records for today, keep only the latest
  const byFarmer = new Map<number, any>();
  for (const r of todayRecords) {
    const fid = r.farmer_id || r.farmerId;
    const existing = byFarmer.get(fid);
    if (!existing || (r.id > existing.id)) {
      byFarmer.set(fid, r);
    }
  }
  return Array.from(byFarmer.values()).sort((a, b) => b.id - a.id);
}

export async function getPendingCollections(): Promise<any[]> {
  const all = await getAllCollections();
  const pending = all.filter(r => r.synced === 0);

  // Deduplicate: if same farmer has multiple pending records for same day, keep only latest
  const byFarmerDay = new Map<string, any>();
  for (const r of pending) {
    const fid = r.farmer_id || r.farmerId;
    const day = (r.collected_at || r.collectedAt || '').split('T')[0];
    const key = `${fid}_${day}`;
    const existing = byFarmerDay.get(key);
    if (!existing || r.id > existing.id) {
      byFarmerDay.set(key, r);
    }
  }
  return Array.from(byFarmerDay.values());
}

export async function markSynced(ids: number[]) {
  const all = await getAllCollections();
  const updated = all.map(r => ids.includes(r.id) ? { ...r, synced: 1 } : r);
  // Keep last 200 only
  const keep = [...updated.filter(r => r.synced === 0), ...updated.filter(r => r.synced === 1).slice(-100)];
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(keep));
}

// ─── Farmer Cache ─────────────────────────────────────────────────────────────

export async function cacheFarmers(farmers: any[]) {
  await AsyncStorage.setItem(FARMERS_KEY, JSON.stringify(farmers));
}

export async function searchCachedFarmers(query: string, routeId?: number): Promise<any[]> {
  const raw = await AsyncStorage.getItem(FARMERS_KEY);
  if (!raw) return [];
  const farmers: any[] = JSON.parse(raw);
  const q = query.toLowerCase();
  return farmers
    .filter(f => f.isActive !== false)
    .filter(f => routeId ? (f.route?.id === routeId || f.routeId === routeId) : true)
    .filter(f => f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q))
    .slice(0, 20);
}

export async function getCachedFarmersByRoute(routeId: number): Promise<any[]> {
  const raw = await AsyncStorage.getItem(FARMERS_KEY);
  if (!raw) return [];
  const farmers: any[] = JSON.parse(raw);
  return farmers.filter(f => (f.route?.id === routeId || f.routeId === routeId) && f.isActive !== false);
}

export async function getCachedFarmerCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(FARMERS_KEY);
  if (!raw) return 0;
  return JSON.parse(raw).length;
}
