'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateIt } from '@/lib/format';
import LocationPicker from './LocationPicker';

interface LogData {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  event_date: string;
  attachment_path: string | null;
  category_name: string | null;
  category_icon: string | null;
}

export default function LogRow({ log }: { log: LogData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(log.title);
  const [notes, setNotes] = useState(log.notes ?? '');
  const [location, setLocation] = useState(log.location ?? '');
  const [eventDate, setEventDate] = useState(log.event_date);
  const [attachFile, setAttachFile] = useState<File | null>(null);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/logs/${log.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, notes: notes || null, location: location.trim() || null, eventDate }),
      });
      if (res.ok) {
        // Upload new attachment if provided
        if (attachFile) {
          const fd = new FormData();
          fd.append('file', attachFile);
          await fetch(`/api/upload?logId=${log.id}`, { method: 'POST', body: fd });
        }
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Eliminare "${log.title}"? Saranno rimossi anche i promemoria e le spese associati.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/logs/${log.id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Titolo</label>
            <input className="input text-sm py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Data</label>
            <input className="input text-sm py-1" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label text-xs">Note</label>
          <textarea className="input text-sm py-1 min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">Luogo</label>
          <LocationPicker value={location} onChange={setLocation} />
        </div>
        <div>
          <label className="label text-xs">Sostituisci allegato</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
            className="block text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-brand-100 file:px-2 file:py-1 file:text-xs"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-primary px-3 py-1 text-xs">
            {busy ? '…' : 'Salva'}
          </button>
          <button onClick={() => setEditing(false)} className="btn-ghost px-3 py-1 text-xs">
            Annulla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-slate-200">
      <span className="mt-0.5 text-xl">{log.category_icon ?? '📋'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-slate-800">{log.title}</p>
          {log.attachment_path && (
            <a
              href={log.attachment_path}
              target="_blank"
              rel="noopener noreferrer"
              title="Vedi allegato"
              className="text-sm text-brand-600 hover:text-brand-800"
            >
              📎
            </a>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {log.category_name ? `${log.category_name} · ` : ''}
          {formatDateIt(log.event_date)}
        </p>
        {log.notes && <p className="mt-1 text-xs text-slate-600 line-clamp-2">{log.notes}</p>}
        {log.location && (
          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1">
            <span>📍</span>
            <span className="truncate">{log.location}</span>
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1 text-[11px] text-slate-400">
        <button onClick={() => setEditing(true)} className="hover:text-brand-600">
          ✏️ modifica
        </button>
        <button onClick={remove} disabled={busy} className="hover:text-red-500">
          🗑 elimina
        </button>
      </div>
    </div>
  );
}
