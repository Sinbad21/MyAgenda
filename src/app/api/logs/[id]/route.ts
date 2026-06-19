import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb, nowIso } from '@/lib/db';
import type { LogEntry } from '@/lib/types';

export const runtime = 'nodejs';

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  notes: z.string().max(4000).optional().nullable(),
  eventDate: z.string().optional(),
  kmAtEvent: z.number().int().nonnegative().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const db = getDb();
  const log = db
    .prepare('SELECT * FROM logs WHERE id = ? AND user_id = ?')
    .get(params.id, user.id) as LogEntry | undefined;
  if (!log) return NextResponse.json({ error: 'Log non trovato' }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const d = parsed.data;
  db.prepare(
    `UPDATE logs SET title = ?, notes = ?, event_date = ?, km_at_event = ? WHERE id = ?`
  ).run(
    d.title ?? log.title,
    d.notes !== undefined ? d.notes : log.notes,
    d.eventDate ?? log.event_date,
    d.kmAtEvent !== undefined ? d.kmAtEvent : log.km_at_event,
    log.id
  );

  const updated = db.prepare('SELECT * FROM logs WHERE id = ?').get(log.id) as LogEntry;
  return NextResponse.json({ ok: true, log: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const db = getDb();
  const log = db.prepare('SELECT id FROM logs WHERE id = ? AND user_id = ?').get(params.id, user.id);
  if (!log) return NextResponse.json({ error: 'Log non trovato' }, { status: 404 });

  // Also delete associated reminders and expenses
  db.prepare('DELETE FROM reminders WHERE log_id = ? AND user_id = ?').run(params.id, user.id);
  db.prepare('DELETE FROM expenses WHERE log_id = ? AND user_id = ?').run(params.id, user.id);
  db.prepare('DELETE FROM logs WHERE id = ?').run(params.id);

  return NextResponse.json({ ok: true });
}
