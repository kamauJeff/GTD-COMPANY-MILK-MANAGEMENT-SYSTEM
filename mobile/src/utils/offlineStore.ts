// src/utils/offlineStore.ts
// SQLite-backed offline queue for milk collections
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('gutoria.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_collections (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        farmer_id    INTEGER NOT NULL,
        farmer_name  TEXT,
        route_id     INTEGER,
        grader_id    INTEGER,
        litres       REAL NOT NULL,
        collected_at TEXT NOT NULL,
        synced       INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now'))
      );
    `);
  }
  return db;
}

export async function savePendingCollection(data: {
  farmerId: number;
  farmerName?: string;
  routeId?: number;
  graderId?: number;
  litres: number;
  collectedAt: string;
}) {
  const d = await getDb();
  await d.runAsync(
    'INSERT INTO pending_collections (farmer_id, farmer_name, route_id, grader_id, litres, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
    [data.farmerId, data.farmerName ?? null, data.routeId ?? null, data.graderId ?? null, data.litres, data.collectedAt]
  );
}

export async function getPendingCollections() {
  const d = await getDb();
  return d.getAllAsync<any>('SELECT * FROM pending_collections WHERE synced = 0 ORDER BY created_at DESC');
}

export async function getAllCollectionsToday() {
  const d = await getDb();
  const today = new Date().toISOString().split('T')[0];
  return d.getAllAsync<any>(
    "SELECT * FROM pending_collections WHERE date(collected_at) = ? ORDER BY created_at DESC",
    [today]
  );
}

export async function markSynced(ids: number[]) {
  if (ids.length === 0) return;
  const d = await getDb();
  await d.runAsync(
    `UPDATE pending_collections SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function getPendingCount() {
  const d = await getDb();
  const row = await d.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM pending_collections WHERE synced = 0');
  return row?.cnt ?? 0;
}
