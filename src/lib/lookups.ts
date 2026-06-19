import { getDb, newId, nowIso } from './db';
import type { Category, Vehicle } from './types';
import type { CategoryKind } from './knowledge-base';

export async function categoryByKind(userId: string, kind: CategoryKind | string | undefined): Promise<Category | null> {
  const db = getDb();
  if (kind) {
    const c = await db
      .prepare('SELECT * FROM categories WHERE user_id = ? AND kind = ? ORDER BY is_default DESC LIMIT 1')
      .bind(userId, kind)
      .first<Category>();
    if (c) return c;
  }
  return await db.prepare("SELECT * FROM categories WHERE user_id = ? AND kind = 'general' LIMIT 1").bind(userId).first<Category>() ?? null;
}

export async function resolveVehicle(userId: string, name?: string): Promise<Vehicle | null> {
  const db = getDb();
  const { results: vehicles } = await db
    .prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at')
    .bind(userId)
    .all<Vehicle>();
  if (vehicles.length === 0) {
    if (!name) return null;
    const id = newId();
    await db.prepare('INSERT INTO vehicles (id, user_id, name, current_km, created_at) VALUES (?, ?, ?, 0, ?)').bind(id, userId, name, nowIso()).run();
    return await db.prepare('SELECT * FROM vehicles WHERE id = ?').bind(id).first<Vehicle>() ?? null;
  }
  if (name) {
    const n = name.toLowerCase();
    const match = vehicles.find((v) => v.name.toLowerCase().includes(n) || n.includes(v.name.toLowerCase()));
    if (match) return match;
  }
  return vehicles[0];
}

export async function updateVehicleKm(userId: string, vehicleId: string, km: number): Promise<void> {
  await getDb()
    .prepare('UPDATE vehicles SET current_km = ?, km_updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(km, nowIso(), vehicleId, userId)
    .run();
}
