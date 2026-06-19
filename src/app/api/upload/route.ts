import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb, nowIso } from '@/lib/db';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const url = new URL(req.url);
  const logId = url.searchParams.get('logId');
  if (!logId) return NextResponse.json({ error: 'logId richiesto' }, { status: 400 });

  // Verify the log belongs to the user
  const db = getDb();
  const log = db.prepare('SELECT id FROM logs WHERE id = ? AND user_id = ?').get(logId, user.id);
  if (!log) return NextResponse.json({ error: 'Log non trovato' }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Form data non valido' }, { status: 400 });

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Tipo file non supportato (solo JPEG, PNG, PDF)' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'File troppo grande (max 10 MB)' }, { status: 400 });
  }

  const ext = file.type === 'application/pdf' ? '.pdf' : '.' + file.type.split('/')[1];
  const safeName = `${crypto.randomUUID()}${ext}`;

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, safeName);
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

  const relativePath = `/uploads/${safeName}`;

  // Update the log with the attachment path
  db.prepare('UPDATE logs SET attachment_path = ? WHERE id = ?').run(relativePath, logId);

  return NextResponse.json({ ok: true, path: relativePath });
}
