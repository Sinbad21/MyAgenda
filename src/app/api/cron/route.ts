import { NextResponse } from 'next/server';
import { processDueReminders } from '@/lib/cron';

export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // in sviluppo, senza secret, consentito
  const header = req.headers.get('authorization');
  const url = new URL(req.url);
  return header === `Bearer ${secret}` || url.searchParams.get('secret') === secret;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const result = await processDueReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
