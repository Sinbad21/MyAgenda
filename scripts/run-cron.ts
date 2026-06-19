/**
 * Esegue tutti i job pianificati: notifiche reminder, spese ricorrenti, digest email.
 * Uso: npm run cron   (oppure schedulalo con cron di sistema / Vercel Cron)
 */
import { runCron } from '../src/lib/cron';

runCron()
  .then((r) => {
    console.log('✅ Cron completato:', JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Errore cron:', err);
    process.exit(1);
  });
