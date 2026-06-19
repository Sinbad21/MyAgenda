import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb, newId, nowIso } from '@/lib/db';

export const runtime = 'edge';

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Subscription non valida' }, { status: 400 });

  const { endpoint, keys } = parsed.data;
  const db = getDb();
  const existing = await db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).first();
  if (!existing) {
    await db
      .prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newId(), user.id, endpoint, keys.p256dh, keys.auth, nowIso())
      .run();
  }
  return NextResponse.json({ ok: true });
}
