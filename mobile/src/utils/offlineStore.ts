// src/utils/offlineStore.ts — AsyncStorage based (no SQLite dependency)
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = 'gutoria_pending_collections';
const FARMERS_KEY = 'gutoria_cached_farmers';

export async function initDB() {
  // Nothing to init with AsyncStorage
}

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
  const existing = await getPendingCollections();
  const newRecord = { ...data, id: Date.now(), synced: false };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...existing, newRecord]));
}

export async function getPendingCollections(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  return raw ? JSON.parse(raw).filter((r: any) => !r.synced) : [];
}

export async function markSynced(ids: number[]) {
  const all = await AsyncStorage.getItem(PENDING_KEY);
  if (!all) return;
  const records = JSON.parse(all).map((r: any) =>
    ids.includes(r.id) ? { ...r, synced: true } : r
  );
  // Keep only last 200 synced records to avoid storage bloat
  const unsynced = records.filter((r: any) => !r.synced);
  const recentSynced = records.filter((r: any) => r.synced).slice(-50);
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...unsynced, ...recentSynced]));
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

export async function getCachedFarmerCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(FARMERS_KEY);
  if (!raw) return 0;
  return JSON.parse(raw).length;
}
