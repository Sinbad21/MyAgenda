'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateIt, formatKm, relativeDue } from '@/lib/format';

export interface ReminderCardData {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  due_km: number | null;
  trigger_type: string;
  recurring: number;
  bucket: string;
  category_icon: string | null;
  category_name: string | null;
  vehicle_name: string | null;
  vehicle_km: number | null;
  snoozed_until?: string | null;
}

const BUCKET_STYLE: Record<string, string> = {
  overdue: 'border-l-red-500 bg-red-50',
  today: 'border-l-amber-500 bg-amber-50',
  week: 'border-l-brand-400 bg-white',
  month: 'border-l-slate-300 bg-white',
};

const SNOOZE_OPTIONS = [
  { label: '1g', days: 1 },
  { label: '3g', days: 3 },
  { label: '1w', days: 7 },
];

export default function ReminderCard({ data }: { data: ReminderCardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);

  async function act(action: 'complete' | 'stop' | 'cancel' | 'snooze', snoozeDays?: number) {
    setBusy(true);
    try {
      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: data.id, action, snoozeDays }),
      });
      setShowSnooze(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const dueLabel =
    data.due_km != null && data.trigger_type === 'km'
      ? `a ${formatKm(data.due_km)}${data.vehicle_km != null ? ` (ora ${formatKm(data.vehicle_km)})` : ''}`
      : data.due_date
        ? `${formatDateIt(data.due_date)}${data.due_time ? ' alle ' + data.due_time : ''} · ${relativeDue(data.due_date)}`
        : '';

  return (
    <div className={`flex items-start gap-3 rounded-xl border-l-4 p-3 ring-1 ring-slate-100 ${BUCKET_STYLE[data.bucket] || 'bg-white'}`}>
      <span className="text-xl">{data.category_icon || '🔔'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-slate-800">{data.title}</p>
          {data.recurring ? <span title="Ricorrente" className="text-sm">🔁</span> : null}
        </div>
        <p className="text-xs text-slate-500">
          {data.category_name ? `${data.category_name} · ` : ''}
          {dueLabel}
        </p>

        {showSnooze && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs text-slate-500">Posticipa:</span>
            {SNOOZE_OPTIONS.map((o) => (
              <button
                key={o.days}
                onClick={() => act('snooze', o.days)}
                disabled={busy}
                className="rounded bg-slate-100 px-2 py-0.5 text-xs hover:bg-slate-200"
              >
                {o.label}
              </button>
            ))}
            <button onClick={() => setShowSnooze(false)} className="text-xs text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <button onClick={() => act('complete')} disabled={busy} className="btn-primary px-2.5 py-1 text-xs">
          Fatto ✓
        </button>
        <div className="flex gap-2 text-[11px] text-slate-400">
          <button onClick={() => setShowSnooze((s) => !s)} disabled={busy} className="hover:text-amber-600">
            😴 snooze
          </button>
          {data.recurring ? (
            <button onClick={() => act('stop')} disabled={busy} className="hover:text-slate-600">
              interrompi
            </button>
          ) : null}
          <button onClick={() => act('cancel')} disabled={busy} className="hover:text-red-500">
            elimina
          </button>
        </div>
      </div>
    </div>
  );
}
