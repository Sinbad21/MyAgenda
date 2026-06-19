import Anthropic from '@anthropic-ai/sdk';
import { aiConfig } from './config';
import { buildSystemPrompt, type PromptContext } from './system-prompt';
import { suggestInterval } from '@/lib/knowledge-base';
import { addMonthsIso, todayIso } from '@/lib/format';

export type ChatAction =
  | { type: 'expense'; amount: number; expense_category: string; note?: string; date?: string }
  | {
      type: 'log';
      title: string;
      category_kind?: string;
      notes?: string;
      date?: string;
      create_reminder?: boolean;
      interval_months?: number | null;
      recurring?: boolean;
    }
  | { type: 'reminder'; title: string; date?: string; interval_months?: number | null; recurring?: boolean }
  | { type: 'update_km'; km: number; vehicle_name?: string };

export interface ParsedResult {
  reply: string;
  needs_clarification: boolean;
  actions: ChatAction[];
  source: 'llm' | 'rules';
}

/** Punto d'ingresso: usa Claude se configurato, altrimenti il parser a regole. */
export async function interpretMessage(text: string, ctx: PromptContext): Promise<ParsedResult> {
  if (aiConfig.enabled) {
    try {
      return await interpretWithClaude(text, ctx);
    } catch (err) {
      console.error('[assistant] LLM error, uso fallback a regole:', err);
    }
  }
  return ruleBasedParse(text, ctx);
}

// ── Claude ───────────────────────────────────────────────────────────────
async function interpretWithClaude(text: string, ctx: PromptContext): Promise<ParsedResult> {
  const client = new Anthropic({ apiKey: aiConfig.apiKey });
  const system = buildSystemPrompt(ctx);

  const response = await client.messages.create({
    model: aiConfig.model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: text }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const parsed = extractJson(raw);
  if (!parsed) throw new Error('Risposta LLM non in JSON: ' + raw.slice(0, 200));

  return {
    reply: typeof parsed.reply === 'string' ? parsed.reply : 'Fatto.',
    needs_clarification: !!parsed.needs_clarification,
    actions: Array.isArray(parsed.actions) ? (parsed.actions as ChatAction[]) : [],
    source: 'llm',
  };
}

/** Estrae il primo oggetto JSON dal testo (tollerante a code fence). */
function extractJson(text: string): any | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ── Parser a regole (fallback senza API key) ───────────────────────────────
const WEEKDAYS: Record<string, number> = {
  domenica: 0, lunedi: 1, martedi: 2, mercoledi: 3, giovedi: 4, venerdi: 5, sabato: 6,
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseAmount(text: string): number | null {
  // cerca "40,44", "40.44", "799", "1.299,90"
  const m = text.match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)?/i);
  if (!m) return null;
  let n = m[1].replace(/\s/g, '');
  if (n.includes(',')) n = n.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(n);
  return isNaN(val) ? null : val;
}

function guessExpenseCategory(t: string): string {
  if (/(benzina|gasolio|carburante|diesel|autostrada|pedaggio|parcheggio|treno|bus|metro|taxi)/.test(t)) return 'Trasporti';
  if (/(spesa|supermercato|cibo|aliment|pane|frutta|verdura|carne|ristorante.*pranzo)/.test(t)) return 'Alimentari';
  if (/(farmacia|medico|dottore|dentista|visita|medicin|ticket)/.test(t)) return 'Salute';
  if (/(bolletta|affitto|luce|gas|acqua|condominio|casa|mutuo|idraulico|elettricista)/.test(t)) return 'Casa';
  if (/(cinema|ristorante|pizza|bar|concerto|netflix|svago|vacanz|hotel)/.test(t)) return 'Svago';
  return 'Altro';
}

