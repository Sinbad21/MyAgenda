'use client';

import { useEffect, useRef, useState } from 'react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    postcode?: string;
  };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function LocationPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    onChange(val);
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.trim().length < 3) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=6&addressdetails=1&accept-language=it`;
        const res = await fetch(url, { headers: { 'User-Agent': 'MyAgenda/1.0 (personal-app)' } });
        const data: NominatimResult[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);
  }

  function selectResult(r: NominatimResult) {
    const addr = r.address;
    let formatted = '';
    if (addr) {
      const road = addr.road
        ? addr.house_number
          ? `${addr.road}, ${addr.house_number}`
          : addr.road
        : null;
      const city = addr.city || addr.town || addr.village || addr.suburb;
      const parts = [road, addr.postcode, city].filter(Boolean);
      formatted = parts.join(' – ');
    }
    if (!formatted) formatted = r.display_name.split(',').slice(0, 2).join(',').trim();
    setQuery(formatted);
    onChange(formatted);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📍</span>
        <input
          className="input pl-8 pr-8"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Via, piazza o nome del posto…"
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 animate-spin">⟳</span>
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => { setQuery(''); onChange(''); setResults([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map((r) => {
            const addr = r.address;
            const road = addr?.road
              ? addr.house_number
                ? `${addr.road}, ${addr.house_number}`
                : addr.road
              : r.display_name.split(',')[0];
            const city = addr?.city || addr?.town || addr?.village || addr?.suburb;
            return (
              <li key={r.place_id}>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-brand-50 transition-colors"
                  onClick={() => selectResult(r)}
                >
                  <div className="font-medium text-slate-800 truncate">{road}</div>
                  {(addr?.postcode || city) && (
                    <div className="text-xs text-slate-500 truncate">
                      {[addr?.postcode, city].filter(Boolean).join(' ')}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

