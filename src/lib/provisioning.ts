import { getDb, newId, nowIso } from './db';
import { DEFAULT_CATEGORIES, ensureDefaultExpenseCategories } from './categories';

export async function provisionNewUser(userId: string): Promise<void> {
  const db = getDb();
  const stmts = DEFAULT_CATEGORIES.map((c) =>
    db.prepare(
      `INSERT INTO categories (id, user_id, name, icon, color, kind, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    ).bind(newId(), userId, c.name, c.icon, c.color, c.kind, nowIso())
  );
  await db.batch(stmts);
  await ensureDefaultExpenseCategories(userId);
}
