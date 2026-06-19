import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function toDateString(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Aggiunge `months` mesi a una data ISO (yyyy-MM-dd) e ritorna ISO. */
export function addMonthsIso(iso: string, months: number): string {
  return toDateString(addMonths(parseISO(iso), months));
}

export function formatDateIt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso.length > 10 ? iso.slice(0, 10) : iso), 'd MMM yyyy', { locale: it });
  } catch {
    return iso;
  }
}

export function formatDateLongIt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso.length > 10 ? iso.slice(0, 10) : iso), 'EEEE d MMMM yyyy', { locale: it });
  } catch {
    return iso;
  }
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    return differenceInCalendarDays(parseISO(iso.slice(0, 10)), new Date());
  } catch {
    return null;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) return '—';
  return new Intl.NumberFormat('it-IT').format(km) + ' km';
}

/** Restituisce l'inizio del mese corrente come ISO (yyyy-MM-01). */
export function monthStart(date = new Date()): string {
  return format(date, 'yyyy-MM-01');
}

/** Etichetta tipo "tra 3 mesi" / "tra 12 giorni" / "scaduto da 2 giorni". */
export function relativeDue(iso: string | null | undefined): string {
  const d = daysUntil(iso);
  if (d === null) return '';
  if (d === 0) return 'oggi';
  if (d > 0) {
    if (d === 1) return 'domani';
    if (d < 31) return `tra ${d} giorni`;
    const months = Math.round(d / 30);
    if (months < 24) return `tra ${months} ${months === 1 ? 'mese' : 'mesi'}`;
    return `tra ${Math.round(months / 12)} anni`;
  }
  const ad = Math.abs(d);
  if (ad === 1) return 'scaduto ieri';
  if (ad < 31) return `scaduto da ${ad} giorni`;
  const months = Math.round(ad / 30);
  return `scaduto da ${months} ${months === 1 ? 'mese' : 'mesi'}`;
}
