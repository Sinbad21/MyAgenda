import { getDb, newId, nowIso } from './db';
import type { Category, Vehicle } from './types';
import type { CategoryKind } from './knowledge-base';

/** Restituisce la categoria dell'utente per "kind" (es. vehicles), o quella Generale. */
export function categoryByKind(userId: string, kind: CategoryKind | string | undefined): Category | null {
  const db = getDb();
  if (kind) {
    const c = db
      .prepare('SELECT * FROM categories WHERE user_id = ? AND kind = ? ORDER BY is_default DESC LIMIT 1')
      .get(userId, kind) as Category | undefined;
    if (c) return c;
  }
  return (
    (db.prepare("SELECT * FROM categories WHERE user_id = ? AND kind = 'general' LIMIT 1").get(userId) as Category) ??
    null
  );
}

/** Trova un veicolo per nome (match approssimativo); altrimenti il primo; altrimenti ne crea uno. */
export function resolveVehicle(userId: string, name?: string): Vehicle | null {
  const db = getDb();
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at').all(userId) as Vehicle[];
  if (vehicles.length === 0) {
    if (!name) return null;
    const id = newId();
    db.prepare('INSERT INTO vehicles (id, user_id, name, current_km, created_at) VALUES (?, ?, ?, 0, ?)').run(
      id, userId, name, nowIso()
    );
    return db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle;
  }
  if (name) {
    const n = name.toLowerCase();
    const match = vehicles.find((v) => v.name.toLowerCase().includes(n) || n.includes(v.name.toLowerCase()));
    if (match) return match;
  }
  return vehicles[0];
}

export function updateVehicleKm(userId: string, vehicleId: string, km: number): void {
  getDb()
    .prepare('UPDATE vehicles SET current_km = ?, km_updated_at = ? WHERE id = ? AND user_id = ?')
    .run(km, nowIso(), vehicleId, userId);
}
