import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb, newId, nowIso } from '@/lib/db';
import { sendEmail } from '@/lib/notifications';

export const runtime = 'edge';

const schema = z.object({
  resourceType: z.enum(['category', 'log']),
  resourceId: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const { resourceType, resourceId, email } = parsed.data;
  const db = getDb();

  const table = resourceType === 'category' ? 'categories' : 'logs';
  const owned = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND user_id = ?`).bind(resourceId, user.id).first();
  if (!owned) return NextResponse.json({ error: 'Risorsa non trovata' }, { status: 404 });

  const target = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first<{ id: string }>();

  await db
    .prepare(
      `INSERT INTO shares (id, owner_id, resource_type, resource_id, shared_with_email, shared_with_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(newId(), user.id, resourceType, resourceId, email.toLowerCase(), target?.id ?? null, nowIso())
    .run();

  await sendEmail(
    email,
    'Condivisione su MyAgenda',
    `<p>${user.name || user.email} ha condiviso con te ${resourceType === 'category' ? 'una categoria' : 'un evento'} su MyAgenda.</p>
     <p>Accedi (o registrati con questa email) per vederlo.</p>`
  );

  return NextResponse.json({ ok: true, linked: !!target });
}
