import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().trim().max(80).optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  advanceDays: z.number().int().min(0).max(365).optional(),
  weeklySummary: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const d = parsed.data;
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (d.name !== undefined) (fields.push('name = ?'), values.push(d.name));
  if (d.emailNotifications !== undefined) (fields.push('email_notifications = ?'), values.push(d.emailNotifications ? 1 : 0));
  if (d.pushNotifications !== undefined) (fields.push('push_notifications = ?'), values.push(d.pushNotifications ? 1 : 0));
  if (d.advanceDays !== undefined) (fields.push('advance_days = ?'), values.push(d.advanceDays));
  if (d.weeklySummary !== undefined) (fields.push('weekly_summary = ?'), values.push(d.weeklySummary ? 1 : 0));

  if (fields.length) {
    values.push(user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  return NextResponse.json({ ok: true });
}
