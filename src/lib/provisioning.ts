import { getDb, newId, nowIso } from './db';
import { DEFAULT_CATEGORIES, ensureDefaultExpenseCategories } from './categories';

/** Crea le categorie predefinite per un nuovo utente (§4). */
export function provisionNewUser(userId: string): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO categories (id, user_id, name, icon, color, kind, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  );
  const tx = db.transaction(() => {
    for (const c of DEFAULT_CATEGORIES) {
      insert.run(newId(), userId, c.name, c.icon, c.color, c.kind, nowIso());
    }
  });
  tx();
  // Also seed default expense categories
  ensureDefaultExpenseCategories(userId);
}
