import { getDb } from './db';

export interface SearchResult {
  type: 'log' | 'expense'; id: string; title: string; subtitle: string; date: string; icon: string;
}

export async function globalSearch(userId: string, query: string, limit = 30): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const db = getDb();
  const q = `%${query.trim()}%`;

  const [logsRes, expensesRes] = await Promise.all([
    db.prepare(
      `SELECT l.id, l.title, l.notes, l.event_date AS date, c.name AS cat_name, c.icon AS cat_icon
       FROM logs l LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.user_id = ? AND (l.title LIKE ? OR l.notes LIKE ?)
       ORDER BY l.event_date DESC LIMIT ?`
    ).bind(userId, q, q, limit).all<any>(),
    db.prepare(
      `SELECT e.id, e.note AS title, e.category, e.date, e.amount
       FROM expenses e WHERE e.user_id = ? AND (e.note LIKE ? OR e.category LIKE ?)
       ORDER BY e.date DESC LIMIT ?`
    ).bind(userId, q, q, limit).all<any>(),
  ]);

  const results: SearchResult[] = [
    ...logsRes.results.map((l: any) => ({
      type: 'log' as const, id: l.id, title: l.title,
      subtitle: l.cat_name ? `${l.cat_icon ?? ''} ${l.cat_name}` : '', date: l.date, icon: l.cat_icon ?? '📋',
    })),
    ...expensesRes.results.filter((e: any) => e.title).map((e: any) => ({
      type: 'expense' as const, id: e.id, title: e.title ?? e.category,
      subtitle: `${e.category} · ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(e.amount)}`,
      date: e.date, icon: '💶',
    })),
  ];

  results.sort((a, b) => (b.date > a.date ? 1 : -1));
  return results.slice(0, limit);
}
