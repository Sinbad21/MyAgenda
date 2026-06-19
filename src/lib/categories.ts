import type { CategoryKind } from './knowledge-base';

/** Categorie predefinite con icone (§4). Create per ogni nuovo utente. */
export interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Veicoli', icon: '🚗', color: '#225aec', kind: 'vehicles' },
  { name: 'Salute', icon: '🏥', color: '#e0567a', kind: 'health' },
  { name: 'Casa', icon: '🏠', color: '#f59e0b', kind: 'home' },
  { name: 'Acquisti', icon: '🛒', color: '#16a34a', kind: 'shopping' },
  { name: 'Animali domestici', icon: '🐾', color: '#9333ea', kind: 'pets' },
  { name: 'Generale', icon: '📋', color: '#64748b', kind: 'general' },
];

/** Categorie di spesa (§9). */
export const EXPENSE_CATEGORIES = [
  'Alimentari',
  'Trasporti',
  'Salute',
  'Casa',
  'Svago',
  'Altro',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_ICONS: Record<string, string> = {
  Alimentari: '🍎',
  Trasporti: '⛽',
  Salute: '💊',
  Casa: '🏠',
  Svago: '🎉',
  Altro: '📦',
};
