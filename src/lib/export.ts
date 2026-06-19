import { getDb, newId, nowIso } from './db';
import type { Expense, LogEntry, Reminder } from './types';

function escapeCSV(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(','))].join('\n');
}

export async function exportExpensesCSV(userId: string): Promise<string> {
  const { results } = await getDb()
    .prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC')
    .bind(userId)
    .all<Expense>();
  return toCSV(['id', 'amount', 'category', 'date', 'note', 'created_at'], results as any[]);
}

export async function exportLogsCSV(userId: string): Promise<string> {
  const { results } = await getDb()
    .prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY event_date DESC')
    .bind(userId)
    .all<LogEntry>();
  return toCSV(['id', 'title', 'event_date', 'notes', 'attachment_path', 'created_at'], results as any[]);
}

export async function exportAllJSON(userId: string): Promise<string> {
  const db = getDb();
  const [expRes, logRes, remRes] = await Promise.all([
    db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC').bind(userId).all<Expense>(),
    db.prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY event_date DESC').bind(userId).all<LogEntry>(),
    db.prepare("SELECT * FROM reminders WHERE user_id = ? AND status = 'pending'").bind(userId).all<Reminder>(),
  ]);
  return JSON.stringify({ expenses: expRes.results, logs: logRes.results, reminders: remRes.results }, null, 2);
}

export interface ImportResult { expenses: number; logs: number; errors: string[]; }

export async function importFromJSON(userId: string, raw: string): Promise<ImportResult> {
  const result: ImportResult = { expenses: 0, logs: 0, errors: [] };
  let data: any;
  try { data = JSON.parse(raw); } catch { result.errors.push('JSON non valido'); return result; }
  const db = getDb();

  if (Array.isArray(data.expenses)) {
    for (const e of data.expenses) {
      try {
        const existing = await db.prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?').bind(e.id, userId).first();
        if (existing) continue;
        await db.prepare(`INSERT INTO expenses (id, user_id, log_id, amount, category, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(e.id, userId, e.log_id ?? null, Number(e.amount), e.category ?? 'Altro', e.date, e.note ?? null, e.created_at ?? nowIso()).run();
        result.expenses++;
      } catch (err: any) { result.errors.push(`Spesa ${e.id}: ${err.message}`); }
    }
  }

  if (Array.isArray(data.logs)) {
    for (const l of data.logs) {
      try {
        const existing = await db.prepare('SELECT id FROM logs WHERE id = ? AND user_id = ?').bind(l.id, userId).first();
        if (existing) continue;
        await db.prepare(`INSERT INTO logs (id, user_id, category_id, title, notes, event_date, vehicle_id, km_at_event, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(l.id, userId, l.category_id ?? null, l.title, l.notes ?? null, l.event_date, l.vehicle_id ?? null, l.km_at_event ?? null, l.created_at ?? nowIso()).run();
        result.logs++;
      } catch (err: any) { result.errors.push(`Log ${l.id}: ${err.message}`); }
    }
  }

  return result;
}
