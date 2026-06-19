import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { listRecurring, addRecurring, toggleRecurring, deleteRecurring } from '@/lib/expenses';

export const runtime = 'edge';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  return NextResponse.json({ recurring: listRecurring(user.id) });
}

const createSchema = z.object({
  label: z.string().trim().min(1).max(100),
  amount: z.number().positive(),
  category: z.string().min(1),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const rec = await addRecurring({ userId: user.id, ...parsed.data });
  return NextResponse.json({ ok: true, recurring: rec });
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['toggle', 'delete']),
});

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  try {
    if (parsed.data.action === 'toggle') {
      const db = getDb();
      const curr = await db.prepare('SELECT active FROM recurring_expenses WHERE id = ? AND user_id = ?').bind(parsed.data.id, user.id).first<{ active: number }>();
      if (!curr) return NextResponse.json({ error: 'Non trovato' }, { status: 404 });
      await toggleRecurring(user.id, parsed.data.id, !curr.active);
      return NextResponse.json({ ok: true });
    }
    await deleteRecurring(user.id, parsed.data.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore' }, { status: 400 });
  }
}
