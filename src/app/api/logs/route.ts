import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb, newId, nowIso } from '@/lib/db';
import { createReminder } from '@/lib/reminders';
import { addExpense } from '@/lib/expenses';
import { addMonthsIso, todayIso, formatDateIt } from '@/lib/format';
import { sendEmail } from '@/lib/notifications';

export const runtime = 'edge';

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  categoryId: z.string().nullable().optional(),
  eventDate: z.string().optional(),
  notes: z.string().max(4000).optional(),
  location: z.string().max(500).optional().nullable(),
  vehicleId: z.string().nullable().optional(),
  kmAtEvent: z.number().int().nonnegative().nullable().optional(),
  reminder: z
    .object({
      enabled: z.boolean(),
      triggerType: z.enum(['time', 'km']).default('time'),
      dueDate: z.string().nullable().optional(),
      intervalMonths: z.number().int().positive().nullable().optional(),
      dueKm: z.number().int().positive().nullable().optional(),
      recurring: z.boolean().default(false),
      advanceDays: z.number().int().min(0).max(365).default(7),
    })
    .nullable()
    .optional(),
  expense: z
    .object({ amount: z.number().positive(), category: z.string() })
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const d = parsed.data;
  const db = getDb();
  const eventDate = d.eventDate || todayIso();
  const logId = newId();

  db.prepare(
    `INSERT INTO logs (id, user_id, category_id, title, notes, location, event_date, vehicle_id, km_at_event, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    logId,
    user.id,
    d.categoryId ?? null,
    d.title,
    d.notes ?? null,
    d.location ?? null,
    eventDate,
    d.vehicleId ?? null,
    d.kmAtEvent ?? null,
    nowIso()
  ).run();

  let reminderId: string | null = null;
  if (d.reminder?.enabled) {
    const r = d.reminder;
    const dueDate =
      r.dueDate || (r.intervalMonths ? addMonthsIso(eventDate, r.intervalMonths) : null);
    const reminder = await createReminder({
      userId: user.id,
      logId,
      categoryId: d.categoryId ?? null,
      title: d.title,
      triggerType: r.triggerType,
      dueDate,
      dueKm: r.dueKm ?? null,
      vehicleId: d.vehicleId ?? null,
      intervalMonths: r.intervalMonths ?? null,
      recurring: r.recurring,
      advanceDays: r.advanceDays,
    });
    reminderId = reminder.id;
    // Email di conferma immediata
    if (user.email_notifications !== 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myagenda.pages.dev';
      const dueLine = reminder.due_date
        ? '<p>Data: <strong>' + formatDateIt(reminder.due_date) + '</strong></p>'
        : '';
      const advLine = reminder.advance_days
        ? '<p>Ti avviseremo <strong>' + reminder.advance_days + ' giorni prima</strong> della scadenza.</p>'
        : '';
      const html =
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto">' +
        '<h2 style="color:#2563eb">Promemoria salvato</h2>' +
        '<p>Il promemoria <strong>&quot;' + d.title + '&quot;</strong> e stato creato con successo.</p>' +
        dueLine + advLine +
        '<p style="margin-top:24px"><a href="' + appUrl + '/promemoria" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Vai ai Promemoria</a></p>' +
        '</div>';
      sendEmail(user.email, 'Promemoria: ' + d.title, html).catch(() => {});
    }
  }

  if (d.expense) {
    await addExpense({
      userId: user.id,
      amount: d.expense.amount,
      category: d.expense.category,
      date: eventDate,
      note: d.title,
      logId,
    });
  }

  return NextResponse.json({ ok: true, logId, reminderId });
}
