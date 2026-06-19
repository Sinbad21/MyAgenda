import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, newId, nowIso } from '@/lib/db';
import { hashPassword, setSessionCookie } from '@/lib/auth';
import { provisionNewUser } from '@/lib/provisioning';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'La password deve avere almeno 6 caratteri'),
  name: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dati non validi' }, { status: 400 });
  }
  const { email, password, name } = parsed.data;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: 'Esiste già un account con questa email' }, { status: 409 });
  }

  const id = newId();
  const hash = await hashPassword(password);
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, email.toLowerCase(), hash, name ?? null, nowIso());

  provisionNewUser(id);

  // Collega eventuali condivisioni in attesa indirizzate a questa email.
  db.prepare('UPDATE shares SET shared_with_user_id = ? WHERE shared_with_email = ?').run(id, email.toLowerCase());

  await setSessionCookie(id);
  return NextResponse.json({ ok: true });
}
