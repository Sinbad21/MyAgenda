/**
 * Esegue il job di scheduling dei reminder (notifiche scadute/in scadenza).
 * Uso: npm run cron   (oppure schedulalo con cron di sistema / Vercel Cron)
 */
import { processDueReminders } from '../src/lib/cron';

processDueReminders()
  .then((r) => {
    console.log(`✅ Cron completato. Reminder notificati: ${r.processed}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Errore cron:', err);
    process.exit(1);
  });
