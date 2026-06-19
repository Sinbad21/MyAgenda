import { getDb } from './db';
import type { Expense, LogEntry, Reminder } from './types';

// ── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCSV(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCSV(row[h])).join(','));
  }
  return lines.join('\n');
}

// ── Export ───────────────────────────────────────────────────────────────────

export function exportExpensesCSV(userId: string): string {
  const rows = getDb()
    .prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC')
    .all(userId) as Expense[];
  return toCSV(['id', 'amount', 'category', 'date', 'note', 'created_at'], rows);
}

export function exportLogsCSV(userId: string): string {
  const rows = getDb()
    .prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY event_date DESC')
    .all(userId) as LogEntry[];
  return toCSV(['id', 'title', 'event_date', 'notes', 'attachment_path', 'created_at'], rows);
}

export function exportAllJSON(userId: string): string {
  const db = getDb();
  const expenses = db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC').all(userId) as Expense[];
  const logs = db.prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY event_date DESC').all(userId) as LogEntry[];
  const reminders = db
    .prepare("SELECT * FROM reminders WHERE user_id = ? AND status = 'pending'")
    .all(userId) as Reminder[];
  return JSON.stringify({ expenses, logs, reminders }, null, 2);
}

// ── Import ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  expenses: number;
  logs: number;
  errors: string[];
}

export function importFromJSON(userId: string, raw: string): ImportResult {
  const result: ImportResult = { expenses: 0, logs: 0, errors: [] };
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    result.errors.push('JSON non valido');
    return result;
  }

  const db = getDb();

  if (Array.isArray(data.expenses)) {
    for (const e of data.expenses) {
      try {
        const existing = db.prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?').get(e.id, userId);
        if (existing) continue; // Skip duplicates
        db.prepare(
          `INSERT INTO expenses (id, user_id, log_id, amount, category, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(e.id, userId, e.log_id ?? null, Number(e.amount), e.category ?? 'Altro', e.date, e.note ?? null, e.created_at ?? new Date().toISOString());
        result.expenses++;
      } catch (err: any) {
        result.errors.push(`Spesa ${e.id}: ${err.message}`);
      }
    }
  }

  if (Array.isArray(data.logs)) {
    for (const l of data.logs) {
      try {
        const existing = db.prepare('SELECT id FROM logs WHERE id = ? AND user_id = ?').get(l.id, userId);
        if (existing) continue;
        db.prepare(
          `INSERT INTO logs (id, user_id, category_id, title, notes, event_date, vehicle_id, km_at_event, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(l.id, userId, l.category_id ?? null, l.title, l.notes ?? null, l.event_date, l.vehicle_id ?? null, l.km_at_event ?? null, l.created_at ?? new Date().toISOString());
        result.logs++;
      } catch (err: any) {
        result.errors.push(`Log ${l.id}: ${err.message}`);
      }
    }
  }

  return result;
}
