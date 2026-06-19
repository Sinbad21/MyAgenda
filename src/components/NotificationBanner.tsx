'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Notif {
  id: string;
  title: string;
  body: string | null;
  read: number;
  reminder_id: string | null;
}

export default function NotificationBanner() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [completing, setCompleting] = useState<string | null>(null);

  function fetchNotifs() {
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d: any) => setItems((d.notifications || []).filter((n: Notif) => !n.read)))
      .catch(() => {});
  }

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(id);
  }, []);

  async function dismissAll() {
    await fetch('/api/notifications', { method: 'POST' });
    setItems([]);
  }

  async function markDone(reminderId: string, notifId: string) {
    setCompleting(reminderId);
    try {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: reminderId, action: 'complete' }),
      });
      await fetch('/api/notifications', { method: 'POST' });
      setItems((prev) => prev.filter((n) => n.id !== notifId));
      router.refresh();
    } finally {
      setCompleting(null);
    }
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
      <ul className="space-y-2">
        {items.slice(0, 5).map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 text-sm text-amber-900">
              <span className="font-medium">{n.title}</span>
              {n.body ? <p className="mt-0.5 text-xs text-amber-700">{n.body}</p> : null}
            </div>
            {n.reminder_id && (
              <button
                onClick={() => markDone(n.reminder_id!, n.id)}
                disabled={completing === n.reminder_id}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {completing === n.reminder_id ? '…' : '✓ Fatto'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
