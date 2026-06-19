'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: 'log' | 'expense';
  id: string;
  title: string;
  subtitle: string;
  date: string;
  icon: string;
}

export default function RicercaPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(q: string) {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    // Debounce via a simple timeout trick
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => search(val), 350);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ricerca</h1>
        <p className="text-sm text-slate-500">Cerca tra log ed eventi e spese</p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          className="input pl-9"
          placeholder="Cerca per titolo, nota, categoria…"
          value={query}
          onChange={handleChange}
          autoFocus
        />
      </div>

      {loading && <p className="text-sm text-slate-400">Ricerca in corso…</p>}

      {results !== null && results.length === 0 && !loading && (
        <div className="card text-center text-sm text-slate-500">
          Nessun risultato per &ldquo;{query}&rdquo;.
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              href={r.type === 'log' ? '/logs' : '/spese'}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-brand-200 hover:bg-brand-50"
            >
              <span className="text-xl">{r.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{r.title}</p>
                <p className="truncate text-xs text-slate-500">{r.subtitle}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
                <span>{r.date}</span>
                <span className={r.type === 'expense' ? 'text-emerald-600' : 'text-brand-600'}>
                  {r.type === 'log' ? 'Log' : 'Spesa'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
