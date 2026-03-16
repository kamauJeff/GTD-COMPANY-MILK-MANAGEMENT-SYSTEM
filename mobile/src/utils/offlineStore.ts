// src/utils/offlineStore.ts
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export async function initDB() {
  db = await SQLite.openDatabaseAsync('gutoria.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_id INTEGER NOT NULL,
      farmer_name TEXT,
      route_id INTEGER,
      grader_id INTEGER,
      litres REAL NOT NULL,
      collected_at TEXT NOT NULL,
      receipt_no TEXT,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cached_farmers (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      route_id INTEGER,
      route_name TEXT,
      route_code TEXT,
      price_per_litre REAL DEFAULT 46,
      payment_method TEXT DEFAULT 'MPESA',
      is_active INTEGER DEFAULT 1,
      cached_at TEXT DEFAULT (datetime('now'))
    );
  `);
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
  if (!db) await initDB();
  await db.runAsync(
    'INSERT INTO pending_collections (farmer_id, farmer_name, route_id, grader_id, litres, collected_at, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [data.farmerId, data.farmerName ?? null, data.routeId ?? null, data.graderId ?? null, data.litres, data.collectedAt, data.receiptNo ?? null]
  );
}

export async function getPendingCollections() {
  if (!db) await initDB();
  return db.getAllAsync<any>('SELECT * FROM pending_collections WHERE synced = 0 ORDER BY created_at ASC');
}

export async function markSynced(ids: number[]) {
  if (!db) await initDB();
  if (ids.length === 0) return;
  await db.runAsync(
    `UPDATE pending_collections SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function clearSynced() {
  if (!db) await initDB();
  await db.runAsync('DELETE FROM pending_collections WHERE synced = 1');
}

// ─── Farmer Cache ─────────────────────────────────────────────────────────────

export async function cacheFarmers(farmers: any[]) {
  if (!db) await initDB();
  // Clear old cache
  await db.runAsync('DELETE FROM cached_farmers');
  // Insert all
  for (const f of farmers) {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_farmers 
        (id, code, name, phone, route_id, route_name, route_code, price_per_litre, payment_method, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        f.id, f.code, f.name, f.phone ?? '',
        f.route?.id ?? f.routeId ?? null,
        f.route?.name ?? f.routeName ?? '',
        f.route?.code ?? f.routeCode ?? '',
        Number(f.pricePerLitre) || 46,
        f.paymentMethod ?? 'MPESA',
        f.isActive ? 1 : 0,
      ]
    );
  }
}

export async function searchCachedFarmers(query: string, routeId?: number): Promise<any[]> {
  if (!db) await initDB();
  const q = `%${query.toLowerCase()}%`;
  let sql = `SELECT * FROM cached_farmers WHERE is_active = 1 AND (LOWER(name) LIKE ? OR LOWER(code) LIKE ?)`;
  const params: any[] = [q, q];
  if (routeId) { sql += ' AND route_id = ?'; params.push(routeId); }
  sql += ' LIMIT 20';
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(r => ({
    id: r.id, code: r.code, name: r.name, phone: r.phone,
    routeId: r.route_id, pricePerLitre: r.price_per_litre, paymentMethod: r.payment_method,
    route: { id: r.route_id, name: r.route_name, code: r.route_code },
  }));
}

export async function getCachedFarmersByRoute(routeId: number): Promise<any[]> {
  if (!db) await initDB();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM cached_farmers WHERE route_id = ? AND is_active = 1 ORDER BY name ASC',
    [routeId]
  );
  return rows.map(r => ({
    id: r.id, code: r.code, name: r.name, phone: r.phone,
    routeId: r.route_id, pricePerLitre: r.price_per_litre, paymentMethod: r.payment_method,
    route: { id: r.route_id, name: r.route_name, code: r.route_code },
  }));
}

export async function getCachedFarmerCount(): Promise<number> {
  if (!db) await initDB();
  const row = await db.getFirstAsync<any>('SELECT COUNT(*) as cnt FROM cached_farmers');
  return row?.cnt ?? 0;
}
