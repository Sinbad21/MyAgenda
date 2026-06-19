import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { setBudget } from '@/lib/expenses';

export const runtime = 'edge';

const schema = z.object({
  category: z.string().min(1).max(100),
  monthlyLimit: z.number().nonnegative(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

  await setBudget(user.id, parsed.data.category, parsed.data.monthlyLimit);
  return NextResponse.json({ ok: true });
}
