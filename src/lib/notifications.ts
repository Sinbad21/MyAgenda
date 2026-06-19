import webpush from 'web-push';
import nodemailer from 'nodemailer';
import { getDb, newId, nowIso } from './db';

// ── Web Push (VAPID) ───────────────────────────────────────────────────────
let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@myagenda.app', pub, priv);
  vapidReady = true;
  return true;
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!ensureVapid()) return;
  const db = getDb();
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId) as {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      // 404/410 = subscription scaduta → rimuovi
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
      } else {
        console.error('[push] errore invio:', err?.statusCode || err);
      }
    }
  }
}

// ── Email (SMTP transazionale) ─────────────────────────────────────────────
function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export async function sendEmail(to: string, subject: string, html: string) {
  const transport = getTransport();
  const from = process.env.EMAIL_FROM || 'MyAgenda <no-reply@myagenda.app>';
  if (!transport) {
    // Degradazione controllata: senza SMTP configurato logghiamo soltanto.
    console.log(`[email:simulata] a=${to} oggetto="${subject}"`);
    return;
  }
  try {
    await transport.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error('[email] errore invio:', err);
  }
}

// ── Notifica in-app ────────────────────────────────────────────────────────
export function addInAppNotification(
  userId: string,
  title: string,
  body: string,
  channel = 'inapp',
  reminderId: string | null = null
) {
  getDb()
    .prepare(
      `INSERT INTO notifications (id, user_id, reminder_id, channel, title, body, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(newId(), userId, reminderId, channel, title, body, nowIso());
}

export function listNotifications(userId: string, onlyUnread = false) {
  const db = getDb();
  const sql = onlyUnread
    ? 'SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
  return db.prepare(sql).all(userId);
}

export function markNotificationsRead(userId: string) {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
}
