import { getDb, newId, nowIso } from './db';
import { monthStart, todayIso } from './format';
import { expenseCategoryNames } from './categories';
import type { Budget, Expense, RecurringExpense } from './types';

export interface AddExpenseInput {
  userId: string;
  amount: number;
  category: string;
  date?: string;
  note?: string | null;
  logId?: string | null;
}

export async function addExpense(input: AddExpenseInput): Promise<Expense> {
  const db = getDb();
  const id = newId();
  const validNames = await expenseCategoryNames(input.userId);
  const category = validNames.includes(input.category) ? input.category : 'Altro';
  await db
    .prepare(
      `INSERT INTO expenses (id, user_id, log_id, amount, category, date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, input.userId, input.logId ?? null, input.amount, category,
          input.date ?? todayIso(), input.note ?? null, nowIso())
    .run();
  return (await db.prepare('SELECT * FROM expenses WHERE id = ?').bind(id).first<Expense>())!;
}

function monthRange(monthKey?: string): { start: string; end: string } {
  const start = monthKey ? `${monthKey}-01` : monthStart();
  const d = new Date(start + 'T00:00:00');
  const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end: endDate.toISOString().slice(0, 10) };
}

export async function monthTotal(userId: string, monthKey?: string): Promise<number> {
  const { start, end } = monthRange(monthKey);
  const row = await getDb()
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND date >= ? AND date < ?`)
    .bind(userId, start, end)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

export async function categoryTotals(userId: string, monthKey?: string): Promise<Record<string, number>> {
  const { start, end } = monthRange(monthKey);
  const { results: rows } = await getDb()
    .prepare(
      `SELECT category, COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE user_id = ? AND date >= ? AND date < ? GROUP BY category`
    )
    .bind(userId, start, end)
    .all<{ category: string; total: number }>();
  const out: Record<string, number> = {};
  for (const c of await expenseCategoryNames(userId)) out[c] = 0;
  for (const r of rows) out[r.category] = r.total;
  return out;
}

export async function listExpenses(userId: string, monthKey?: string): Promise<Expense[]> {
  const { start, end } = monthRange(monthKey);
  const { results } = await getDb()
    .prepare(`SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date < ? ORDER BY date DESC, created_at DESC`)
    .bind(userId, start, end)
    .all<Expense>();
  return results;
}

export async function dailyTotals(userId: string, monthKey?: string): Promise<{ day: string; total: number }[]> {
  const { start, end } = monthRange(monthKey);
  const { results } = await getDb()
    .prepare(
      `SELECT date AS day, COALESCE(SUM(amount),0) AS total FROM expenses
       WHERE user_id = ? AND date >= ? AND date < ? GROUP BY date ORDER BY date`
    )
    .bind(userId, start, end)
    .all<{ day: string; total: number }>();
  return results;
}

export async function getBudgets(userId: string): Promise<Budget[]> {
  const { results } = await getDb().prepare('SELECT * FROM budgets WHERE user_id = ?').bind(userId).all<Budget>();
  return results;
}

export async function setBudget(userId: string, category: string, monthlyLimit: number): Promise<void> {
  const db = getDb();
  const existing = await db
    .prepare('SELECT id FROM budgets WHERE user_id = ? AND category = ?')
    .bind(userId, category)
    .first<{ id: string }>();
  if (existing) {
    await db.prepare('UPDATE budgets SET monthly_limit = ? WHERE id = ?').bind(monthlyLimit, existing.id).run();
  } else {
    await db
      .prepare('INSERT INTO budgets (id, user_id, category, monthly_limit) VALUES (?, ?, ?, ?)')
      .bind(newId(), userId, category, monthlyLimit)
      .run();
  }
}

export interface BudgetStatus {
  category: string;
  limit: number;
  spent: number;
  pct: number;
  level: 'ok' | 'warn' | 'over';
}

export async function budgetStatuses(userId: string, monthKey?: string): Promise<BudgetStatus[]> {
  const budgets = await getBudgets(userId);
  const totals = await categoryTotals(userId, monthKey);
  return budgets.map((b) => {
    const spent = totals[b.category] ?? 0;
    const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
    const level: BudgetStatus['level'] = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : 'ok';
    return { category: b.category, limit: b.monthly_limit, spent, pct, level };
  });
}

export async function compareWithPreviousMonth(
  userId: string, category: string
): Promise<{ current: number; previous: number; deltaPct: number | null }> {
  const now = new Date();
  const curKey = now.toISOString().slice(0, 7);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = prev.toISOString().slice(0, 7);
  const current = (await categoryTotals(userId, curKey))[category] ?? 0;
  const previous = (await categoryTotals(userId, prevKey))[category] ?? 0;
  const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : null;
  return { current, previous, deltaPct };
}

export async function updateExpense(
  userId: string, id: string,
  patch: Partial<Pick<Expense, 'amount' | 'category' | 'date' | 'note'>>
): Promise<Expense> {
  const db = getDb();
  const expense = await db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').bind(id, userId).first<Expense>();
  if (!expense) throw new Error('Spesa non trovata');
  const validNames = await expenseCategoryNames(userId);
  const category = patch.category
    ? (validNames.includes(patch.category) ? patch.category : expense.category)
    : expense.category;
  await db
    .prepare(`UPDATE expenses SET amount = ?, category = ?, date = ?, note = ? WHERE id = ?`)
    .bind(patch.amount ?? expense.amount, category, patch.date ?? expense.date,
          patch.note !== undefined ? patch.note : expense.note, id)
    .run();
  return (await db.prepare('SELECT * FROM expenses WHERE id = ?').bind(id).first<Expense>())!;
}

export async function deleteExpense(userId: string, id: string): Promise<void> {
  const db = getDb();
  const expense = await db.prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!expense) throw new Error('Spesa non trovata');
  await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run();
}

