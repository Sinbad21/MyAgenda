import type { CategoryKind } from './knowledge-base';
import { getDb, newId, nowIso } from './db';
import type { ExpenseCustomCategory } from './types';

export interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Veicoli', icon: '🚗', color: '#225aec', kind: 'vehicles' },
  { name: 'Salute', icon: '🏥', color: '#e0567a', kind: 'health' },
  { name: 'Casa', icon: '🏠', color: '#f59e0b', kind: 'home' },
  { name: 'Acquisti', icon: '🛒', color: '#16a34a', kind: 'shopping' },
  { name: 'Animali domestici', icon: '🐾', color: '#9333ea', kind: 'pets' },
  { name: 'Generale', icon: '📋', color: '#64748b', kind: 'general' },
];

export const EXPENSE_CATEGORIES = [
  'Alimentari', 'Trasporti', 'Salute', 'Casa', 'Svago', 'Altro',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_ICONS: Record<string, string> = {
  Alimentari: '🍎', Trasporti: '⛽', Salute: '💊', Casa: '🏠', Svago: '🎉', Altro: '📦',
};

export async function ensureDefaultExpenseCategories(userId: string): Promise<void> {
  const db = getDb();
  for (const name of EXPENSE_CATEGORIES) {
    const existing = await db
      .prepare('SELECT id FROM expense_categories WHERE user_id = ? AND name = ?')
      .bind(userId, name)
      .first<{ id: string }>();
    if (!existing) {
      await db
        .prepare(
          `INSERT INTO expense_categories (id, user_id, name, icon, color, is_default, created_at) VALUES (?, ?, ?, ?, NULL, 1, ?)`
        )
        .bind(newId(), userId, name, EXPENSE_CATEGORY_ICONS[name] ?? '📦', nowIso())
        .run();
    }
  }
}

export async function listExpenseCategories(userId: string): Promise<ExpenseCustomCategory[]> {
  await ensureDefaultExpenseCategories(userId);
  const { results } = await getDb()
    .prepare('SELECT * FROM expense_categories WHERE user_id = ? ORDER BY is_default DESC, name')
    .bind(userId)
    .all<ExpenseCustomCategory>();
  return results;
}

export async function addExpenseCategory(
  userId: string, name: string, icon: string, color?: string
): Promise<ExpenseCustomCategory> {
  const db = getDb();
  const id = newId();
  await db
    .prepare(
      `INSERT INTO expense_categories (id, user_id, name, icon, color, is_default, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
    )
    .bind(id, userId, name.trim(), icon, color ?? null, nowIso())
    .run();
  return (await db.prepare('SELECT * FROM expense_categories WHERE id = ?').bind(id).first<ExpenseCustomCategory>())!;
}

export async function deleteExpenseCategory(userId: string, categoryId: string): Promise<void> {
  const db = getDb();
  const cat = await db
    .prepare('SELECT * FROM expense_categories WHERE id = ? AND user_id = ?')
    .bind(categoryId, userId)
    .first<ExpenseCustomCategory>();
  if (!cat) throw new Error('Categoria non trovata');
  if (cat.is_default) throw new Error('Non puoi eliminare una categoria predefinita');
  await db.prepare('DELETE FROM expense_categories WHERE id = ?').bind(categoryId).run();
}

export async function expenseCategoryNames(userId: string): Promise<string[]> {
  const cats = await listExpenseCategories(userId);
  return cats.map((c) => c.name);
}
