import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { addExpense, budgetStatuses, monthTotal } from '@/lib/expenses';
import { EXPENSE_CATEGORIES } from '@/lib/categories';

export const runtime = 'nodejs';

const schema = z.object({
  amount: z.number().positive(),
  category: z.enum(EXPENSE_CATEGORIES),
  date: z.string().optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  const expense = addExpense({
    userId: user.id,
    amount: parsed.data.amount,
    category: parsed.data.category,
    date: parsed.data.date,
    note: parsed.data.note ?? null,
  });

  const status = budgetStatuses(user.id).find((b) => b.category === parsed.data.category) ?? null;
  return NextResponse.json({ ok: true, expense, monthTotal: monthTotal(user.id), budget: status });
}
