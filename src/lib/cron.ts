import { getDb, nowIso } from './db';
import { isDue, isUpcoming } from './reminders';
import { addInAppNotification, sendEmail, sendPushToUser } from './notifications';
import { formatDateIt, formatCurrency } from './format';
import { monthTotal, categoryTotals, processRecurringExpenses } from './expenses';
import { listExpenseCategories, EXPENSE_CATEGORY_ICONS } from './categories';
import type { Reminder, User } from './types';

/**
 * Job di scheduling (§ requisiti tecnici): processa i reminder scaduti o in
 * scadenza e invia le notifiche sui canali abilitati dall'utente.
 * Chiamabile da /api/cron (Vercel Cron) o dallo script scripts/run-cron.ts.
 */
export async function processDueReminders(): Promise<{ processed: number }> {
  const db = getDb();

  // Pending reminders that either have never been notified, or were notified
  // more than 24h ago (re-notify if still pending/overdue)
  const reminders = db
    .prepare(
      `SELECT * FROM reminders
       WHERE status = 'pending'
         AND (snoozed_until IS NULL OR snoozed_until <= date('now'))
         AND (notified_at IS NULL OR (due_date IS NOT NULL AND due_date < date('now') AND datetime(notified_at) < datetime('now', '-24 hours')))`
    )
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

/**
 * Genera e invia il riepilogo settimanale/mensile via email.
 * Inviato agli utenti con weekly_summary = 1.
 * Il tipo di digest dipende dal parametro `type`.
 */
export async function sendDigest(type: 'weekly' | 'monthly' = 'weekly'): Promise<{ sent: number }> {
  const db = getDb();
  const users = db.prepare('SELECT * FROM users WHERE weekly_summary = 1 AND email_notifications = 1').all() as User[];

  const now = new Date();
  const curKey = now.toISOString().slice(0, 7);
  const label = type === 'monthly'
    ? now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    : `settimana del ${now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}`;

  let sent = 0;
  for (const user of users) {
    const total = monthTotal(user.id, curKey);
    const catTotals = categoryTotals(user.id, curKey);
    const cats = listExpenseCategories(user.id);
    const iconMap: Record<string, string> = { ...EXPENSE_CATEGORY_ICONS };
    for (const c of cats) iconMap[c.name] = c.icon;

    const overdue = db
      .prepare(
        `SELECT COUNT(*) AS n FROM reminders
         WHERE user_id = ? AND status = 'pending' AND due_date < date('now')`
      )
      .get(user.id) as { n: number };

    const upcoming = db
      .prepare(
        `SELECT COUNT(*) AS n FROM reminders
         WHERE user_id = ? AND status = 'pending' AND due_date BETWEEN date('now') AND date('now', '+7 days')`
      )
      .get(user.id) as { n: number };

    const catRows = cats
      .filter((c) => (catTotals[c.name] ?? 0) > 0)
      .map(
        (c) =>
          `<tr>
            <td style="padding:4px 8px">${iconMap[c.name] ?? ''} ${c.name}</td>
            <td style="padding:4px 8px;text-align:right">${formatCurrency(catTotals[c.name] ?? 0)}</td>
          </tr>`
      )
      .join('');

    const html = `
      <h2>🗓️ Riepilogo MyAgenda — ${label}</h2>
      <h3>💶 Spese del mese</h3>
      <p><strong>Totale:</strong> ${formatCurrency(total)}</p>
      ${catRows ? `<table style="border-collapse:collapse">${catRows}</table>` : '<p>Nessuna spesa registrata.</p>'}
      <h3>🔔 Promemoria</h3>
      <p>${overdue.n > 0 ? `⚠️ <strong>${overdue.n}</strong> scaduti da gestire.` : 'Nessun promemoria scaduto.'}</p>
      <p>${upcoming.n > 0 ? `📅 <strong>${upcoming.n}</strong> in scadenza nei prossimi 7 giorni.` : ''}</p>
      <hr>
      <p style="font-size:12px;color:#6b7280">Ricevi questo riepilogo perché hai attivo il riepilogo settimanale su MyAgenda.
      Puoi disattivarlo dalle <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/impostazioni">Impostazioni</a>.</p>
    `;

    await sendEmail(
      user.email,
      `📊 Riepilogo ${type === 'monthly' ? 'mensile' : 'settimanale'} MyAgenda`,
      html
    );
    sent++;
  }

  return { sent };
}

/**
 * Master cron entry point: runs all scheduled tasks.
 */
export async function runCron(): Promise<Record<string, unknown>> {
  const reminders = await processDueReminders();
  const recurring = processRecurringExpenses();

  const today = new Date();
  const isSunday = today.getDay() === 0;
  const isFirstOfMonth = today.getDate() === 1;

  let digest: { sent: number } = { sent: 0 };
  if (isFirstOfMonth) {
    digest = await sendDigest('monthly');
  } else if (isSunday) {
    digest = await sendDigest('weekly');
  }

  return { reminders, recurring, digest };
}
