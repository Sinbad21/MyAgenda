# 🗓️ MyAgenda

Web app full-stack che funge da **diario personale + sistema di reminder intelligenti + tracker finanziario personale**. Registra eventi (acquisti, manutenzioni, appuntamenti, spese…) tramite **form guidati** o tramite una **chat AI in linguaggio naturale**, e ricevi promemoria automatici, insight sulle spese e analisi del budget.

Tutta l'interfaccia è in **italiano**, con un design pulito, minimal e orientato alla produttività. L'app è una **PWA** installabile e responsive.

---

## ✨ Funzionalità

- **Log / Promemoria** — registra eventi con titolo, categoria, data, note e trigger reminder.
- **Reminder smart**
  - Intervalli suggeriti automaticamente da una **knowledge base** estendibile (`src/lib/knowledge-base.ts`).
  - Trigger a **chilometraggio** per i veicoli (scatta alla prima condizione tra tempo e km).
  - Reminder personalizzati e **ricorrenti**.
  - Pulsante **"Fatto ✓"** → crea automaticamente un nuovo log e rischedula il successivo se ricorrente.
- **Notifiche multi-canale** — push del browser (Web Push/VAPID), email (SMTP), badge in-app. Anticipo configurabile.
- **Categorie** predefinite con icone + categorie personalizzate.
- **Multi-utente & condivisione** — auth con email/password (JWT httpOnly), condivisione categorie via email.
- **Dashboard** — reminder in scadenza/scaduti, timeline storico, riepilogo per categoria, widget spese mensili.
- **Wizard guidato** a 4 step per creare eventi.
- **Chat AI** — inserimento in linguaggio naturale tramite **Anthropic Claude** (configurabile). Estrae intent + entità e crea log / reminder / spese, con insight contestuali. **Fallback a regole** integrato: la chat funziona anche senza chiave API.
- **Spese & Budget** — tracciamento spese, balance mensile con grafici, budget per categoria con alert al 75% / 100%, insight automatici.

---

## 🧱 Stack tecnico

| Livello | Tecnologia |
|---|---|
| Frontend & Backend | **Next.js 14** (App Router, React 18, TypeScript) |
| Stile | **Tailwind CSS** |
| Database | **SQLite** via `better-sqlite3` (prototipo; sostituibile con Postgres) |
| Auth | **JWT** firmati (`jose`) in cookie **httpOnly**, password con `bcryptjs` |
| LLM | **Anthropic Claude** (`@anthropic-ai/sdk`), modello e chiave via env |
| Notifiche | **web-push** (VAPID) + **nodemailer** (SMTP) |
| Scheduling | API route `/api/cron` (Vercel Cron) o `npm run cron` |
| PWA | `manifest.webmanifest` + service worker (`public/sw.js`) |

---

## 🚀 Avvio in locale

```bash
# 1. Installa le dipendenze
npm install

# 2. Configura l'ambiente
cp .env.example .env
#   - imposta almeno AUTH_SECRET
#   - (opzionale) ANTHROPIC_API_KEY per la chat AI con Claude
#   - (opzionale) chiavi VAPID per le push:  npx web-push generate-vapid-keys
#   - (opzionale) credenziali SMTP per le email

# 3. (opzionale) inizializza il DB
npm run db:init

# 4. Avvia in sviluppo
npm run dev
# apri http://localhost:3000  →  registrati e inizia
```

### Job dei reminder

```bash
npm run cron          # processa i reminder scaduti/in scadenza e invia le notifiche
```

L'endpoint `/api/cron` (protetto da `CRON_SECRET`) processa i promemoria:

- **Appuntamenti con orario** (`due_time`) → notifica **all'ora esatta** (finestra
  configurabile con `REMINDER_LEAD_MINUTES` / `REMINDER_GRACE_MINUTES`, fuso
  `APP_TIMEZONE`, default `Europe/Rome`).
- **Promemoria a giornata / km** → notifica dal mattino (`REMINDER_MORNING_HOUR`).

Per scattare all'ora giusta il cron deve girare **ogni minuto**:

- **Cloudflare Pages** non ha cron trigger → usa il Worker schedulato in
  [`workers/reminder-cron/`](workers/reminder-cron/README.md) (ogni minuto chiama
  `/api/cron`).
- **Vercel**: `vercel.json` schedula `/api/cron` (di default una volta al giorno;
  alza la frequenza per le notifiche orarie).

---

## 🔧 Variabili d'ambiente principali

Vedi `.env.example` per l'elenco completo.

| Variabile | Descrizione |
|---|---|
| `AUTH_SECRET` | Segreto per firmare i JWT di sessione (**obbligatorio**) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login con Google (opzionale → senza, il pulsante non compare) |
| `ANTHROPIC_API_KEY` | Chiave Claude per la chat AI (opzionale → fallback a regole) |
| `ANTHROPIC_MODEL` | Modello Claude (default `claude-opus-4-8`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Invio email (senza → email simulate nei log) |
| `CRON_SECRET` | Protegge l'endpoint `/api/cron` |
| `APP_TIMEZONE` | Fuso per gli orari dei promemoria (default `Europe/Rome`) |
| `REMINDER_LEAD_MINUTES` / `REMINDER_GRACE_MINUTES` | Anticipo / tolleranza notifica appuntamenti |
| `NEXT_PUBLIC_APP_URL` | URL pubblico usato nei link di notifiche ed email |

### 🔑 Login con Google

1. **Google Cloud Console** → *API e servizi → Credenziali → Crea credenziali → ID client OAuth → Applicazione web*.
2. Aggiungi gli **URI di reindirizzamento autorizzati**:
   - `http://localhost:3000/api/auth/google/callback` (sviluppo)
   - `https://<tuo-dominio>/api/auth/google/callback` (produzione)
3. Imposta `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`:
   - locale: in `.dev.vars` (per `wrangler pages dev`) o `.env` (per `next dev`);
   - produzione: nelle variabili d'ambiente del progetto **Cloudflare Pages**.
4. Applica la migration che aggiunge la colonna `google_id`:
   ```bash
   npx wrangler d1 execute myagenda-db --remote --file=migrations/0004_add_google_oauth.sql
   # in locale aggiungi --local
   ```

Il flusso è *Authorization Code*: gli account vengono collegati per **email** (se esiste già
un utente con quella email, l'accesso Google lo riusa). Gli utenti Google non hanno password.

---

## 🗂️ Struttura

```
src/
├─ ai/                 # Integrazione LLM (config, system prompt separato, parser+fallback)
├─ app/
│  ├─ (app)/           # Pagine protette: dashboard, nuovo, logs, spese, impostazioni
│  ├─ api/             # Route handlers REST (auth, logs, reminders, expenses, chat, cron…)
│  ├─ login / register # Autenticazione
│  └─ layout.tsx       # Layout root + PWA
├─ components/         # Componenti UI (wizard, chat, card reminder, form…)
└─ lib/                # Dominio: db, reminders, expenses, knowledge-base, queries…
```

> La **knowledge base** degli intervalli tipici e il **system prompt** dell'LLM sono in file
> separati e facilmente estendibili (`src/lib/knowledge-base.ts`, `src/ai/system-prompt.ts`).

---

## 📦 Fasi implementate

- **Fase 1** — Log eventi + reminder temporali, notifiche in-app/email, completamento con log automatico ✅
- **Fase 2** — Modulo spese, balance mensile con grafici, budget + alert ✅
- **Fase 3** — Chat AI (Claude) con inserimento in linguaggio naturale e insight ✅
- **Fase 4** — Trigger km, condivisione multi-utente, PWA + push, cron reminder ✅
