# ⏰ myagenda-reminder-cron

Worker Cloudflare schedulato che fa scattare le notifiche dei promemoria.

**Perché serve:** Cloudflare **Pages** non supporta i cron trigger, quindi
l'endpoint `/api/cron` dell'app non verrebbe mai chiamato da solo. Questo Worker
separato gira **ogni minuto** e chiama quell'endpoint, così gli appuntamenti con
orario ricevono la notifica **all'ora giusta**.

## Deploy (una tantum)

Dalla cartella `workers/reminder-cron/`:

```bash
# 1. Imposta l'URL del tuo deploy (modifica wrangler.toml → CRON_URL)
#    es. https://myagenda.pages.dev/api/cron  (o il tuo dominio custom)

# 2. Imposta il secret (stesso valore della var CRON_SECRET dell'app Pages)
npx wrangler secret put CRON_SECRET

# 3. Pubblica il worker (crea anche lo scheduling ogni minuto)
npx wrangler deploy
```

Dopo il deploy, in **Cloudflare Dashboard → Workers & Pages →
`myagenda-reminder-cron` → Settings → Triggers** vedrai il cron `* * * * *`.
Puoi anche testarlo subito con **Trigger Cron** o:

```bash
npx wrangler dev --test-scheduled
# poi in un altro terminale:  curl "http://localhost:8787/__scheduled"
```

## Note

- `CRON_SECRET` deve coincidere con la variabile `CRON_SECRET` impostata
  sull'app Cloudflare Pages: l'endpoint `/api/cron` rifiuta le chiamate non
  autorizzate quando il secret è configurato.
- Se preferisci un anticipo (es. avviso 10 minuti prima), imposta sull'app Pages
  la variabile `REMINDER_LEAD_MINUTES=10` (vedi `.env.example`).
- La frequenza è regolabile cambiando l'espressione cron in `wrangler.toml`
  (es. `*/5 * * * *` per ogni 5 minuti).
