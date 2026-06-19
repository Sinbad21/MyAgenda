import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { updateExpense, deleteExpense } from '@/lib/expenses';

export const runtime = 'edge';

const patchSchema = z.object({
  amount: z.number().positive().optional(),
  category: z.string().optional(),
  date: z.string().optional(),
  note: z.string().max(500).optional().nullable(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
  try {
    const expense = await updateExpense(user.id, id, parsed.data);
    return NextResponse.json({ ok: true, expense });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore' }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const { id } = await params;
  try {
    await deleteExpense(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore' }, { status: 400 });
  }
}
