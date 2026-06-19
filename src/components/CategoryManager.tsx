'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Cat {
  id: string;
  name: string;
  icon: string;
  is_default: number;
}

const KINDS = [
  { value: 'general', label: 'Generale' },
  { value: 'vehicles', label: 'Veicoli' },
  { value: 'health', label: 'Salute' },
  { value: 'home', label: 'Casa' },
  { value: 'shopping', label: 'Acquisti' },
  { value: 'pets', label: 'Animali' },
];

export default function CategoryManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [kind, setKind] = useState('general');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, icon, kind }),
      });
      setName('');
      setIcon('🏷️');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="mb-3 font-semibold text-slate-800">🏷️ Categorie personalizzate</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c.id} className="chip bg-slate-100 text-slate-700">
            {c.icon} {c.name}
            {c.is_default ? '' : ' ✨'}
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <input className="input w-16 text-center" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
        <input
          className="input flex-1"
          placeholder="Nome categoria"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select className="input w-32" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <button className="btn-primary px-3" disabled={busy}>
          Aggiungi
        </button>
      </form>
    </div>
  );
}
