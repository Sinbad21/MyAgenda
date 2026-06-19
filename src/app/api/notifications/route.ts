import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listNotifications, markNotificationsRead } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  return NextResponse.json({ notifications: listNotifications(user.id) });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  markNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}
