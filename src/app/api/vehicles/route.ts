import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb, newId, nowIso } from '@/lib/db';
import { updateVehicleKm } from '@/lib/lookups';

export const runtime = 'edge';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().trim().min(1).max(60), currentKm: z.number().int().nonnegative().default(0) }),
  z.object({ action: z.literal('updateKm'), id: z.string().min(1), km: z.number().int().nonnegative() }),
]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const db = getDb();
  if (parsed.data.action === 'create') {
    const id = newId();
    await db
      .prepare('INSERT INTO vehicles (id, user_id, name, current_km, km_updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, parsed.data.name, parsed.data.currentKm, nowIso(), nowIso())
      .run();
    return NextResponse.json({ ok: true, id });
  }

  await updateVehicleKm(user.id, parsed.data.id, parsed.data.km);
  return NextResponse.json({ ok: true });
}
