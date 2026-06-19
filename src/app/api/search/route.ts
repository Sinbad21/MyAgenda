import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { globalSearch } from '@/lib/search';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ results: [] });

  const results = globalSearch(user.id, q);
  return NextResponse.json({ results });
}
