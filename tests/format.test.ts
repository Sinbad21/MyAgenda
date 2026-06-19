import { describe, it, expect } from 'vitest';
import { daysUntil, formatDateIt, formatCurrency, relativeDue, addMonthsIso, todayIso } from '../src/lib/format';

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
