'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDateIt } from '@/lib/format';

interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  note: string | null;
}

export default function ExpenseRow({
  expense,
  categories,
}: {
  expense: Expense;
  categories: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState(String(expense.amount));
  const [category, setCategory] = useState(expense.category);
  const [date, setDate] = useState(expense.date);
  const [note, setNote] = useState(expense.note ?? '');

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount.replace(',', '.')),
          category,
          date,
          note: note || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Eliminare questa spesa?')) return;
    setBusy(true);
    try {
      await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-brand-50">
        <td className="px-2 py-1">
          <input
            className="input py-0.5 text-xs"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 80 }}
          />
        </td>
        <td className="px-2 py-1">
          <select className="input py-0.5 text-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </td>
        <td className="px-2 py-1">
          <input className="input py-0.5 text-xs" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </td>
        <td className="px-2 py-1">
          <input className="input py-0.5 text-xs" value={note} onChange={(e) => setNote(e.target.value)} />
        </td>
        <td className="px-2 py-1 text-right">
          <button onClick={save} disabled={busy} className="mr-1 rounded bg-brand-600 px-2 py-0.5 text-xs text-white hover:bg-brand-700">
            ✓
          </button>
          <button onClick={() => setEditing(false)} className="rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 text-sm hover:bg-slate-50">
      <td className="px-2 py-1.5 font-medium text-slate-800">{formatCurrency(expense.amount)}</td>
      <td className="px-2 py-1.5 text-slate-600">{expense.category}</td>
      <td className="px-2 py-1.5 text-slate-500">{formatDateIt(expense.date)}</td>
      <td className="max-w-[180px] truncate px-2 py-1.5 text-slate-500">{expense.note ?? '—'}</td>
      <td className="px-2 py-1.5 text-right">
        <button onClick={() => setEditing(true)} className="mr-1 text-xs text-brand-600 hover:underline">
          modifica
        </button>
        <button onClick={remove} disabled={busy} className="text-xs text-red-500 hover:underline">
          elimina
        </button>
      </td>
    </tr>
  );
}
