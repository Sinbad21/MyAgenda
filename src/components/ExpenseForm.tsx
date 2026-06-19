'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { todayIso } from '@/lib/format';

export default function ExpenseForm() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Alimentari');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: value, category, date, note }),
      });
      const data = await res.json();
      if (res.ok) {
        setAmount('');
        setNote('');
        if (data.budget && data.budget.level !== 'ok') {
          setMsg(
            `${data.budget.level === 'over' ? '🔴 Budget superato' : '🟠 Attenzione budget'}: ${Math.round(
              data.budget.pct
            )}% di ${category}.`
          );
        } else {
          setMsg('Spesa aggiunta ✓');
        }
        router.refresh();
      } else {
        setMsg(data.error || 'Errore');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold text-slate-800">Aggiungi spesa</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Importo (€)</label>
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            required
          />
        </div>
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Data</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Nota</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opzionale" />
        </div>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? 'Salvataggio…' : 'Aggiungi'}
      </button>
    </form>
  );
}
