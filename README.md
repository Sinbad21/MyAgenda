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

In produzione su Vercel il file `vercel.json` schedula `/api/cron` ogni giorno alle 8:00
(protetto da `CRON_SECRET`).

---

## 🔧 Variabili d'ambiente principali

Vedi `.env.example` per l'elenco completo.

| Variabile | Descrizione |
|---|---|
| `AUTH_SECRET` | Segreto per firmare i JWT di sessione (**obbligatorio**) |
| `ANTHROPIC_API_KEY` | Chiave Claude per la chat AI (opzionale → fallback a regole) |
| `ANTHROPIC_MODEL` | Modello Claude (default `claude-opus-4-8`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Invio email (senza → email simulate nei log) |
| `CRON_SECRET` | Protegge l'endpoint `/api/cron` |

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
