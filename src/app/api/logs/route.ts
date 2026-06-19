import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb, newId, nowIso } from '@/lib/db';
import { createReminder } from '@/lib/reminders';
import { addExpense } from '@/lib/expenses';
import { addMonthsIso, todayIso } from '@/lib/format';

export const runtime = 'nodejs';

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  categoryId: z.string().nullable().optional(),
  eventDate: z.string().optional(),
  notes: z.string().max(4000).optional(),
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
    `INSERT INTO logs (id, user_id, category_id, title, notes, event_date, vehicle_id, km_at_event, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    logId,
    user.id,
    d.categoryId ?? null,
    d.title,
    d.notes ?? null,
    eventDate,
    d.vehicleId ?? null,
    d.kmAtEvent ?? null,
    nowIso()
  );

  let reminderId: string | null = null;
  if (d.reminder?.enabled) {
    const r = d.reminder;
    const dueDate =
      r.dueDate || (r.intervalMonths ? addMonthsIso(eventDate, r.intervalMonths) : null);
    const reminder = createReminder({
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
  }

  if (d.expense) {
    addExpense({
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
