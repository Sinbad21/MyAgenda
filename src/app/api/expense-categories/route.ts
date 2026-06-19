import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { listExpenseCategories, addExpenseCategory, deleteExpenseCategory } from '@/lib/categories';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const categories = listExpenseCategories(user.id);
  return NextResponse.json({ categories });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  icon: z.string().min(1).max(10),
  color: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  try {
    const cat = addExpenseCategory(user.id, parsed.data.name, parsed.data.icon, parsed.data.color);
    return NextResponse.json({ ok: true, category: cat });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });

  try {
    deleteExpenseCategory(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore' }, { status: 400 });
  }
}
