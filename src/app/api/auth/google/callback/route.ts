import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForProfile, findOrCreateGoogleUser, isGoogleEnabled } from '@/lib/oauth';
import { getSessionCookie } from '@/lib/auth';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const params = req.nextUrl.searchParams;
  const fail = (msg: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  if (!isGoogleEnabled()) return fail('Login con Google non configurato');
  if (params.get('error')) return fail('Accesso con Google annullato');

  const code = params.get('code');
  const state = params.get('state');
  const cookieState = req.cookies.get('g_oauth_state')?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail('Sessione di accesso non valida, riprova');
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const profile = await exchangeCodeForProfile(code, redirectUri);
    const userId = await findOrCreateGoogleUser(profile);

    const cookie = await getSessionCookie(userId);
    const res = NextResponse.redirect(`${origin}/`);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    res.cookies.set('g_oauth_state', '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('[google-oauth] callback error:', err);
    return fail('Accesso con Google fallito, riprova');
  }
}
