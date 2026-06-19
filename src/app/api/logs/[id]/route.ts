import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb, nowIso } from '@/lib/db';
import type { LogEntry } from '@/lib/types';

export const runtime = 'edge';

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  notes: z.string().max(4000).optional().nullable(),
  eventDate: z.string().optional(),
  kmAtEvent: z.number().int().nonnegative().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const log = await db
    .prepare('SELECT * FROM logs WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<LogEntry>();
  if (!log) return NextResponse.json({ error: 'Log non trovato' }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const d = parsed.data;
  await db
    .prepare(`UPDATE logs SET title = ?, notes = ?, event_date = ?, km_at_event = ? WHERE id = ?`)
    .bind(
      d.title ?? log.title,
      d.notes !== undefined ? d.notes : log.notes,
      d.eventDate ?? log.event_date,
      d.kmAtEvent !== undefined ? d.kmAtEvent : log.km_at_event,
      log.id
    )
    .run();

  const updated = (await db.prepare('SELECT * FROM logs WHERE id = ?').bind(log.id).first<LogEntry>())!;
  return NextResponse.json({ ok: true, log: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const log = await db.prepare('SELECT id FROM logs WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!log) return NextResponse.json({ error: 'Log non trovato' }, { status: 404 });

  await db.batch([
    db.prepare('DELETE FROM reminders WHERE log_id = ? AND user_id = ?').bind(id, user.id),
    db.prepare('DELETE FROM expenses WHERE log_id = ? AND user_id = ?').bind(id, user.id),
    db.prepare('DELETE FROM logs WHERE id = ?').bind(id),
  ]);
  return NextResponse.json({ ok: true });
}
