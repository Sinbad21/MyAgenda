import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'edge';

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
  const updates: { field: string; value: unknown }[] = [];
  if (d.name !== undefined) updates.push({ field: 'name', value: d.name });
  if (d.emailNotifications !== undefined) updates.push({ field: 'email_notifications', value: d.emailNotifications ? 1 : 0 });
  if (d.pushNotifications !== undefined) updates.push({ field: 'push_notifications', value: d.pushNotifications ? 1 : 0 });
  if (d.advanceDays !== undefined) updates.push({ field: 'advance_days', value: d.advanceDays });
  if (d.weeklySummary !== undefined) updates.push({ field: 'weekly_summary', value: d.weeklySummary ? 1 : 0 });

  if (updates.length) {
    const set = updates.map((u) => `${u.field} = ?`).join(', ');
    const vals = [...updates.map((u) => u.value), user.id];
    await db.prepare(`UPDATE users SET ${set} WHERE id = ?`).bind(...(vals as any[])).run();
  }
  return NextResponse.json({ ok: true });
}
