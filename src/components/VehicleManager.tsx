'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatKm } from '@/lib/format';

interface Veh {
  id: string;
  name: string;
  current_km: number;
}

export default function VehicleManager({ vehicles }: { vehicles: Veh[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [km, setKm] = useState('');
  const [kmEdits, setKmEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', name, currentKm: Number(km) || 0 }),
      });
      setName('');
      setKm('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateKm(id: string) {
    const value = Number(kmEdits[id]);
    if (!value) return;
    await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'updateKm', id, km: value }),
    });
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="mb-3 font-semibold text-slate-800">🚗 Veicoli</h2>
      <div className="space-y-2">
        {vehicles.length === 0 && <p className="text-sm text-slate-500">Nessun veicolo. Aggiungine uno qui sotto.</p>}
        {vehicles.map((v) => (
          <div key={v.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
            <span className="flex-1 text-sm font-medium text-slate-700">{v.name}</span>
            <span className="text-xs text-slate-500">{formatKm(v.current_km)}</span>
            <input
              className="input w-24 py-1 text-xs"
              type="number"
              placeholder="nuovo km"
              value={kmEdits[v.id] ?? ''}
              onChange={(e) => setKmEdits((s) => ({ ...s, [v.id]: e.target.value }))}
            />
            <button onClick={() => updateKm(v.id)} className="btn-ghost px-2 py-1 text-xs">
              Aggiorna
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <input className="input flex-1" placeholder="Nome (es. Golf)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input w-28" type="number" placeholder="km" value={km} onChange={(e) => setKm(e.target.value)} />
        <button className="btn-primary px-3" disabled={busy}>
          +
        </button>
      </form>
    </div>
  );
}
