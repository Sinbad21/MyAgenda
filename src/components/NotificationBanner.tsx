'use client';

import { useEffect, useState } from 'react';

interface Notif {
  id: string;
  title: string;
  body: string | null;
  read: number;
}

export default function NotificationBanner() {
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d) => setItems((d.notifications || []).filter((n: Notif) => !n.read)))
      .catch(() => {});
  }, []);

  async function dismissAll() {
    await fetch('/api/notifications', { method: 'POST' });
    setItems([]);
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-800">🔔 {items.length} avvisi</p>
        <button onClick={dismissAll} className="text-xs font-medium text-amber-700 hover:underline">
          Segna come letti
        </button>
      </div>
      <ul className="space-y-1">
        {items.slice(0, 5).map((n) => (
          <li key={n.id} className="text-sm text-amber-900">
            <span className="font-medium">{n.title}</span>
            {n.body ? ` — ${n.body}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
