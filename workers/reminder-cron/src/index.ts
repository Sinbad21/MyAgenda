/// <reference types="@cloudflare/workers-types" />

/**
 * Worker schedulato che "sveglia" l'app MyAgenda chiamando l'endpoint /api/cron.
 * Necessario perché Cloudflare Pages non supporta i cron trigger: questo Worker
 * separato gira ogni minuto (vedi wrangler.toml) e processa i promemoria in scadenza,
 * così le notifiche degli appuntamenti scattano all'orario giusto.
 *
 * Variabili richieste:
 *   CRON_URL    (var)    es. https://myagenda.pages.dev/api/cron
 *   CRON_SECRET (secret) stesso valore della variabile CRON_SECRET dell'app Pages
 */
export interface Env {
  CRON_URL: string;
  CRON_SECRET?: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.CRON_URL) {
      console.error('[reminder-cron] CRON_URL non configurato');
      return;
    }
    const headers: Record<string, string> = {};
    if (env.CRON_SECRET) headers.Authorization = `Bearer ${env.CRON_SECRET}`;

    ctx.waitUntil(
      fetch(env.CRON_URL, { method: 'POST', headers })
        .then(async (res) => {
          if (!res.ok) {
            console.error('[reminder-cron] HTTP', res.status, (await res.text()).slice(0, 200));
          }
        })
        .catch((err) => console.error('[reminder-cron] errore fetch:', err))
    );
  },
};
