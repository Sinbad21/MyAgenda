import type { CategoryKind } from './knowledge-base';
import { getDb, newId, nowIso } from './db';
import type { ExpenseCustomCategory } from './types';

/** Categorie predefinite con icone (§4). Create per ogni nuovo utente. */
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

/** Categorie di spesa predefinite (§9). */
export const EXPENSE_CATEGORIES = [
  'Alimentari',
  'Trasporti',
  'Salute',
  'Casa',
  'Svago',
  'Altro',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_ICONS: Record<string, string> = {
  Alimentari: '🍎',
  Trasporti: '⛽',
  Salute: '💊',
  Casa: '🏠',
  Svago: '🎉',
  Altro: '📦',
};

// ── DB-backed expense categories ──────────────────────────────────────────

/** Ensures default expense categories exist in the DB for a user. */
export function ensureDefaultExpenseCategories(userId: string): void {
  const db = getDb();
  for (const name of EXPENSE_CATEGORIES) {
    const existing = db
      .prepare('SELECT id FROM expense_categories WHERE user_id = ? AND name = ?')
      .get(userId, name);
    if (!existing) {
      db.prepare(
        `INSERT INTO expense_categories (id, user_id, name, icon, color, is_default, created_at) VALUES (?, ?, ?, ?, NULL, 1, ?)`
      ).run(newId(), userId, name, EXPENSE_CATEGORY_ICONS[name] ?? '📦', nowIso());
    }
  }
}

/** Returns all expense categories for a user (defaults + custom), sorted. */
export function listExpenseCategories(userId: string): ExpenseCustomCategory[] {
  ensureDefaultExpenseCategories(userId);
  return getDb()
    .prepare('SELECT * FROM expense_categories WHERE user_id = ? ORDER BY is_default DESC, name')
    .all(userId) as ExpenseCustomCategory[];
}

export function addExpenseCategory(userId: string, name: string, icon: string, color?: string): ExpenseCustomCategory {
  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO expense_categories (id, user_id, name, icon, color, is_default, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(id, userId, name.trim(), icon, color ?? null, nowIso());
  return db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as ExpenseCustomCategory;
}

export function deleteExpenseCategory(userId: string, categoryId: string): void {
  const db = getDb();
  const cat = db
    .prepare('SELECT * FROM expense_categories WHERE id = ? AND user_id = ?')
    .get(categoryId, userId) as ExpenseCustomCategory | undefined;
  if (!cat) throw new Error('Categoria non trovata');
  if (cat.is_default) throw new Error('Non puoi eliminare una categoria predefinita');
  db.prepare('DELETE FROM expense_categories WHERE id = ?').run(categoryId);
}

/** Returns all category names (for validation): defaults + user-defined. */
export function expenseCategoryNames(userId: string): string[] {
  return listExpenseCategories(userId).map((c) => c.name);
}
