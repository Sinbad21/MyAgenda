import { NextRequest, NextResponse } from 'next/server';
import { isGoogleEnabled, buildGoogleAuthUrl } from '@/lib/oauth';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!isGoogleEnabled()) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Login con Google non configurato')}`);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${origin}/api/auth/google/callback`;
  const res = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
