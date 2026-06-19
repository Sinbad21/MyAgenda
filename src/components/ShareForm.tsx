'use client';

import { useState } from 'react';

interface Cat {
  id: string;
  name: string;
  icon: string;
}

export default function ShareForm({ categories }: { categories: Cat[] }) {
  const [resourceId, setResourceId] = useState(categories[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resourceId || !email) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceType: 'category', resourceId, email }),
      });
      const data = await res.json();
      setMsg(
        res.ok
          ? data.linked
            ? 'Categoria condivisa ✓'
            : 'Invito inviato: l\'utente vedrà la categoria registrandosi con questa email.'
          : data.error || 'Errore'
      );
      if (res.ok) setEmail('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold text-slate-800">👥 Condivisione</h2>
      <p className="mb-3 text-xs text-slate-500">Condividi una categoria con partner o coinquilini via email.</p>
      <form onSubmit={submit} className="space-y-2">
        <select className="input" value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            type="email"
            placeholder="email@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary px-3" disabled={busy}>
            Condividi
          </button>
        </div>
      </form>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
