import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { completeReminder, stopRecurrence, cancelReminder, snoozeReminder, updateReminder } from '@/lib/reminders';

export const runtime = 'edge';

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['complete', 'stop', 'cancel', 'snooze', 'update']),
  note: z.string().max(4000).optional(),
  snoozeDays: z.number().int().min(1).max(365).optional(),
  patch: z
    .object({
      title: z.string().max(120).optional(),
      due_date: z.string().nullable().optional(),
      due_km: z.number().int().positive().nullable().optional(),
      advance_days: z.number().int().min(0).max(365).optional(),
      recurring: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const { id, action, note, snoozeDays, patch } = parsed.data;
  try {
    if (action === 'complete') {
      const result = await completeReminder(user.id, id, note);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === 'stop') {
      await stopRecurrence(user.id, id);
      return NextResponse.json({ ok: true });
    }
    if (action === 'cancel') {
      await cancelReminder(user.id, id);
      return NextResponse.json({ ok: true });
    }
    if (action === 'snooze') {
      const days = snoozeDays ?? 1;
      const reminder = await snoozeReminder(user.id, id, days);
      return NextResponse.json({ ok: true, reminder });
    }
    if (action === 'update' && patch) {
      const reminder = await updateReminder(user.id, id, {
        ...patch,
        recurring: patch.recurring !== undefined ? (patch.recurring ? 1 : 0) : undefined,
      });
      return NextResponse.json({ ok: true, reminder });
    }
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Errore' }, { status: 400 });
  }
}
