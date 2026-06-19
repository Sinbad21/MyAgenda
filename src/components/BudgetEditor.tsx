'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXPENSE_CATEGORIES } from '@/lib/categories';

export default function BudgetEditor({ initial }: { initial: Record<string, number> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const c of EXPENSE_CATEGORIES) v[c] = initial[c] ? String(initial[c]) : '';
    return v;
  });
  const [savingCat, setSavingCat] = useState<string | null>(null);

  async function save(category: string) {
    const limit = Number((values[category] || '0').replace(',', '.'));
    setSavingCat(category);
    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category, monthlyLimit: limit }),
      });
      router.refresh();
    } finally {
      setSavingCat(null);
    }
  }

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold text-slate-800">Budget mensili</h2>
      <p className="mb-3 text-xs text-slate-500">Avviso al 75%, alert al 100% del budget.</p>
      <div className="space-y-2">
        {EXPENSE_CATEGORIES.map((c) => (
          <div key={c} className="flex items-center gap-2">
            <span className="w-24 text-sm text-slate-600">{c}</span>
            <input
              className="input flex-1"
              inputMode="decimal"
              value={values[c]}
              onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value }))}
              placeholder="nessun limite"
            />
            <button onClick={() => save(c)} disabled={savingCat === c} className="btn-ghost px-3 py-1.5 text-xs">
              {savingCat === c ? '…' : 'Salva'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
