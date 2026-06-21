import { getDb, newId, nowIso } from './db';
import { provisionNewUser } from './provisioning';

/**
 * Google OAuth 2.0 (Authorization Code flow) per runtime edge.
 * Configurazione via variabili d'ambiente:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * Il redirect_uri è derivato dall'origine della richiesta:
 *   <origin>/api/auth/google/callback
 * e DEVE essere registrato nella Google Cloud Console.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export function googleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || '';
}

function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || '';
}

export function isGoogleEnabled(): boolean {
  return googleClientId().length > 0 && googleClientSecret().length > 0;
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/** Scambia il code con Google e recupera il profilo utente. */
export async function exchangeCodeForProfile(code: string, redirectUri: string): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    throw new Error('Scambio token Google fallito: ' + (await tokenRes.text()).slice(0, 200));
  }
  const tok = (await tokenRes.json()) as { access_token?: string };
  if (!tok.access_token) throw new Error('Nessun access_token ricevuto da Google');

  const uiRes = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!uiRes.ok) throw new Error('Recupero profilo Google fallito');
  const profile = (await uiRes.json()) as GoogleProfile;
  if (!profile.email) throw new Error('Email non disponibile dal profilo Google');
  return profile;
}

/**
 * Trova l'utente per email (account linking) o ne crea uno nuovo.
 * Gli utenti Google hanno password_hash sentinella ('oauth:google') che non
 * potrà mai combaciare con una password (bcrypt.compare ritorna false).
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<string> {
  const db = getDb();
  const email = profile.email.toLowerCase();

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (existing) {
    await db
      .prepare('UPDATE users SET google_id = COALESCE(google_id, ?) WHERE id = ?')
      .bind(profile.sub, existing.id)
      .run();
    return existing.id;
  }

  const id = newId();
  await db
    .prepare(`INSERT INTO users (id, email, password_hash, name, google_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, email, 'oauth:google', profile.name ?? null, profile.sub, nowIso())
    .run();

  await provisionNewUser(id);
  await db.prepare('UPDATE shares SET shared_with_user_id = ? WHERE shared_with_email = ?').bind(id, email).run();
  return id;
}
