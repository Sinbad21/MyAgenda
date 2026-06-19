import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { setBudget } from '@/lib/expenses';
import { EXPENSE_CATEGORIES } from '@/lib/categories';

export const runtime = 'nodejs';

const schema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  monthlyLimit: z.number().nonnegative(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  setBudget(user.id, parsed.data.category, parsed.data.monthlyLimit);
  return NextResponse.json({ ok: true });
}
