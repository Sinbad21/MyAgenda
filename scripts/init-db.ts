/**
 * Inizializza il database SQLite (crea le tabelle se non esistono).
 * Uso: npm run db:init
 */
import { getDb } from '../src/lib/db';

const db = getDb();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('✅ Database inizializzato. Tabelle:', tables.map((t: any) => t.name).join(', '));
