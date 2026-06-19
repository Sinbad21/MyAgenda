import { getDb } from './db';

export interface SearchResult {
  type: 'log' | 'expense';
  id: string;
  title: string;
  subtitle: string;
  date: string;
  icon: string;
}

/**
 * Global search across logs and expenses.
 * Returns results ranked by recency (date DESC).
 */
export function globalSearch(userId: string, query: string, limit = 30): SearchResult[] {
  if (!query.trim()) return [];
  const db = getDb();
  const q = `%${query.trim()}%`;

  const logs = db
    .prepare(
      `SELECT l.id, l.title, l.notes, l.event_date AS date,
              c.name AS cat_name, c.icon AS cat_icon
       FROM logs l LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.user_id = ? AND (l.title LIKE ? OR l.notes LIKE ?)
       ORDER BY l.event_date DESC LIMIT ?`
    )
    .all(userId, q, q, limit) as any[];

  const expenses = db
    .prepare(
      `SELECT e.id, e.note AS title, e.category, e.date, e.amount
       FROM expenses e
       WHERE e.user_id = ? AND (e.note LIKE ? OR e.category LIKE ?)
       ORDER BY e.date DESC LIMIT ?`
    )
    .all(userId, q, q, limit) as any[];

  const results: SearchResult[] = [
    ...logs.map((l) => ({
      type: 'log' as const,
      id: l.id,
      title: l.title,
      subtitle: l.cat_name ? `${l.cat_icon ?? ''} ${l.cat_name}` : '',
      date: l.date,
      icon: l.cat_icon ?? '📋',
    })),
    ...expenses
      .filter((e) => e.title) // skip expenses with no note
      .map((e) => ({
        type: 'expense' as const,
        id: e.id,
        title: e.title ?? e.category,
        subtitle: `${e.category} · ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(e.amount)}`,
        date: e.date,
        icon: '💶',
      })),
  ];

  // Sort by date desc
  results.sort((a, b) => (b.date > a.date ? 1 : -1));
  return results.slice(0, limit);
}
