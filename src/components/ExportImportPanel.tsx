'use client';

import { useRef, useState } from 'react';

export default function ExportImportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: text,
      });
      const data = await res.json() as any;
      if (res.ok) {
        setImportMsg(`✓ Importati: ${data.expenses} spese, ${data.logs} log.${data.errors?.length ? ` Errori: ${data.errors.length}` : ''}`);
      } else {
        setImportMsg(`Errore: ${data.error}`);
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-slate-800">Export / Import dati</h2>
      <p className="text-sm text-slate-500">
        Scarica una copia dei tuoi dati (backup) o importa un file precedentemente esportato.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href="/api/export?format=json"
          download="myagenda-backup.json"
          className="btn-ghost text-sm"
        >
          ⬇️ Esporta JSON (tutti i dati)
        </a>
        <a
          href="/api/export?format=csv-expenses"
          download="spese.csv"
          className="btn-ghost text-sm"
        >
          ⬇️ Esporta CSV spese
        </a>
        <a
          href="/api/export?format=csv-logs"
          download="log.csv"
          className="btn-ghost text-sm"
        >
          ⬇️ Esporta CSV log
        </a>
      </div>
      <div className="border-t border-slate-100 pt-3">
        <label className="label">Importa da JSON (ripristino backup)</label>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={importFile}
          disabled={importing}
          className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        {importing && <p className="mt-1 text-xs text-slate-400">Importazione in corso…</p>}
        {importMsg && <p className="mt-2 text-sm text-slate-700">{importMsg}</p>}
      </div>
    </div>
  );
}