export async function multiMonthTotals(userId: string, months = 6): Promise<{ month: string; total: number }[]> {
  const now = new Date();
  const result: { month: string; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    result.push({ month: key, total: await monthTotal(userId, key) });
  }
  return result;
}

export async function listRecurring(userId: string): Promise<RecurringExpense[]> {
  const { results } = await getDb()
    .prepare('SELECT * FROM recurring_expenses WHERE user_id = ? ORDER BY created_at')
    .bind(userId)
    .all<RecurringExpense>();
  return results;
}

export interface AddRecurringInput {
  userId: string; label: string; amount: number; category: string; dayOfMonth?: number;
}

export async function addRecurring(input: AddRecurringInput): Promise<RecurringExpense> {
  const db = getDb();
  const id = newId();
  const validNames = await expenseCategoryNames(input.userId);
  const category = validNames.includes(input.category) ? input.category : 'Altro';
  const day = Math.max(1, Math.min(28, input.dayOfMonth ?? 1));
  await db
    .prepare(
      `INSERT INTO recurring_expenses (id, user_id, label, amount, category, day_of_month, active, last_inserted, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?)`
    )
    .bind(id, input.userId, input.label.trim(), input.amount, category, day, nowIso())
    .run();
  return (await db.prepare('SELECT * FROM recurring_expenses WHERE id = ?').bind(id).first<RecurringExpense>())!;
}

export async function toggleRecurring(userId: string, id: string, active: boolean): Promise<void> {
  await getDb()
    .prepare('UPDATE recurring_expenses SET active = ? WHERE id = ? AND user_id = ?')
    .bind(active ? 1 : 0, id, userId)
    .run();
}

export async function deleteRecurring(userId: string, id: string): Promise<void> {
  await getDb()
    .prepare('DELETE FROM recurring_expenses WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
}

export async function processRecurringExpenses(): Promise<{ inserted: number }> {
  const db = getDb();
  const today = todayIso();
  const { results: recurring } = await db
    .prepare(`SELECT * FROM recurring_expenses WHERE active = 1`)
    .all<RecurringExpense>();
  let inserted = 0;
  for (const r of recurring) {
    const d = new Date(today + 'T00:00:00');
    if (d.getDate() !== r.day_of_month) continue;
    const monthKey = today.slice(0, 7);
    if (r.last_inserted && r.last_inserted.startsWith(monthKey)) continue;
    await addExpense({ userId: r.user_id, amount: r.amount, category: r.category, date: today, note: r.label });
    await db
      .prepare('UPDATE recurring_expenses SET last_inserted = ? WHERE id = ?')
      .bind(today, r.id)
      .run();
    inserted++;
  }
  return { inserted };
}
