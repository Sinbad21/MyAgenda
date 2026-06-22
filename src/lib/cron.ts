import { getDb, nowIso } from './db';
import { isDue, isUpcoming } from './reminders';
import { addInAppNotification, sendEmail, sendPushToUser } from './notifications';
import { formatDateIt, formatCurrency, appTimezone, nowInTz, minutesUntilAppointment } from './format';
import { monthTotal, categoryTotals, processRecurringExpenses } from './expenses';
import { listExpenseCategories, EXPENSE_CATEGORY_ICONS } from './categories';
import type { Reminder, User } from './types';

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

export async function processDueReminders(): Promise<{ processed: number }> {
  const db = getDb();
  const { results: reminders } = await db
    .prepare(
      `SELECT * FROM reminders WHERE status = 'pending'
         AND (snoozed_until IS NULL OR snoozed_until <= date('now'))
         AND (notified_at IS NULL OR (due_date IS NOT NULL AND due_date < date('now') AND datetime(notified_at) < datetime('now', '-24 hours')))`
    )
    .all<Reminder>();

  const now = new Date();
  const tz = appTimezone();
  const local = nowInTz(now, tz);
  const leadMin = envInt('REMINDER_LEAD_MINUTES', 0);   // minuti di anticipo sull'orario dell'appuntamento
  const graceMin = envInt('REMINDER_GRACE_MINUTES', 120); // tolleranza dopo l'orario (cron in ritardo)
  const morningHour = envInt('REMINDER_MORNING_HOUR', 8); // ora dei promemoria "a giornata"

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const reminderUrl = `${appUrl}/promemoria`;
  const ctaHtml = `<p style="margin-top:16px"><a href="${reminderUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Apri MyAgenda →</a></p>`;

  let processed = 0;
  for (const r of reminders) {
    let title: string | null = null;
    let body = '';
    let emailHtml = '';

    if (r.due_date && r.due_time) {
      // ── Appuntamento con orario preciso → notifica all'ora esatta (± finestra) ──
      if (r.notified_at) continue; // già avvisato per questo appuntamento
      const mins = minutesUntilAppointment(r.due_date, r.due_time, now, tz);
      if (mins > leadMin || mins < -graceMin) continue; // non è ancora ora, oppure troppo tardi
      const when = mins <= 1 ? 'è adesso' : mins < 60 ? `tra ${Math.round(mins)} min` : `oggi alle ${r.due_time}`;
      title = `⏰ ${r.title}`;
      body = `Il tuo appuntamento ${when} (${r.due_time}).`;
      emailHtml = `<h2>⏰ ${r.title}</h2><p>${body}</p>${ctaHtml}`;
    } else {
      // ── Promemoria a giornata / km → comportamento storico, ma solo dal mattino ──
      const due = await isDue(r);
      const upcoming = isUpcoming(r);
      if (!due && !upcoming) continue;
      if (local.hour < morningHour) continue; // niente avvisi notturni col cron ad alta frequenza
      if (due) {
        title = `✅ Hai completato "${r.title}"?`;
        body = r.due_date
          ? `Era in scadenza il ${formatDateIt(r.due_date)}. Segnalo come fatto se l'hai già completato.`
          : "Era in scadenza. Segnalo come fatto se l'hai già completato.";
        emailHtml = `<h2>✅ Hai completato "${r.title}"?</h2><p>${body}</p>${ctaHtml}`;
      } else {
        title = `🔔 Promemoria in scadenza: ${r.title}`;
        body = r.due_date ? `Scade il ${formatDateIt(r.due_date)}.` : 'Controlla la tua agenda MyAgenda.';
        emailHtml = `<h2>${title}</h2><p>${body}</p>`;
      }
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(r.user_id).first<User>();
    if (!user) continue;

    await addInAppNotification(user.id, title, body, 'inapp', r.id);
    if (user.push_notifications) await sendPushToUser(user.id, { title, body, url: reminderUrl });
    if (user.email_notifications) await sendEmail(user.email, title, emailHtml);

    await db.prepare('UPDATE reminders SET notified_at = ? WHERE id = ?').bind(nowIso(), r.id).run();
    processed++;
  }
  return { processed };
}

export async function sendDigest(type: 'weekly' | 'monthly' = 'weekly'): Promise<{ sent: number }> {
  const db = getDb();
  const { results: users } = await db
    .prepare('SELECT * FROM users WHERE weekly_summary = 1 AND email_notifications = 1')
    .all<User>();

  const now = new Date();
  const curKey = now.toISOString().slice(0, 7);
  const label = type === 'monthly'
    ? now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    : `settimana del ${now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}`;

  let sent = 0;
  for (const user of users) {
    const total = await monthTotal(user.id, curKey);
    const catTotals = await categoryTotals(user.id, curKey);
    const cats = await listExpenseCategories(user.id);
    const iconMap: Record<string, string> = { ...EXPENSE_CATEGORY_ICONS };
    for (const c of cats) iconMap[c.name] = c.icon;

    const overdue = await db
      .prepare(`SELECT COUNT(*) AS n FROM reminders WHERE user_id = ? AND status = 'pending' AND due_date < date('now')`)
      .bind(user.id).first<{ n: number }>();
    const upcoming = await db
      .prepare(`SELECT COUNT(*) AS n FROM reminders WHERE user_id = ? AND status = 'pending' AND due_date BETWEEN date('now') AND date('now', '+7 days')`)
      .bind(user.id).first<{ n: number }>();

    const catRows = cats
      .filter((c) => (catTotals[c.name] ?? 0) > 0)
      .map((c) => `<tr><td>${iconMap[c.name] ?? ''} ${c.name}</td><td style="text-align:right">${formatCurrency(catTotals[c.name] ?? 0)}</td></tr>`)
      .join('');

    const html = `
      <h2>📊 Riepilogo ${label}</h2>
      <p><strong>Spese totali:</strong> ${formatCurrency(total)}</p>
      ${catRows ? `<table>${catRows}</table>` : ''}
      <p>📋 Promemoria scaduti: <strong>${overdue?.n ?? 0}</strong> | In scadenza (7gg): <strong>${upcoming?.n ?? 0}</strong></p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/promemoria">Apri MyAgenda →</a></p>
    `;

    await sendEmail(user.email, `MyAgenda — Riepilogo ${label}`, html);
    sent++;
  }
  return { sent };
}

export async function runCron(): Promise<{ reminders: number; expenses: number; digest?: number }> {
  const [rem, exp] = await Promise.all([processDueReminders(), processRecurringExpenses()]);
  return { reminders: rem.processed, expenses: exp.inserted };
}
