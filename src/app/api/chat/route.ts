import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { interpretMessage, type ConvMessage } from '@/ai/assistant';
import { executeActions } from '@/lib/chat-actions';
import { listVehicles } from '@/lib/queries';
import { expenseCategoryNames } from '@/lib/categories';
import { todayIso } from '@/lib/format';
import { checkRateLimit } from '@/lib/rate-limit';
import { getDb } from '@/lib/db';

export const runtime = 'edge';

const schema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) })).max(20).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { ok } = checkRateLimit(`chat:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!ok) return NextResponse.json({ error: 'Troppi messaggi. Aspetta un momento.' }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Messaggio non valido' }, { status: 400 });

  const db = getDb();
  const vehicles = (await listVehicles(user.id)).map((v) => ({ id: v.id, name: v.name, current_km: v.current_km }));
  const expenseCategories = await expenseCategoryNames(user.id) as any;

  // Carica promemoria attivi e log recenti per contesto AI
  const { results: reminders } = await db
    .prepare(`SELECT id, title, due_date, due_time FROM reminders WHERE user_id = ? AND status = 'pending' ORDER BY due_date ASC LIMIT 20`)
    .bind(user.id).all<{ id: string; title: string; due_date: string | null; due_time: string | null }>();
  const { results: recentLogs } = await db
    .prepare(`SELECT id, title, event_date FROM logs WHERE user_id = ? ORDER BY event_date DESC, created_at DESC LIMIT 15`)
    .bind(user.id).all<{ id: string; title: string; event_date: string }>();

  const result = await interpretMessage(parsed.data.message, {
    todayIso: todayIso(),
    vehicles,
    expenseCategories,
    reminders,
    recentLogs,
  }, (parsed.data.history ?? []) as ConvMessage[]);

  if (result.needs_clarification || result.actions.length === 0) {
    return NextResponse.json({
      reply: result.reply,
      needs_clarification: result.needs_clarification,
      insights: [],
      source: result.source,
    });
  }

  const exec = await executeActions(user.id, result.actions);
  return NextResponse.json({
    reply: result.reply,
    needs_clarification: false,
    insights: exec.insights,
    created: exec,
    source: result.source,
  });
}
