import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb, newId, nowIso } from '@/lib/db';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.string().trim().min(1).max(8).default('🏷️'),
  color: z.string().max(20).optional(),
  kind: z.enum(['vehicles', 'health', 'home', 'shopping', 'pets', 'general']).default('general'),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO categories (id, user_id, name, icon, color, kind, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(id, user.id, parsed.data.name, parsed.data.icon, parsed.data.color ?? '#64748b', parsed.data.kind, nowIso());

  return NextResponse.json({ ok: true, id });
}
