import { Resend } from 'resend';
import { getDb, newId, nowIso } from './db';

// ── Web Push (stub — full implementation via Web Crypto coming soon) ──────────
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const db = getDb();
  const { results: subs } = await db
    .prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
    .bind(userId)
    .all<{ id: string; endpoint: string; p256dh: string; auth: string }>();

  for (const s of subs) {
    try {
      await sendWebPush(s.endpoint, s.p256dh, s.auth, payload);
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 410) {
        await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run();
      } else {
        console.error('[push] error:', err?.status ?? err?.message ?? err);
      }
    }
  }
}

async function sendWebPush(
  endpoint: string,
  p256dhB64: string,
  authB64: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const vapidPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@myagenda.app';
  if (!vapidPub || !vapidPriv) return;

  // Build VAPID JWT
  const origin = new URL(endpoint).origin;
  const jwt = await buildVapidJwt(vapidPub, vapidPriv, vapidSubject, origin);

  // Encrypt payload with AES-GCM + ECDH (RFC 8291)
  const encrypted = await encryptPushPayload(p256dhB64, authB64, JSON.stringify(payload));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPub}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body: encrypted.ciphertext as unknown as BodyInit,
  });

  if (!res.ok && res.status !== 201) {
    const err = new Error(`Push failed: ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
}

// ── VAPID JWT (ES256) ─────────────────────────────────────────────────────────
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

async function buildVapidJwt(pubB64: string, privB64: string, sub: string, audience: string): Promise<string> {
  const enc = new TextEncoder();
  const pubBytes = b64urlDecode(pubB64); // 65 bytes uncompressed P-256
  const privBytes = b64urlDecode(privB64); // 32 bytes raw P-256 scalar

  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256',
    d: b64url(privBytes),
    x: b64url(pubBytes.slice(1, 33)),
    y: b64url(pubBytes.slice(33, 65)),
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const header = b64url(enc.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub })));
  const input = `${header}.${body}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(input));
  return `${input}.${b64url(sig)}`;
}

// ── RFC 8291 payload encryption (aes128gcm) ───────────────────────────────────
async function encryptPushPayload(
  p256dhB64: string, authB64: string, plaintext: string
): Promise<{ ciphertext: Uint8Array }> {
  const enc = new TextEncoder();
  const uaPub = b64urlDecode(p256dhB64);
  const authSecret = b64urlDecode(authB64);

  // Generate ephemeral ECDH key pair
  const asKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey));

  // Import UA's public key
  // @ts-ignore CF Workers Uint8Array<ArrayBufferLike> compat
  const uaKey = await crypto.subtle.importKey('raw', uaPub as unknown as ArrayBuffer, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  // ECDH shared secret
  const sharedSecretBuf = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeyPair.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuf);

  // HKDF key derivation (RFC 8291)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK from auth secret
  // @ts-ignore CF Workers Uint8Array<ArrayBufferLike> compat
  const prkAuthKey = await crypto.subtle.importKey('raw', authSecret as unknown as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  // @ts-ignore CF Workers Uint8Array type compatibility
  const prkAuth = new Uint8Array(await crypto.subtle.sign('HMAC', prkAuthKey, concat(sharedSecret, concat(enc.encode('WebPush: info\0'), concat(uaPub, asPubRaw)))));

  // Derive CEK and nonce
  // @ts-ignore CF Workers Uint8Array<ArrayBufferLike> compat
  const prkKey = await crypto.subtle.importKey('raw', prkAuth as unknown as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  // @ts-ignore CF Workers Uint8Array<ArrayBufferLike> compat
  const saltKey = await crypto.subtle.importKey('raw', salt as unknown as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  // @ts-ignore CF Workers Uint8Array type compatibility
  const cek = (await crypto.subtle.sign('HMAC', saltKey, concat(prkAuth, enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  // @ts-ignore CF Workers Uint8Array type compatibility
  const nonce = (await crypto.subtle.sign('HMAC', saltKey, concat(prkAuth, enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  // Encrypt
  // @ts-ignore CF Workers Uint8Array<ArrayBufferLike> compat
  const aesKey = await crypto.subtle.importKey('raw', cek as unknown as ArrayBuffer, 'AES-GCM', false, ['encrypt']);
  // @ts-ignore CF Workers Uint8Array type compatibility
  const padded = concat(enc.encode(plaintext), new Uint8Array([2])); // padding delimiter
  // @ts-ignore CF Workers Uint8Array type compatibility
  const cipherContent = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as unknown as ArrayBuffer }, aesKey, padded));

  // Build RFC 8188 content: salt || rs(4) || idlen(1) || asPub || ciphertext
  const rs = 4096;
  const header = concat(
    salt,
    new Uint8Array([0, 0, 16, 0]), // rs big-endian uint32
    new Uint8Array([asPubRaw.length]),
    asPubRaw
  );
  return { ciphertext: concat(header, cipherContent) };
}

function concat(...arrays: (Uint8Array<ArrayBuffer> | Uint8Array | ArrayBuffer)[]): Uint8Array {
  const bufs = arrays.map((a) => (a instanceof Uint8Array ? a : new Uint8Array(a)));
  const total = bufs.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of bufs) { out.set(b, offset); offset += b.length; }
  return out;
}

// ── Email (Resend) ────────────────────────────────────────────────────────────
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'MyAgenda <onboarding@resend.dev>';
  if (!apiKey) {
    console.log(`[email:simulata] a=${to} oggetto="${subject}"`);
    return;
  }
  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({ from, to, subject, html });
  } catch (err) {
    console.error('[email] errore invio:', err);
  }
}

// ── Notifica in-app ────────────────────────────────────────────────────────────
export async function addInAppNotification(
  userId: string, title: string, body: string,
  channel = 'inapp', reminderId: string | null = null
): Promise<void> {
  await getDb()
    .prepare(
      `INSERT INTO notifications (id, user_id, reminder_id, channel, title, body, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .bind(newId(), userId, reminderId, channel, title, body, nowIso())
    .run();
}

export async function listNotifications(userId: string, onlyUnread = false): Promise<any[]> {
  const sql = onlyUnread
    ? 'SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
  const { results } = await getDb().prepare(sql).bind(userId).all();
  return results;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await getDb().prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(userId).run();
}
