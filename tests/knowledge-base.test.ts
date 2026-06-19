import { describe, it, expect } from 'vitest';
import { suggestInterval } from '../src/lib/knowledge-base';

describe('suggestInterval', () => {
  it('riconosce il tagliando auto', () => {
    const s = suggestInterval('Tagliando auto', 'vehicles');
    expect(s).not.toBeNull();
    expect(s!.months).toBe(12);
    expect(s!.recurring).toBe(true);
  });

  it('riconosce la revisione', () => {
    const s = suggestInterval('revisione auto', 'vehicles');
    expect(s).not.toBeNull();
    expect(s!.months).toBe(24);
  });

  it('riconosce la visita dentistica', () => {
    const s = suggestInterval('dentista', 'health');
    expect(s).not.toBeNull();
    expect(s!.months).toBe(6);
    expect(s!.recurring).toBe(true);
  });

  it('non restituisce null per titolo sconosciuto con kind health', () => {
    // per una categoria health, deve restituire il default
    const s = suggestInterval('visita generica sconosciuta', 'health');
    expect(s).not.toBeNull();
    expect(s!.source).toBe('category-default');
  });

  it('caso insensitive e con accenti', () => {
    const s = suggestInterval('Caldàia', 'home');
    expect(s).not.toBeNull();
    expect(s!.months).toBe(12);
  });
});
