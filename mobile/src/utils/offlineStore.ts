// src/utils/offlineStore.ts
// SQLite-backed offline queue for milk collections

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export async function initDB() {
  db = await SQLite.openDatabaseAsync('gutoria.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_id INTEGER NOT NULL,
      litres REAL NOT NULL,
      collected_at TEXT NOT NULL,
      receipt_no TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export async function savePendingCollection(data: {
  farmerId: number;
  litres: number;
  collectedAt: string;
  receiptNo?: string;
}) {
  if (!db) await initDB();
  await db.runAsync(
    'INSERT INTO pending_collections (farmer_id, litres, collected_at, receipt_no) VALUES (?, ?, ?, ?)',
    [data.farmerId, data.litres, data.collectedAt, data.receiptNo ?? null]
  );
}

export async function getPendingCollections() {
  if (!db) await initDB();
  return db.getAllAsync<any>('SELECT * FROM pending_collections WHERE synced = 0');
}

export async function markSynced(ids: number[]) {
  if (!db) await initDB();
  await db.runAsync(
    `UPDATE pending_collections SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function clearSynced() {
  if (!db) await initDB();
  await db.runAsync('DELETE FROM pending_collections WHERE synced = 1');
}

