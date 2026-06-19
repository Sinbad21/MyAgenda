import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { verifyPassword, setSessionCookie } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'edge';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { ok } = checkRateLimit(`login:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!ok) return NextResponse.json({ error: 'Troppi tentativi. Riprova tra un minuto.' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const { email, password } = parsed.data;
  const db = getDb();
  const user = await db
    .prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<{ id: string; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: 'Email o password non corretti' }, { status: 401 });
  }

  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
