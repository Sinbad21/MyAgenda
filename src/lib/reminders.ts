import { getDb, newId, nowIso } from './db';
import { addMonthsIso, daysUntil, todayIso } from './format';
import type { Reminder, Vehicle } from './types';

const DEFAULT_KM_INTERVAL = 15000;

export interface CreateReminderInput {
  userId: string; logId?: string | null; categoryId?: string | null; title: string;
  triggerType?: 'time' | 'km'; dueDate?: string | null; dueTime?: string | null; dueKm?: number | null;
  vehicleId?: string | null; intervalMonths?: number | null; recurring?: boolean; advanceDays?: number;
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const db = getDb();
  const id = newId();
  await db
    .prepare(
      `INSERT INTO reminders
        (id, user_id, log_id, category_id, title, trigger_type, due_date, due_time, due_km,
         vehicle_id, interval_months, recurring, advance_days, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(id, input.userId, input.logId ?? null, input.categoryId ?? null, input.title,
          input.triggerType ?? 'time', input.dueDate ?? null, input.dueTime ?? null, input.dueKm ?? null,
          input.vehicleId ?? null, input.intervalMonths ?? null,
          input.recurring ? 1 : 0, input.advanceDays ?? 7, nowIso())
    .run();
  return (await db.prepare('SELECT * FROM reminders WHERE id = ?').bind(id).first<Reminder>())!;
}

export async function isDue(reminder: Reminder): Promise<boolean> {
  if (reminder.status !== 'pending') return false;
  if (reminder.due_date && reminder.due_date.slice(0, 10) <= todayIso()) return true;
  if (reminder.due_km != null && reminder.vehicle_id) {
    const v = await getDb()
      .prepare('SELECT current_km FROM vehicles WHERE id = ?')
      .bind(reminder.vehicle_id)
      .first<{ current_km: number }>();
    if (v && v.current_km >= reminder.due_km) return true;
  }
  return false;
}

export function isUpcoming(reminder: Reminder): boolean {
  if (reminder.status !== 'pending' || !reminder.due_date) return false;
  const d = daysUntil(reminder.due_date);
  return d !== null && d > 0 && d <= reminder.advance_days;
}

export interface CompleteResult {
  reminder: Reminder; newLogId: string; nextReminder: Reminder | null;
}

export async function completeReminder(userId: string, reminderId: string, note?: string): Promise<CompleteResult> {
  const db = getDb();
  const reminder = await db
    .prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?')
    .bind(reminderId, userId)
    .first<Reminder>();
  if (!reminder) throw new Error('Reminder non trovato');
  const today = todayIso();
  const vehicle = reminder.vehicle_id
    ? await db.prepare('SELECT * FROM vehicles WHERE id = ?').bind(reminder.vehicle_id).first<Vehicle>()
    : null;

  await db.prepare(`UPDATE reminders SET status = 'done', completed_at = ? WHERE id = ?`).bind(nowIso(), reminder.id).run();

  const logId = newId();
  const noteText = note ?? `${reminder.title} eseguito il ${today}.`;
  await db
    .prepare(
      `INSERT INTO logs (id, user_id, category_id, title, notes, event_date, vehicle_id, km_at_event, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(logId, userId, reminder.category_id, `${reminder.title} eseguito`, noteText,
          today, reminder.vehicle_id, vehicle ? vehicle.current_km : null, nowIso())
    .run();

  let nextReminder: Reminder | null = null;
  if (reminder.recurring) {
    let nextDueDate: string | null = null;
    let nextDueKm: number | null = null;
    if (reminder.interval_months) nextDueDate = addMonthsIso(today, reminder.interval_months);
    if (reminder.due_km != null && vehicle) {
      let step = DEFAULT_KM_INTERVAL;
      if (reminder.log_id) {
        const log = await db.prepare('SELECT km_at_event FROM logs WHERE id = ?').bind(reminder.log_id).first<{ km_at_event: number | null }>();
        if (log?.km_at_event != null && reminder.due_km > log.km_at_event) step = reminder.due_km - log.km_at_event;
      }
      nextDueKm = vehicle.current_km + step;
    }
    if (nextDueDate || nextDueKm != null) {
      const nid = newId();
      await db
        .prepare(
          `INSERT INTO reminders
            (id, user_id, log_id, category_id, title, trigger_type, due_date, due_km,
             vehicle_id, interval_months, recurring, advance_days, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'pending', ?)`
        )
        .bind(nid, userId, logId, reminder.category_id, reminder.title, reminder.trigger_type,
              nextDueDate, nextDueKm, reminder.vehicle_id, reminder.interval_months,
              reminder.advance_days, nowIso())
        .run();
      nextReminder = await db.prepare('SELECT * FROM reminders WHERE id = ?').bind(nid).first<Reminder>() ?? null;
    }
  }

  const updated = (await db.prepare('SELECT * FROM reminders WHERE id = ?').bind(reminder.id).first<Reminder>())!;
  return { reminder: updated, newLogId: logId, nextReminder };
}

export async function snoozeReminder(userId: string, reminderId: string, days: number): Promise<Reminder> {
  const db = getDb();
  const reminder = await db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').bind(reminderId, userId).first<Reminder>();
  if (!reminder) throw new Error('Reminder non trovato');
  const snoozeDate = new Date();
  snoozeDate.setDate(snoozeDate.getDate() + days);
  const snoozedUntil = snoozeDate.toISOString().slice(0, 10);
  await db.prepare(`UPDATE reminders SET snoozed_until = ?, notified_at = NULL WHERE id = ?`).bind(snoozedUntil, reminderId).run();
  return (await db.prepare('SELECT * FROM reminders WHERE id = ?').bind(reminderId).first<Reminder>())!;
}

export async function updateReminder(
  userId: string, reminderId: string,
  patch: Partial<Pick<Reminder, 'title' | 'due_date' | 'due_km' | 'advance_days' | 'recurring'>>
): Promise<Reminder> {
  const db = getDb();
  const reminder = await db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').bind(reminderId, userId).first<Reminder>();
  if (!reminder) throw new Error('Reminder non trovato');
  await db
    .prepare(`UPDATE reminders SET title = ?, due_date = ?, due_km = ?, advance_days = ?, recurring = ? WHERE id = ?`)
    .bind(
      patch.title ?? reminder.title,
      patch.due_date !== undefined ? patch.due_date : reminder.due_date,
      patch.due_km !== undefined ? patch.due_km : reminder.due_km,
      patch.advance_days ?? reminder.advance_days,
      patch.recurring !== undefined ? (patch.recurring ? 1 : 0) : reminder.recurring,
      reminderId
    )
    .run();
  return (await db.prepare('SELECT * FROM reminders WHERE id = ?').bind(reminderId).first<Reminder>())!;
}

export async function stopRecurrence(userId: string, reminderId: string): Promise<void> {
  await getDb().prepare(`UPDATE reminders SET recurring = 0 WHERE id = ? AND user_id = ?`).bind(reminderId, userId).run();
}

export async function cancelReminder(userId: string, reminderId: string): Promise<void> {
  await getDb().prepare(`UPDATE reminders SET status = 'cancelled' WHERE id = ? AND user_id = ?`).bind(reminderId, userId).run();
}