function relativeDate(t: string): string | null {
  if (/\boggi\b/.test(t)) return todayIso();
  if (/\bdomani\b/.test(t)) return addDaysIso(todayIso(), 1);
  if (/\bdopodomani\b/.test(t)) return addDaysIso(todayIso(), 2);
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp('\\b' + name).test(t)) return nextWeekday(dow);
  }
  return null;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextWeekday(target: number): string {
  const d = new Date();
  const diff = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Parser euristico in italiano. Copre i casi tipici (spese, appuntamenti,
 * manutenzioni veicolo) così la chat funziona anche senza chiave API.
 */
export function ruleBasedParse(text: string, _ctx: PromptContext): ParsedResult {
  const t = normalize(text);
  const actions: ChatAction[] = [];

  // 1) Aggiornamento km: "ho fatto 145000 km", "chilometraggio 145000"
  const kmMatch = t.match(/(\d{4,7})\s*km|km\s*(\d{4,7})|chilometragg\w*\s*(?:a|di)?\s*(\d{4,7})/);
  if (kmMatch && /(km|chilometr)/.test(t) && /(aggiorn|ora sono|attual|segna|fatto)/.test(t)) {
    const km = parseInt(kmMatch[1] || kmMatch[2] || kmMatch[3], 10);
    actions.push({ type: 'update_km', km });
    return { reply: `Chilometraggio aggiornato a ${km.toLocaleString('it-IT')} km.`, needs_clarification: false, actions, source: 'rules' };
  }

  // 2) Spesa: presenza di "spes/comprat/pagat/euro/€"
  const isExpense = /(spes|comprat|pagat|costato|€|euro)/.test(t);
  const amount = parseAmount(text);

  // 3) Appuntamento futuro: "domani/lunedì... ho/visita/appuntamento"
  const date = relativeDate(t);
  const isAppointment = /(appuntamento|visita|ho il|ho la|dentista|medico|controllo)/.test(t) && !!date && date > todayIso();

  // 4) Manutenzione veicolo: tagliando/olio/revisione...
  const isVehicleMaint = /(tagliando|cambio olio|revision|pastiglie|gomme|pneumatic|filtro)/.test(t);

  if (isVehicleMaint) {
    const sugg = suggestInterval(text, 'vehicles');
    const title = capitalize(extractTitle(text) || sugg.label);
    actions.push({
      type: 'log',
      title,
      category_kind: 'vehicles',
      notes: text,
      date: todayIso(),
      create_reminder: true,
      interval_months: sugg.months,
      recurring: sugg.recurring,
    });
    if (amount && isExpense) {
      actions.push({ type: 'expense', amount, expense_category: 'Trasporti', note: 'Manutenzione veicolo', date: todayIso() });
    }
    const next = addMonthsIso(todayIso(), sugg.months);
    return {
      reply: `Registrato: ${title}. Prossimo promemoria tra ${sugg.months} mesi (${next}).`,
      needs_clarification: false,
      actions,
      source: 'rules',
    };
  }

  if (isAppointment && date) {
    const title = capitalize(cleanAppointmentTitle(extractTitle(text)) || 'Appuntamento');
    actions.push({ type: 'reminder', title, date, interval_months: null, recurring: false });
    return { reply: `Promemoria creato: ${title} il ${date}.`, needs_clarification: false, actions, source: 'rules' };
  }

  if (isExpense) {
    if (amount == null) {
      return { reply: 'Quanto hai speso? Dimmi l\'importo e lo registro.', needs_clarification: true, actions: [], source: 'rules' };
    }
    const cat = guessExpenseCategory(t);
    const note = extractTitle(text) || 'Spesa';
    actions.push({ type: 'expense', amount, expense_category: cat, note, date: todayIso() });
    // acquisto di un bene durevole → anche un log con garanzia
    if (/(comprat|acquist)/.test(t) && amount >= 100) {
      const sugg = suggestInterval(text, 'shopping');
      actions.push({
        type: 'log', title: capitalize(note), category_kind: 'shopping', notes: text, date: todayIso(),
        create_reminder: true, interval_months: sugg.months, recurring: false,
      });
    }
    return { reply: `Spesa registrata: ${note} ${amount.toFixed(2).replace('.', ',')} € (${cat}).`, needs_clarification: false, actions, source: 'rules' };
  }

  // 5) Log generico
  const title = capitalize(extractTitle(text) || text.slice(0, 40));
  actions.push({ type: 'log', title, category_kind: 'general', notes: text, date: todayIso(), create_reminder: false });
  return { reply: `Annotato: ${title}.`, needs_clarification: false, actions, source: 'rules' };
}

function extractTitle(text: string): string {
  // prende le parole dopo "comprato/speso ... di/per X" o la prima frase utile
  const m = text.match(/(?:di|per|comprato il|comprato la|comprato|acquistato)\s+([a-zà-ù0-9\s]{2,40})/i);
  if (m) return m[1].replace(/\b(euro|eur)\b.*/i, '').trim();
  return text.split(/[,.;:]/)[0].trim();
}

function cleanAppointmentTitle(s: string): string {
  return s
    .replace(/^\s*(oggi|domani|dopodomani|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)\b/i, '')
    .replace(/^\s*(ho|c'?ho|c'?[eè])\s+(un|una|il|lo|la|l'|gli|i)\s*/i, '')
    .replace(/\balle?\s*\d{1,2}([:.]\d{2})?\b.*/i, '')
    .trim();
}

function capitalize(s: string): string {
  s = s.trim();
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
