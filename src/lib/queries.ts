import { getDb } from './db';
import { isDue } from './reminders';
import { daysUntil } from './format';
import { monthTotal, categoryTotals, budgetStatuses } from './expenses';
import { listExpenseCategories, EXPENSE_CATEGORY_ICONS } from './categories';
import type { Category, LogEntry, Reminder, Vehicle } from './types';

export type ReminderBucket = 'overdue' | 'today' | 'week' | 'month' | 'later';

export interface ReminderView extends Reminder {
  category_name: string | null;
  category_icon: string | null;
  vehicle_name: string | null;
  vehicle_km: number | null;
  days: number | null;
  bucket: ReminderBucket;
}

function bucketOf(r: Reminder, db = getDb()): ReminderBucket {
  if (isDue(r, db)) return 'overdue';
  const d = r.due_date ? daysUntil(r.due_date) : null;
  if (d === null) return 'later';
  if (d <= 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= 7) return 'week';
  if (d <= 31) return 'month';
  return 'later';
}

export function pendingReminderViews(userId: string): ReminderView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.*, c.name AS category_name, c.icon AS category_icon,
              v.name AS vehicle_name, v.current_km AS vehicle_km
       FROM reminders r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       WHERE r.user_id = ? AND r.status = 'pending'
         AND (r.snoozed_until IS NULL OR r.snoozed_until <= date('now'))
       ORDER BY (r.due_date IS NULL), r.due_date ASC`
    )
    .all(userId) as any[];

  return rows.map((r) => {
    const days = r.due_date ? daysUntil(r.due_date) : null;
    const reminder: Reminder = r;
    return { ...r, days, bucket: bucketOf(reminder, db) } as ReminderView;
  });
}

export interface GroupedReminders {
  overdue: ReminderView[];
  today: ReminderView[];
  week: ReminderView[];
  month: ReminderView[];
}

export function groupedReminders(userId: string): GroupedReminders {
  const all = pendingReminderViews(userId);
  return {
    overdue: all.filter((r) => r.bucket === 'overdue'),
    today: all.filter((r) => r.bucket === 'today'),
    week: all.filter((r) => r.bucket === 'week'),
    month: all.filter((r) => r.bucket === 'month'),
  };
}

export interface LogView extends LogEntry {
  category_name: string | null;
  category_icon: string | null;
}

export function recentLogs(userId: string, limit = 20, categoryId?: string | null): LogView[] {
  const db = getDb();

  // Include logs shared with this user by others
  const sharedClause = `
    OR l.id IN (
      SELECT resource_id FROM shares
      WHERE shared_with_user_id = ? AND resource_type = 'log'
    )
    OR l.category_id IN (
      SELECT resource_id FROM shares
      WHERE shared_with_user_id = ? AND resource_type = 'category'
    )
  `;

  if (categoryId) {
    return db
      .prepare(
        `SELECT l.*, c.name AS category_name, c.icon AS category_icon
         FROM logs l LEFT JOIN categories c ON c.id = l.category_id
         WHERE (l.user_id = ? ${sharedClause}) AND l.category_id = ?
         ORDER BY l.event_date DESC, l.created_at DESC LIMIT ?`
      )
      .all(userId, userId, userId, categoryId, limit) as LogView[];
  }
  return db
    .prepare(
      `SELECT l.*, c.name AS category_name, c.icon AS category_icon
       FROM logs l LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.user_id = ? ${sharedClause}
       ORDER BY l.event_date DESC, l.created_at DESC LIMIT ?`
    )
    .all(userId, userId, userId, limit) as LogView[];
}

export interface CategorySummary {
  category: Category;
  logCount: number;
  lastEvent: string | null;
  nextReminder: string | null;
}

export function categorySummaries(userId: string): CategorySummary[] {
  const db = getDb();
  const cats = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY is_default DESC, name').all(userId) as Category[];
  return cats.map((category) => {
    const logRow = db
      .prepare('SELECT COUNT(*) AS n, MAX(event_date) AS last FROM logs WHERE user_id = ? AND category_id = ?')
      .get(userId, category.id) as { n: number; last: string | null };
    const next = db
      .prepare(
        `SELECT MIN(due_date) AS next FROM reminders
         WHERE user_id = ? AND category_id = ? AND status = 'pending' AND due_date IS NOT NULL`
      )
      .get(userId, category.id) as { next: string | null };
    return { category, logCount: logRow.n, lastEvent: logRow.last, nextReminder: next.next };
  });
}

export interface ExpenseWidget {
  total: number;
  prevTotal: number;
  byCategory: { category: string; total: number }[];
  budgets: ReturnType<typeof budgetStatuses>;
}

export function expenseWidget(userId: string): ExpenseWidget {
  const now = new Date();
  const curKey = now.toISOString().slice(0, 7);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
  const totals = categoryTotals(userId, curKey);
  const cats = listExpenseCategories(userId);
  const iconMap: Record<string, string> = { ...EXPENSE_CATEGORY_ICONS };
  for (const c of cats) iconMap[c.name] = c.icon;
  return {
    total: monthTotal(userId, curKey),
    prevTotal: monthTotal(userId, prev),
    byCategory: cats.map((c) => ({ category: c.name, total: totals[c.name] ?? 0 })).filter((x) => x.total > 0),
    budgets: budgetStatuses(userId, curKey),
  };
}

export function listVehicles(userId: string): Vehicle[] {
  return getDb().prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at').all(userId) as Vehicle[];
}

export function listCategories(userId: string): Category[] {
  return getDb()
    .prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY is_default DESC, name')
    .all(userId) as Category[];
}
