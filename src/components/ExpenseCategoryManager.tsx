'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Cat {
  id: string;
  name: string;
  icon: string;
  is_default: number;
}

export default function ExpenseCategoryManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      const data = await res.json();
      if (res.ok) {
        setName('');
        setMsg('Categoria aggiunta ✓');
        router.refresh();
      } else {
        setMsg(data.error || 'Errore');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Eliminare questa categoria?')) return;
    await fetch('/api/expense-categories', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-slate-800">Categorie di spesa</h2>
      <ul className="space-y-1">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-slate-50">
            <span className="text-sm">
              {c.icon} {c.name}
              {c.is_default ? <span className="ml-1 text-xs text-slate-400">(predefinita)</span> : null}
            </span>
            {!c.is_default && (
              <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:text-red-600">
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex items-end gap-2 border-t border-slate-100 pt-3">
        <div className="flex-1">
          <label className="label">Nome categoria</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Palestra"
            required
          />
        </div>
        <div style={{ width: 70 }}>
          <label className="label">Icona</label>
          <input className="input text-center" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
        </div>
        <button className="btn-primary shrink-0" disabled={busy}>
          {busy ? '…' : 'Aggiungi'}
        </button>
      </form>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
