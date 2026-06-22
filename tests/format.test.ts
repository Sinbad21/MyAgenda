import { describe, it, expect } from 'vitest';
import {
  daysUntil, formatDateIt, formatCurrency, relativeDue, addMonthsIso, todayIso,
  zonedWallTimeToUtc, minutesUntilAppointment,
} from '../src/lib/format';

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    expect(daysUntil(todayIso())).toBe(0);
  });

  it('returns positive for future dates', () => {
    const future = addMonthsIso(todayIso(), 1);
    expect(daysUntil(future)!).toBeGreaterThan(0);
  });

  it('returns negative for past dates', () => {
    const past = addMonthsIso(todayIso(), -1);
    expect(daysUntil(past)!).toBeLessThan(0);
  });

  it('returns null for null input', () => {
    expect(daysUntil(null)).toBeNull();
  });
});

describe('addMonthsIso', () => {
  it('adds months correctly', () => {
    const result = addMonthsIso('2024-01-15', 3);
    expect(result).toBe('2024-04-15');
  });

  it('handles end of year', () => {
    const result = addMonthsIso('2024-10-01', 3);
    expect(result).toBe('2025-01-01');
  });
});

describe('relativeDue', () => {
  it('says oggi for today', () => {
    expect(relativeDue(todayIso())).toBe('oggi');
  });

  it('says domani for tomorrow', () => {
    const tomorrow = addMonthsIso(todayIso(), 0);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    expect(relativeDue(iso)).toBe('domani');
  });

  it('returns empty string for null', () => {
    expect(relativeDue(null)).toBe('');
  });
});

describe('zonedWallTimeToUtc (Europe/Rome)', () => {
  it('converte l\'ora invernale (UTC+1)', () => {
    // 10:00 a Roma in gennaio = 09:00 UTC
    expect(zonedWallTimeToUtc('2024-01-15', '10:00', 'Europe/Rome').toISOString()).toBe('2024-01-15T09:00:00.000Z');
  });

  it('converte l\'ora legale (UTC+2)', () => {
    // 10:00 a Roma in luglio = 08:00 UTC
    expect(zonedWallTimeToUtc('2024-07-15', '10:00', 'Europe/Rome').toISOString()).toBe('2024-07-15T08:00:00.000Z');
  });
});

describe('minutesUntilAppointment', () => {
  it('è ~0 all\'ora esatta dell\'appuntamento', () => {
    const now = new Date('2024-07-15T08:00:00.000Z'); // = 10:00 a Roma
    expect(minutesUntilAppointment('2024-07-15', '10:00', now, 'Europe/Rome')).toBeCloseTo(0, 5);
  });

  it('è positivo prima e negativo dopo', () => {
    const now = new Date('2024-07-15T08:00:00.000Z');
    expect(minutesUntilAppointment('2024-07-15', '10:30', now, 'Europe/Rome')).toBeCloseTo(30, 5);
    expect(minutesUntilAppointment('2024-07-15', '09:45', now, 'Europe/Rome')).toBeCloseTo(-15, 5);
  });
});

describe('formatDateIt', () => {
  it('formats a date in Italian', () => {
    const s = formatDateIt('2024-03-15');
    expect(s).toContain('15');
    expect(s).toContain('2024');
  });

  it('returns dash for null', () => {
    expect(formatDateIt(null)).toBe('—');
  });
});
