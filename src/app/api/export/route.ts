import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { exportExpensesCSV, exportLogsCSV, exportAllJSON, importFromJSON } from '@/lib/export';

export const runtime = 'nodejs';

const exportSchema = z.object({
  format: z.enum(['csv-expenses', 'csv-logs', 'json']),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
  const parsed = exportSchema.safeParse({ format });
  if (!parsed.success) return NextResponse.json({ error: 'format non valido (csv-expenses|csv-logs|json)' }, { status: 400 });

  if (parsed.data.format === 'csv-expenses') {
    const csv = exportExpensesCSV(user.id);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="spese.csv"',
      },
    });
  }
  if (parsed.data.format === 'csv-logs') {
    const csv = exportLogsCSV(user.id);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="log.csv"',
      },
    });
  }
  const json = exportAllJSON(user.id);
  return new Response(json, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="myagenda-backup.json"',
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const body = await req.text().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Body vuoto' }, { status: 400 });

  const result = importFromJSON(user.id, body);
  return NextResponse.json({ ok: true, ...result });
}
