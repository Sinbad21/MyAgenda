import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { interpretMessage } from '@/ai/assistant';
import { executeActions } from '@/lib/chat-actions';
import { listVehicles } from '@/lib/queries';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { todayIso } from '@/lib/format';

export const runtime = 'nodejs';

const schema = z.object({ message: z.string().min(1).max(2000) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Messaggio non valido' }, { status: 400 });

  const vehicles = listVehicles(user.id).map((v) => ({ id: v.id, name: v.name, current_km: v.current_km }));
  const result = await interpretMessage(parsed.data.message, {
    todayIso: todayIso(),
    vehicles,
    expenseCategories: EXPENSE_CATEGORIES,
  });

  if (result.needs_clarification || result.actions.length === 0) {
    return NextResponse.json({
      reply: result.reply,
      needs_clarification: result.needs_clarification,
      insights: [],
      source: result.source,
    });
  }

  const exec = executeActions(user.id, result.actions);
  return NextResponse.json({
    reply: result.reply,
    needs_clarification: false,
    insights: exec.insights,
    created: exec,
    source: result.source,
  });
}
