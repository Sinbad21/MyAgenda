import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { completeReminder, stopRecurrence, cancelReminder } from '@/lib/reminders';

export const runtime = 'nodejs';

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(['complete', 'stop', 'cancel']),
  note: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const { id, action, note } = parsed.data;
  try {
    if (action === 'complete') {
      const result = completeReminder(user.id, id, note);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === 'stop') {
      stopRecurrence(user.id, id);
      return NextResponse.json({ ok: true });
    }
    cancelReminder(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Errore' }, { status: 400 });
  }
}
