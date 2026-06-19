'use client';

import { useState } from 'react';

interface Props {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM or ''
  onDateChange: (d: string) => void;
  onTimeChange: (t: string) => void;
}

const MONTHS = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];
const DAYS = ['Lu','Ma','Me','Gi','Ve','Sa','Do'];

function parseDate(iso: string): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

// Monday-based weekday (0=Mon … 6=Sun)
function weekdayMon(y: number, m: number, d: number): number {
  const w = new Date(y, m - 1, d).getDay(); // 0=Sun
  return w === 0 ? 6 : w - 1;
}

export default function CalendarPicker({ date, time, onDateChange, onTimeChange }: Props) {
  const today = new Date();
  const sel = parseDate(date);

  const [viewY, setViewY] = useState(sel?.y ?? today.getFullYear());
  const [viewM, setViewM] = useState(sel?.m ?? today.getMonth() + 1);

  function prevMonth() {
    if (viewM === 1) { setViewY(viewY - 1); setViewM(12); }
    else setViewM(viewM - 1);
  }
  function nextMonth() {
    if (viewM === 12) { setViewY(viewY + 1); setViewM(1); }
    else setViewM(viewM + 1);
  }

  const firstWeekday = weekdayMon(viewY, viewM, 1);
  const totalDays = daysInMonth(viewY, viewM);
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const todayIso = toIso(today.getFullYear(), today.getMonth() + 1, today.getDate());

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* Header mese */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 text-sm">
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-700">
          {MONTHS[viewM - 1]} {viewY}
        </span>
        <button type="button" onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 text-sm">
          ›
        </button>
      </div>

      {/* Intestazioni giorni */}
      <div className="grid grid-cols-7 text-center">
        {DAYS.map((d) => (
          <span key={d} className="text-[10px] font-medium text-slate-400 py-0.5">{d}</span>
        ))}
      </div>

      {/* Griglia giorni */}
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const iso = toIso(viewY, viewM, day);
          const isSelected = iso === date;
          const isToday = iso === todayIso;
          const isPast = iso < todayIso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDateChange(iso)}
              disabled={isPast}
              className={[
                'mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors',
                isSelected
                  ? 'bg-brand-600 text-white font-semibold'
                  : isToday
                    ? 'border border-brand-400 text-brand-700 font-medium hover:bg-brand-50'
                    : isPast
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-brand-50',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Data selezionata + input ora */}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        {date && (
          <p className="text-xs text-center text-slate-500">
            Selezionato:{' '}
            <span className="font-medium text-slate-700">
              {new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </p>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Ora appuntamento</label>
          <input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="input py-1 flex-1 text-sm"
          />
          {time && (
            <button type="button" onClick={() => onTimeChange('')}
              className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          )}
        </div>
      </div>
    </div>
  );
}
