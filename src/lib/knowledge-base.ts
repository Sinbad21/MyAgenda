/**
 * Knowledge base degli intervalli tipici per i reminder (§2A).
 *
 * File volutamente separato e facilmente estendibile: aggiungi una voce
 * all'array `KNOWLEDGE_BASE` per insegnare all'app un nuovo intervallo.
 *
 * `months` = intervallo suggerito espresso in mesi.
 * `keywords` = parole chiave (lowercase, senza accenti) cercate nel titolo.
 * `kind` = categoria di riferimento (vedi CATEGORY_KINDS).
 */

export type CategoryKind =
  | 'vehicles'
  | 'health'
  | 'home'
  | 'shopping'
  | 'pets'
  | 'general';

export interface KnowledgeEntry {
  keywords: string[];
  kind: CategoryKind;
  label: string;
  months: number;
  /** Se true, il reminder è tipicamente ricorrente. */
  recurring?: boolean;
}

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ── Veicoli ──────────────────────────────────────────────
  { keywords: ['tagliando', 'tagliando auto', 'service'], kind: 'vehicles', label: 'Tagliando', months: 12, recurring: true },
  { keywords: ['cambio olio', 'olio motore', 'olio'], kind: 'vehicles', label: 'Cambio olio', months: 12, recurring: true },
  { keywords: ['revisione', 'revisione auto'], kind: 'vehicles', label: 'Revisione', months: 24, recurring: true },
  { keywords: ['bollo', 'bollo auto'], kind: 'vehicles', label: 'Bollo auto', months: 12, recurring: true },
  { keywords: ['assicurazione', 'rca', 'polizza auto'], kind: 'vehicles', label: 'Assicurazione', months: 12, recurring: true },
  { keywords: ['pneumatici', 'gomme', 'pneumatico'], kind: 'vehicles', label: 'Cambio pneumatici', months: 48, recurring: true },
  { keywords: ['gomme invernali', 'gomme estive', 'cambio stagionale'], kind: 'vehicles', label: 'Cambio gomme stagionale', months: 6, recurring: true },
  { keywords: ['pastiglie', 'freni', 'pastiglie freni'], kind: 'vehicles', label: 'Pastiglie freni', months: 24, recurring: true },
  { keywords: ['cinghia distribuzione', 'distribuzione'], kind: 'vehicles', label: 'Cinghia di distribuzione', months: 60 },

  // ── Salute ───────────────────────────────────────────────
  { keywords: ['dentista', 'igiene dentale', 'pulizia denti'], kind: 'health', label: 'Visita dentistica', months: 6, recurring: true },
  { keywords: ['oculista', 'controllo oculistico', 'vista'], kind: 'health', label: 'Controllo oculistico', months: 24, recurring: true },
  { keywords: ['dermatologo', 'nei', 'mappatura nei'], kind: 'health', label: 'Controllo dermatologico', months: 12, recurring: true },
  { keywords: ['esami sangue', 'analisi sangue', 'analisi'], kind: 'health', label: 'Analisi del sangue', months: 12, recurring: true },
  { keywords: ['visita generale', 'check up', 'checkup'], kind: 'health', label: 'Check-up generale', months: 12, recurring: true },
  { keywords: ['cardiologo', 'visita cardiologica', 'cuore'], kind: 'health', label: 'Visita cardiologica', months: 12, recurring: true },
  { keywords: ['vaccino', 'richiamo', 'antinfluenzale'], kind: 'health', label: 'Vaccino / richiamo', months: 12, recurring: true },

  // ── Casa ─────────────────────────────────────────────────
  { keywords: ['caldaia', 'manutenzione caldaia', 'revisione caldaia'], kind: 'home', label: 'Manutenzione caldaia', months: 12, recurring: true },
  { keywords: ['condizionatore', 'climatizzatore', 'filtri condizionatore'], kind: 'home', label: 'Pulizia condizionatore', months: 12, recurring: true },
  { keywords: ['estintore'], kind: 'home', label: 'Revisione estintore', months: 6, recurring: true },
  { keywords: ['filtro acqua', 'depuratore', 'addolcitore'], kind: 'home', label: 'Cambio filtro acqua', months: 6, recurring: true },
  { keywords: ['cappa', 'filtro cappa'], kind: 'home', label: 'Filtro cappa cucina', months: 3, recurring: true },
  { keywords: ['imbianchino', 'tinteggiatura', 'imbiancare'], kind: 'home', label: 'Tinteggiatura', months: 60 },
  { keywords: ['materasso'], kind: 'shopping', label: 'Sostituzione materasso', months: 96 },

  // ── Acquisti / garanzie ──────────────────────────────────
  { keywords: ['garanzia'], kind: 'shopping', label: 'Scadenza garanzia', months: 24 },
  { keywords: ['frigorifero', 'frigo'], kind: 'shopping', label: 'Frigorifero (garanzia)', months: 24 },
  { keywords: ['lavatrice'], kind: 'shopping', label: 'Lavatrice (garanzia)', months: 24 },
  { keywords: ['spazzolino', 'testine spazzolino'], kind: 'shopping', label: 'Testine spazzolino', months: 3, recurring: true },
  { keywords: ['scarpe running', 'scarpe corsa'], kind: 'shopping', label: 'Scarpe da corsa', months: 12 },

  // ── Animali ──────────────────────────────────────────────
  { keywords: ['vaccino cane', 'vaccino gatto', 'vaccinazione'], kind: 'pets', label: 'Vaccino animale', months: 12, recurring: true },
  { keywords: ['antipulci', 'antiparassitario', 'pipetta'], kind: 'pets', label: 'Antiparassitario', months: 1, recurring: true },
  { keywords: ['vermifugo', 'sverminazione'], kind: 'pets', label: 'Vermifugo', months: 3, recurring: true },
  { keywords: ['veterinario', 'visita veterinaria'], kind: 'pets', label: 'Visita veterinaria', months: 12, recurring: true },
  { keywords: ['toelettatura', 'tolettatura'], kind: 'pets', label: 'Toelettatura', months: 2, recurring: true },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export interface IntervalSuggestion {
  months: number;
  label: string;
  recurring: boolean;
  source: 'knowledge-base' | 'category-default';
}

/** Intervallo di default (mesi) quando non c'è un match specifico. */
const KIND_DEFAULT_MONTHS: Record<CategoryKind, number> = {
  vehicles: 12,
  health: 12,
  home: 12,
  shopping: 24,
  pets: 12,
  general: 12,
};

/**
 * Suggerisce un intervallo a partire dal titolo dell'evento e dalla
 * categoria. Restituisce il match più specifico (più parole chiave coincidenti).
 */
export function suggestInterval(
  title: string,
  kind: CategoryKind = 'general'
): IntervalSuggestion {
  const t = normalize(title);
  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of KNOWLEDGE_BASE) {
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      const idx = t.indexOf(k);
      if (idx !== -1) {
        // più specifico = parola chiave più lunga; bonus se è la prima parola
        // del titolo (più saliente) e se la categoria coincide.
        const score = k.length + (entry.kind === kind ? 5 : 0) + (idx === 0 ? 8 : 0);
        if (!best || score > best.score) best = { entry, score };
      }
    }
  }

  if (best) {
    return {
      months: best.entry.months,
      label: best.entry.label,
      recurring: !!best.entry.recurring,
      source: 'knowledge-base',
    };
  }

  return {
    months: KIND_DEFAULT_MONTHS[kind] ?? 12,
    label: 'Intervallo predefinito',
    recurring: false,
    source: 'category-default',
  };
}
