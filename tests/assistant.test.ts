import { describe, it, expect } from 'vitest';
import { ruleBasedParse } from '../src/ai/assistant';

const ctx = {
  todayIso: new Date().toISOString().slice(0, 10),
  vehicles: [],
  expenseCategories: ['Alimentari', 'Trasporti', 'Salute', 'Casa', 'Svago', 'Altro'] as const,
};

describe('ruleBasedParse (fallback bot)', () => {
  it('registra una spesa di benzina come Trasporti', () => {
    const r = ruleBasedParse('oggi ho speso 40,44 euro di benzina', ctx);
    const exp = r.actions.find((a) => a.type === 'expense') as any;
    expect(exp).toBeTruthy();
    expect(exp.amount).toBeCloseTo(40.44, 2);
    expect(exp.expense_category).toBe('Trasporti');
  });

  it('crea un promemoria con orario da "domani ho il dentista alle 10"', () => {
    const r = ruleBasedParse('domani ho la visita dal dentista alle 10', ctx);
    const rem = r.actions.find((a) => a.type === 'reminder') as any;
    expect(rem).toBeTruthy();
    expect(rem.time).toBe('10:00');
  });

  it('interpreta "15 45 estetista" come promemoria alle 15:45', () => {
    const r = ruleBasedParse('15 45 estetista', ctx);
    const rem = r.actions.find((a) => a.type === 'reminder') as any;
    expect(rem).toBeTruthy();
    expect(rem.time).toBe('15:45');
    expect(String(rem.title).toLowerCase()).toContain('estetista');
  });

  it('NON crea record su una conferma ("si")', () => {
    expect(ruleBasedParse('si', ctx).actions).toHaveLength(0);
  });

  it('NON crea record su una segnalazione di duplicato', () => {
    const r = ruleBasedParse("l'hai creato due volte", ctx);
    expect(r.actions).toHaveLength(0);
  });

  it('chiede chiarimenti se manca l\'importo della spesa', () => {
    const r = ruleBasedParse('ho speso al supermercato', ctx);
    expect(r.needs_clarification).toBe(true);
    expect(r.actions).toHaveLength(0);
  });
});
