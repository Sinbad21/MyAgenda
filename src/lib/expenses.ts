import { getDb, newId, nowIso } from './db';
import { monthStart, todayIso } from './format';
import { EXPENSE_CATEGORIES } from './categories';
import type { Budget, Expense } from './types';

export interface AddExpenseInput {
  userId: string;
  amount: number;
  category: string;
  date?: string;
  note?: string | null;
  logId?: string | null;
}

export function addExpense(input: AddExpenseInput): Expense {
  const db = getDb();
  const id = newId();
  const category = EXPENSE_CATEGORIES.includes(input.category as any) ? input.category : 'Altro';
  db.prepare(
    `INSERT INTO expenses (id, user_id, log_id, amount, category, date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.userId, input.logId ?? null, input.amount, category, input.date ?? todayIso(), input.note ?? null, nowIso());
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense;
}

/** Inizio mese ISO per un dato mese (default: corrente). monthKey = 'yyyy-MM'. */
function monthRange(monthKey?: string): { start: string; end: string } {
  const start = monthKey ? `${monthKey}-01` : monthStart();
  const d = new Date(start + 'T00:00:00');
  const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end: endDate.toISOString().slice(0, 10) };
}

export function monthTotal(userId: string, monthKey?: string): number {
  const { start, end } = monthRange(monthKey);
  const row = getDb()
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND date >= ? AND date < ?`)
    .get(userId, start, end) as { total: number };
  return row.total;
}

export function categoryTotals(userId: string, monthKey?: string): Record<string, number> {
  const { start, end } = monthRange(monthKey);
  const rows = getDb()
    .prepare(
      `SELECT category, COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE user_id = ? AND date >= ? AND date < ? GROUP BY category`
    )
    .all(userId, start, end) as { category: string; total: number }[];
  const out: Record<string, number> = {};
  for (const c of EXPENSE_CATEGORIES) out[c] = 0;
  for (const r of rows) out[r.category] = r.total;
  return out;
}

export function listExpenses(userId: string, monthKey?: string): Expense[] {
  const { start, end } = monthRange(monthKey);
  return getDb()
    .prepare(`SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date < ? ORDER BY date DESC, created_at DESC`)
    .all(userId, start, end) as Expense[];
}

/** Andamento giornaliero del mese: [{day, total}]. */
export function dailyTotals(userId: string, monthKey?: string): { day: string; total: number }[] {
  const { start, end } = monthRange(monthKey);
  return getDb()
    .prepare(
      `SELECT date AS day, COALESCE(SUM(amount),0) AS total FROM expenses
       WHERE user_id = ? AND date >= ? AND date < ? GROUP BY date ORDER BY date`
    )
    .all(userId, start, end) as { day: string; total: number }[];
}

export function getBudgets(userId: string): Budget[] {
  return getDb().prepare('SELECT * FROM budgets WHERE user_id = ?').all(userId) as Budget[];
}

export function setBudget(userId: string, category: string, monthlyLimit: number): void {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM budgets WHERE user_id = ? AND category = ?').get(userId, category) as
    | { id: string }
    | undefined;
  if (existing) {
    db.prepare('UPDATE budgets SET monthly_limit = ? WHERE id = ?').run(monthlyLimit, existing.id);
  } else {
    db.prepare('INSERT INTO budgets (id, user_id, category, monthly_limit) VALUES (?, ?, ?, ?)').run(
      newId(), userId, category, monthlyLimit
    );
  }
}

export interface BudgetStatus {
  category: string;
  limit: number;
  spent: number;
  pct: number;
  level: 'ok' | 'warn' | 'over';
}

export function budgetStatuses(userId: string, monthKey?: string): BudgetStatus[] {
  const budgets = getBudgets(userId);
  const totals = categoryTotals(userId, monthKey);
  return budgets.map((b) => {
    const spent = totals[b.category] ?? 0;
    const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
    const level: BudgetStatus['level'] = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'ok';
    return { category: b.category, limit: b.monthly_limit, spent, pct, level };
  });
}

/** Confronto col mese precedente per una categoria (per insight). */
export function compareWithPreviousMonth(
  userId: string,
  category: string
): { current: number; previous: number; deltaPct: number | null } {
  const now = new Date();
  const curKey = now.toISOString().slice(0, 7);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = prev.toISOString().slice(0, 7);
  const current = categoryTotals(userId, curKey)[category] ?? 0;
  const previous = categoryTotals(userId, prevKey)[category] ?? 0;
  const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : null;
  return { current, previous, deltaPct };
}
