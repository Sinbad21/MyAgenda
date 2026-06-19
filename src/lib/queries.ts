import { getDb } from './db';
import { isDue, isUpcoming } from './reminders';
import { daysUntil } from './format';
import { monthTotal, categoryTotals, budgetStatuses } from './expenses';
import { listExpenseCategories, EXPENSE_CATEGORY_ICONS } from './categories';
import type { Category, LogEntry, Reminder, Vehicle } from './types';

export type ReminderBucket = 'overdue' | 'today' | 'week' | 'month' | 'later';

export interface ReminderView extends Reminder {
  category_name: string | null; category_icon: string | null;
  vehicle_name: string | null; vehicle_km: number | null;
  days: number | null; bucket: ReminderBucket;
}

async function bucketOf(r: Reminder): Promise<ReminderBucket> {
  if (await isDue(r)) return 'overdue';
  const d = r.due_date ? daysUntil(r.due_date) : null;
  if (d === null) return 'later';
  if (d <= 0) return 'overdue';
  if (d === 0) return 'today';
  if (d <= 7) return 'week';
  if (d <= 31) return 'month';
  return 'later';
}

export async function pendingReminderViews(userId: string): Promise<ReminderView[]> {
  const { results: rows } = await getDb()
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
    .bind(userId)
    .all<any>();

  return Promise.all(
    rows.map(async (r) => {
      const days = r.due_date ? daysUntil(r.due_date) : null;
      return { ...r, days, bucket: await bucketOf(r as Reminder) } as ReminderView;
    })
  );
}

export interface GroupedReminders {
  overdue: ReminderView[]; today: ReminderView[]; week: ReminderView[]; month: ReminderView[];
}

export async function groupedReminders(userId: string): Promise<GroupedReminders> {
  const all = await pendingReminderViews(userId);
  return {
    overdue: all.filter((r) => r.bucket === 'overdue'),
    today: all.filter((r) => r.bucket === 'today'),
    week: all.filter((r) => r.bucket === 'week'),
    month: all.filter((r) => r.bucket === 'month'),
  };
}

export interface LogView extends LogEntry {
  category_name: string | null; category_icon: string | null;
}

export async function recentLogs(userId: string, limit = 20, categoryId?: string | null): Promise<LogView[]> {
  const db = getDb();
  const sharedClause = `OR l.id IN (SELECT resource_id FROM shares WHERE shared_with_user_id = ? AND resource_type = 'log') OR l.category_id IN (SELECT resource_id FROM shares WHERE shared_with_user_id = ? AND resource_type = 'category')`;
  const sql = categoryId
    ? `SELECT l.*, c.name AS category_name, c.icon AS category_icon FROM logs l LEFT JOIN categories c ON c.id = l.category_id WHERE (l.user_id = ? ${sharedClause}) AND l.category_id = ? ORDER BY l.event_date DESC, l.created_at DESC LIMIT ?`
    : `SELECT l.*, c.name AS category_name, c.icon AS category_icon FROM logs l LEFT JOIN categories c ON c.id = l.category_id WHERE l.user_id = ? ${sharedClause} ORDER BY l.event_date DESC, l.created_at DESC LIMIT ?`;
  const params = categoryId
    ? [userId, userId, userId, categoryId, limit]
    : [userId, userId, userId, limit];
  const { results } = await db.prepare(sql).bind(...params).all<LogView>();
  return results;
}

export interface CategorySummary {
  category: Category; logCount: number; lastEvent: string | null; nextReminder: string | null;
}

export async function categorySummaries(userId: string): Promise<CategorySummary[]> {
  const db = getDb();
  const { results: cats } = await db
    .prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY is_default DESC, name')
    .bind(userId)
    .all<Category>();
  return Promise.all(
    cats.map(async (category) => {
      const logRow = await db
        .prepare('SELECT COUNT(*) AS n, MAX(event_date) AS last FROM logs WHERE user_id = ? AND category_id = ?')
        .bind(userId, category.id)
        .first<{ n: number; last: string | null }>();
      const next = await db
        .prepare(`SELECT MIN(due_date) AS next FROM reminders WHERE user_id = ? AND category_id = ? AND status = 'pending' AND due_date IS NOT NULL`)
        .bind(userId, category.id)
        .first<{ next: string | null }>();
      return { category, logCount: logRow?.n ?? 0, lastEvent: logRow?.last ?? null, nextReminder: next?.next ?? null };
    })
  );
}

export interface ExpenseWidget {
  total: number; prevTotal: number;
  byCategory: { category: string; total: number }[];
  budgets: Awaited<ReturnType<typeof budgetStatuses>>;
}

export async function expenseWidget(userId: string): Promise<ExpenseWidget> {
  const now = new Date();
  const curKey = now.toISOString().slice(0, 7);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
  const totals = await categoryTotals(userId, curKey);
  const cats = await listExpenseCategories(userId);
  const iconMap: Record<string, string> = { ...EXPENSE_CATEGORY_ICONS };
  for (const c of cats) iconMap[c.name] = c.icon;
  return {
    total: await monthTotal(userId, curKey),
    prevTotal: await monthTotal(userId, prev),
    byCategory: cats.map((c) => ({ category: c.name, total: totals[c.name] ?? 0 })).filter((x) => x.total > 0),
    budgets: await budgetStatuses(userId, curKey),
  };
}

export async function listVehicles(userId: string): Promise<Vehicle[]> {
  const { results } = await getDb().prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at').bind(userId).all<Vehicle>();
  return results;
}

export async function listCategories(userId: string): Promise<Category[]> {
  const { results } = await getDb()
    .prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY is_default DESC, name')
    .bind(userId)
    .all<Category>();
  return results;
}
