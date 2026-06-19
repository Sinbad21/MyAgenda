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

export function addExpense(input: AddExpenseInput): Expense {
  const db = getDb();
  const id = newId();
  // Accept any category name: validate against DB categories (defaults + custom)
  const validNames = expenseCategoryNames(input.userId);
  const category = validNames.includes(input.category) ? input.category : 'Altro';
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

// ── CRUD helpers ────────────────────────────────────────────────────────────

export function updateExpense(
  userId: string,
  id: string,
  patch: Partial<Pick<Expense, 'amount' | 'category' | 'date' | 'note'>>
): Expense {
  const db = getDb();
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(id, userId) as Expense | undefined;
  if (!expense) throw new Error('Spesa non trovata');
  const validNames = expenseCategoryNames(userId);
  const category = patch.category ? (validNames.includes(patch.category) ? patch.category : expense.category) : expense.category;
  db.prepare(`UPDATE expenses SET amount = ?, category = ?, date = ?, note = ? WHERE id = ?`).run(
    patch.amount ?? expense.amount,
    category,
    patch.date ?? expense.date,
    patch.note !== undefined ? patch.note : expense.note,
    id
  );
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense;
}

export function deleteExpense(userId: string, id: string): void {
  const db = getDb();
  const expense = db.prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?').get(id, userId);
  if (!expense) throw new Error('Spesa non trovata');
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
}

// ── Multi-month trend ────────────────────────────────────────────────────────

/** Totali mensili per gli ultimi `months` mesi. */
export function multiMonthTotals(
  userId: string,
  months = 6
): { month: string; total: number }[] {
  const now = new Date();
  const result: { month: string; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    result.push({ month: key, total: monthTotal(userId, key) });
  }
  return result;
}

// ── Recurring expenses ────────────────────────────────────────────────────────

export function listRecurring(userId: string): RecurringExpense[] {
  return getDb()
    .prepare('SELECT * FROM recurring_expenses WHERE user_id = ? ORDER BY created_at')
    .all(userId) as RecurringExpense[];
}

export interface AddRecurringInput {
  userId: string;
  label: string;
  amount: number;
  category: string;
  dayOfMonth?: number;
}

export function addRecurring(input: AddRecurringInput): RecurringExpense {
  const db = getDb();
  const id = newId();
  const validNames = expenseCategoryNames(input.userId);
  const category = validNames.includes(input.category) ? input.category : 'Altro';
  const day = Math.max(1, Math.min(28, input.dayOfMonth ?? 1));
  db.prepare(
    `INSERT INTO recurring_expenses (id, user_id, label, amount, category, day_of_month, active, last_inserted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?)`
  ).run(id, input.userId, input.label.trim(), input.amount, category, day, nowIso());
  return db.prepare('SELECT * FROM recurring_expenses WHERE id = ?').get(id) as RecurringExpense;
}

export function toggleRecurring(userId: string, id: string): RecurringExpense {
  const db = getDb();
  const rec = db.prepare('SELECT * FROM recurring_expenses WHERE id = ? AND user_id = ?').get(id, userId) as RecurringExpense | undefined;
  if (!rec) throw new Error('Spesa ricorrente non trovata');
  db.prepare('UPDATE recurring_expenses SET active = ? WHERE id = ?').run(rec.active ? 0 : 1, id);
  return db.prepare('SELECT * FROM recurring_expenses WHERE id = ?').get(id) as RecurringExpense;
}

export function deleteRecurring(userId: string, id: string): void {
  const db = getDb();
  const rec = db.prepare('SELECT id FROM recurring_expenses WHERE id = ? AND user_id = ?').get(id, userId);
  if (!rec) throw new Error('Spesa ricorrente non trovata');
  db.prepare('DELETE FROM recurring_expenses WHERE id = ?').run(id);
}

/**
 * Auto-inserts recurring expenses for the current month.
 * Called from the cron job. Idempotent: won't double-insert for the same month.
 */
export function processRecurringExpenses(): { inserted: number } {
  const db = getDb();
  const today = new Date();
  const monthKey = today.toISOString().slice(0, 7);
  const dayOfMonth = today.getDate();

  const recs = db
    .prepare(`SELECT re.*, u.id AS uid FROM recurring_expenses re JOIN users u ON u.id = re.user_id WHERE re.active = 1`)
    .all() as (RecurringExpense & { uid: string })[];

  let inserted = 0;
  for (const r of recs) {
    // Only insert on or after the scheduled day of month
    if (dayOfMonth < r.day_of_month) continue;
    // Don't re-insert if already done this month
    if (r.last_inserted && r.last_inserted.startsWith(monthKey)) continue;

    const date = `${monthKey}-${String(r.day_of_month).padStart(2, '0')}`;
    db.prepare(
      `INSERT INTO expenses (id, user_id, log_id, amount, category, date, note, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
    ).run(newId(), r.user_id, r.amount, r.category, date, `${r.label} (automatico)`, nowIso());

    db.prepare('UPDATE recurring_expenses SET last_inserted = ? WHERE id = ?').run(monthKey, r.id);
    inserted++;
  }
  return { inserted };
}
