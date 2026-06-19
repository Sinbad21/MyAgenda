import { getDb, nowIso } from './db';
import { isDue, isUpcoming } from './reminders';
import { addInAppNotification, sendEmail, sendPushToUser } from './notifications';
import { formatDateIt } from './format';
import type { Reminder, User } from './types';

/**
 * Job di scheduling (§ requisiti tecnici): processa i reminder scaduti o in
 * scadenza e invia le notifiche sui canali abilitati dall'utente.
 * Chiamabile da /api/cron (Vercel Cron) o dallo script scripts/run-cron.ts.
 */
export async function processDueReminders(): Promise<{ processed: number }> {
  const db = getDb();
  const reminders = db
    .prepare("SELECT * FROM reminders WHERE status = 'pending' AND notified_at IS NULL")
    .all() as Reminder[];

  let processed = 0;
  for (const r of reminders) {
    const due = isDue(r, db);
    const upcoming = isUpcoming(r);
    if (!due && !upcoming) continue;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.user_id) as User | undefined;
    if (!user) continue;

    const when = due ? 'scaduto' : 'in scadenza';
    const title = `Promemoria ${when}: ${r.title}`;
    const body = r.due_date ? `Scadenza: ${formatDateIt(r.due_date)}` : 'Controlla la tua agenda MyAgenda.';

    addInAppNotification(user.id, title, body, 'inapp', r.id);
    if (user.push_notifications) {
      await sendPushToUser(user.id, { title, body, url: '/' });
    }
    if (user.email_notifications) {
      await sendEmail(
        user.email,
        title,
        `<h2>${title}</h2><p>${body}</p><p>Apri <strong>MyAgenda</strong> per segnarlo come fatto.</p>`
      );
    }

    db.prepare('UPDATE reminders SET notified_at = ? WHERE id = ?').run(nowIso(), r.id);
    processed++;
  }

  return { processed };
}
