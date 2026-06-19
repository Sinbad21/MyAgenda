import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { verifyPassword, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const db = getDb();
  const user = db
    .prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .get(email.toLowerCase()) as { id: string; password_hash: string } | undefined;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: 'Email o password non corretti' }, { status: 401 });
  }

  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
