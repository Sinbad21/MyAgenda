import type Database from 'better-sqlite3';
import { getDb, newId, nowIso } from './db';
import { addMonthsIso, daysUntil, todayIso } from './format';
import type { Reminder, Vehicle } from './types';

const DEFAULT_KM_INTERVAL = 15000;

export interface CreateReminderInput {
  userId: string;
  logId?: string | null;
  categoryId?: string | null;
  title: string;
  triggerType?: 'time' | 'km';
  dueDate?: string | null;
  dueKm?: number | null;
  vehicleId?: string | null;
  intervalMonths?: number | null;
  recurring?: boolean;
  advanceDays?: number;
}

export function createReminder(input: CreateReminderInput): Reminder {
  const db = getDb();
  const id = newId();
  db.prepare(
    `INSERT INTO reminders
      (id, user_id, log_id, category_id, title, trigger_type, due_date, due_km,
       vehicle_id, interval_months, recurring, advance_days, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    id,
    input.userId,
    input.logId ?? null,
    input.categoryId ?? null,
    input.title,
    input.triggerType ?? 'time',
    input.dueDate ?? null,
    input.dueKm ?? null,
    input.vehicleId ?? null,
    input.intervalMonths ?? null,
    input.recurring ? 1 : 0,
    input.advanceDays ?? 7,
    nowIso()
  );
  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as Reminder;
}

function getVehicle(db: Database.Database, id: string | null): Vehicle | null {
  if (!id) return null;
  return (db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle) ?? null;
}

/**
 * Un reminder è "scaduto/da gestire" se è soddisfatta la PRIMA condizione
 * tra tempo (due_date <= oggi) e chilometraggio (km veicolo >= due_km).
 */
export function isDue(reminder: Reminder, db = getDb()): boolean {
  if (reminder.status !== 'pending') return false;
  if (reminder.due_date && reminder.due_date.slice(0, 10) <= todayIso()) return true;
  if (reminder.due_km != null) {
    const v = getVehicle(db, reminder.vehicle_id);
    if (v && v.current_km >= reminder.due_km) return true;
  }
  return false;
}

/** È "in scadenza" entro `advance_days` giorni (solo trigger temporale). */
export function isUpcoming(reminder: Reminder): boolean {
  if (reminder.status !== 'pending' || !reminder.due_date) return false;
  const d = daysUntil(reminder.due_date);
  return d !== null && d > 0 && d <= reminder.advance_days;
}

export interface CompleteResult {
  reminder: Reminder;
  newLogId: string;
  nextReminder: Reminder | null;
}

/**
 * Completamento reminder (§2D):
 *  1. marca il reminder come completato;
 *  2. crea automaticamente un nuovo log con la data di oggi;
 *  3. se ricorrente, schedula il successivo dalla data di completamento.
 */
export function completeReminder(userId: string, reminderId: string, note?: string): CompleteResult {
  const db = getDb();
  const reminder = db
    .prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?')
    .get(reminderId, userId) as Reminder | undefined;
  if (!reminder) throw new Error('Reminder non trovato');

  const today = todayIso();
  const vehicle = getVehicle(db, reminder.vehicle_id);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE reminders SET status = 'done', completed_at = ? WHERE id = ?`
    ).run(nowIso(), reminder.id);

    // Nuovo log automatico
    const logId = newId();
    const noteText =
      note ?? `${reminder.title} eseguito il ${today}.`;
    db.prepare(
      `INSERT INTO logs
        (id, user_id, category_id, title, notes, event_date, vehicle_id, km_at_event, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      logId,
      userId,
      reminder.category_id,
      `${reminder.title} eseguito`,
      noteText,
      today,
      reminder.vehicle_id,
      vehicle ? vehicle.current_km : null,
      nowIso()
    );

    // Ricorrenza
    let nextReminder: Reminder | null = null;
    if (reminder.recurring) {
      let nextDueDate: string | null = null;
      let nextDueKm: number | null = null;

      if (reminder.interval_months) {
        nextDueDate = addMonthsIso(today, reminder.interval_months);
      }
      if (reminder.due_km != null && vehicle) {
        // intervallo km = differenza rispetto al log d'origine, altrimenti default
        const step = inferKmInterval(db, reminder) ?? DEFAULT_KM_INTERVAL;
        nextDueKm = vehicle.current_km + step;
      }

      if (nextDueDate || nextDueKm != null) {
        const nid = newId();
        db.prepare(
          `INSERT INTO reminders
            (id, user_id, log_id, category_id, title, trigger_type, due_date, due_km,
             vehicle_id, interval_months, recurring, advance_days, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'pending', ?)`
        ).run(
          nid,
          userId,
          logId,
          reminder.category_id,
          reminder.title,
          reminder.trigger_type,
          nextDueDate,
          nextDueKm,
          reminder.vehicle_id,
          reminder.interval_months,
          reminder.advance_days,
          nowIso()
        );
        nextReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(nid) as Reminder;
      }
    }

    return { logId, nextReminder };
  });

  const { logId, nextReminder } = tx();
  const updated = db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminder.id) as Reminder;
  return { reminder: updated, newLogId: logId, nextReminder };
}

function inferKmInterval(db: Database.Database, reminder: Reminder): number | null {
  if (reminder.due_km == null || !reminder.log_id) return null;
  const log = db
    .prepare('SELECT km_at_event FROM logs WHERE id = ?')
    .get(reminder.log_id) as { km_at_event: number | null } | undefined;
  if (log && log.km_at_event != null && reminder.due_km > log.km_at_event) {
    return reminder.due_km - log.km_at_event;
  }
  return null;
}

export function stopRecurrence(userId: string, reminderId: string): void {
  getDb()
    .prepare(`UPDATE reminders SET recurring = 0 WHERE id = ? AND user_id = ?`)
    .run(reminderId, userId);
}

export function cancelReminder(userId: string, reminderId: string): void {
  getDb()
    .prepare(`UPDATE reminders SET status = 'cancelled' WHERE id = ? AND user_id = ?`)
    .run(reminderId, userId);
}
