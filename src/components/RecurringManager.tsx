'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/format';

interface Recurring {
  id: string;
  label: string;
  amount: number;
  category: string;
  day_of_month: number;
  active: number;
}

export default function RecurringManager({
  recurring,
  expenseCategories,
}: {
  recurring: Recurring[];
  expenseCategories: string[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(expenseCategories[0] ?? 'Altro');
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(amount.replace(',', '.'));
    if (!val) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label, amount: val, category, dayOfMonth: day }),
      });
      const data = await res.json();
      if (res.ok) {
        setLabel('');
        setAmount('');
        setMsg('Spesa ricorrente aggiunta ✓');
        router.refresh();
      } else {
        setMsg(data.error || 'Errore');
      }
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, action: 'toggle' | 'delete') {
    if (action === 'delete' && !confirm('Eliminare questa spesa ricorrente?')) return;
    await fetch('/api/recurring', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-slate-800">Spese ricorrenti / Abbonamenti</h2>
      {recurring.length === 0 ? (
        <p className="text-sm text-slate-500">Nessuna spesa ricorrente.</p>
      ) : (
        <ul className="space-y-2">
          {recurring.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${r.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                  {r.label}
                </p>
                <p className="text-xs text-slate-500">
                  {r.category} · {formatCurrency(r.amount)} · giorno {r.day_of_month}
                </p>
              </div>
              <button onClick={() => patch(r.id, 'toggle')} className="text-xs text-brand-600 hover:underline">
                {r.active ? 'pausa' : 'riattiva'}
              </button>
              <button onClick={() => patch(r.id, 'delete')} className="text-xs text-red-400 hover:text-red-600">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-3 border-t border-slate-100 pt-3">
        <p className="text-xs font-medium text-slate-500">Nuova spesa ricorrente</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Descrizione</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Netflix, Affitto…" required />
          </div>
          <div>
            <label className="label">Importo (€)</label>
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {expenseCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Giorno del mese</label>
            <input className="input" type="number" min={1} max={28} value={day} onChange={(e) => setDay(Number(e.target.value))} />
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? '…' : 'Aggiungi'}
        </button>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
      </form>
    </div>
  );
}
