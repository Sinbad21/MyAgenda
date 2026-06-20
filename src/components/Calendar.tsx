'use client';

import { useMemo, useState } from 'react';

export interface CalEvent {
  id: string;
  date: string; // yyyy-MM-dd
  time: string | null;
  title: string;
  type: 'reminder' | 'log';
  icon: string;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export default function Calendar({ events }: { events: CalEvent[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selected, setSelected] = useState<string>(toKey(today));

  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    }
    for (const list of m.values()) list.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    return m;
  }, [events]);

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lunedì = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(new Date(year, month, d)));

  function prev() {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }
  function next() {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const selectedEvents = byDate.get(selected) || [];
  const todayKey = toKey(today);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={prev} className="btn-ghost px-3 py-1">
            ‹
          </button>
          <h2 className="font-semibold capitalize text-slate-800">
            {new Date(year, month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={next} className="btn-ghost px-3 py-1">
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <div key={i} />;
            const day = Number(key.slice(8));
            const items = byDate.get(key) || [];
            const isToday = key === todayKey;
            const isSel = key === selected;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`flex min-h-[3.2rem] flex-col rounded-lg border p-1 text-left transition ${
                  isSel ? 'border-brand-400 bg-brand-50' : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`text-xs ${
                    isToday ? 'font-bold text-brand-600' : 'text-slate-600'
                  }`}
                >
                  {day}
                </span>
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {items.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`h-1.5 w-1.5 rounded-full ${e.type === 'reminder' ? 'bg-brand-500' : 'bg-slate-300'}`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dettaglio giorno selezionato */}
      <div className="card">
        <h3 className="mb-2 text-sm font-semibold capitalize text-slate-700">
          {new Date(selected + 'T00:00:00').toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </h3>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-slate-400">Nessun evento in questa giornata.</p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2">
                <span className="text-lg">{e.icon}</span>
                <span className="flex-1 text-sm font-medium text-slate-700">{e.title}</span>
                {e.time && <span className="text-xs font-semibold text-brand-600">{e.time}</span>}
                <span className="chip bg-white text-[10px] text-slate-400 ring-1 ring-slate-200">
                  {e.type === 'reminder' ? 'promemoria' : 'evento'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
