'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { suggestInterval } from '@/lib/knowledge-base';
import { addMonthsIso, todayIso } from '@/lib/format';
import LocationPicker from './LocationPicker';

interface Cat {
  id: string;
  name: string;
  icon: string;
  kind: string;
}
interface Veh {
  id: string;
  name: string;
  current_km: number;
}

export default function NewLogWizard({
  categories,
  vehicles,
  expenseCategories,
}: {
  categories: Cat[];
  vehicles: Veh[];
  expenseCategories: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<Cat | null>(null);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [kmAtEvent, setKmAtEvent] = useState<string>('');

  // attachment
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);

  // reminder
  const [remEnabled, setRemEnabled] = useState(true);
  const [triggerType, setTriggerType] = useState<'time' | 'km'>('time');
  const [intervalMonths, setIntervalMonths] = useState<number>(12);
  const [dueDate, setDueDate] = useState<string>('');
  const [dueKm, setDueKm] = useState<string>('');
  const [recurring, setRecurring] = useState(false);
  const [advanceDays, setAdvanceDays] = useState(7);

  // expense (opzionale)
  const [expAmount, setExpAmount] = useState<string>('');
  const [expCategory, setExpCategory] = useState<string>(expenseCategories[0] ?? 'Altro');

  const isVehicle = category?.kind === 'vehicles';

  const suggestion = useMemo(
    () => (title ? suggestInterval(title, (category?.kind as any) || 'general') : null),
    [title, category]
  );

  function goToReminderStep() {
    if (suggestion) {
      setIntervalMonths(suggestion.months);
      setRecurring(suggestion.recurring);
      setDueDate(addMonthsIso(eventDate, suggestion.months));
    } else {
      setDueDate(addMonthsIso(eventDate, intervalMonths));
    }
    setStep(3);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: any = {
        title,
        categoryId: category?.id ?? null,
        eventDate,
        notes,
        location: location.trim() || null,
        vehicleId: isVehicle && vehicleId ? vehicleId : null,
        kmAtEvent: isVehicle && kmAtEvent ? Number(kmAtEvent) : null,
        reminder: remEnabled
          ? {
              enabled: true,
              triggerType,
              dueDate: triggerType === 'time' ? dueDate || addMonthsIso(eventDate, intervalMonths) : dueDate || null,
              intervalMonths: intervalMonths || null,
              dueKm: triggerType === 'km' && dueKm ? Number(dueKm) : null,
              recurring,
              advanceDays,
            }
          : null,
        expense: expAmount ? { amount: Number(expAmount.replace(',', '.')), category: expCategory } : null,
      };
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setError(data.error || 'Errore nel salvataggio');
        return;
      }

      // Upload attachment if provided
      if (attachFile && data.logId) {
        const fd = new FormData();
        fd.append('file', attachFile);
        await fetch(`/api/upload?logId=${data.logId}`, { method: 'POST', body: fd });
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Errore di rete');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* Stepper */}
      <ol className="mb-6 flex items-center justify-between text-xs font-medium text-slate-400">
        {['Categoria', 'Dettagli', 'Promemoria', 'Conferma'].map((label, i) => (
          <li key={label} className={`flex items-center gap-2 ${step === i + 1 ? 'text-brand-600' : ''}`}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                step >= i + 1 ? 'bg-brand-600 text-white' : 'bg-slate-200'
              }`}
            >
              {i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        ))}
      </ol>

      <div className="card">
        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 className="mb-4 font-semibold text-slate-800">Scegli la categoria</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCategory(c);
                    setStep(2);
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 p-4 transition hover:border-brand-400 hover:bg-brand-50"
                >
                  <span className="text-3xl">{c.icon}</span>
                  <span className="text-sm font-medium text-slate-700">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800">
              {category?.icon} {category?.name} — dettagli
            </h2>
            <div>
              <label className="label">Titolo *</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es. Tagliando, Visita dentista, Materasso…"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Data evento</label>
              <input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>

            {isVehicle && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Veicolo</label>
                  <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                    <option value="">—</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Km attuali</label>
                  <input
                    className="input"
                    type="number"
                    value={kmAtEvent}
                    onChange={(e) => setKmAtEvent(e.target.value)}
                    placeholder="es. 132000"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Note</label>
              <textarea
                className="input min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dettagli, ricevuta, officina…"
              />
            </div>

            <div>
              <label className="label">Luogo</label>
              <LocationPicker value={location} onChange={setLocation} />
            </div>

            <div>
              <label className="label">Allegato (foto / PDF ricevuta)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              {attachFile && <p className="mt-1 text-xs text-slate-500">📎 {attachFile.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              <div>
                <label className="label">Spesa associata (€)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="opzionale"
                />
              </div>
              <div>
                <label className="label">Categoria spesa</label>
                <select className="input" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                  {expenseCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="btn-ghost">
                Indietro
              </button>
              <button onClick={goToReminderStep} disabled={!title.trim()} className="btn-primary">
                Avanti
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800">Promemoria</h2>

            {suggestion && (
              <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
                💡 Suggerimento: ti ricordiamo <strong>{suggestion.label}</strong> tra{' '}
                <strong>{suggestion.months} mesi</strong>
                {suggestion.recurring ? ' (ricorrente)' : ''}. Puoi modificarlo qui sotto.
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remEnabled} onChange={(e) => setRemEnabled(e.target.checked)} />
              Crea un promemoria
            </label>

            {remEnabled && (
              <div className="space-y-3">
                {isVehicle && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTriggerType('time')}
                      className={`btn ${triggerType === 'time' ? 'btn-primary' : 'btn-ghost'} flex-1`}
                    >
                      ⏱️ A tempo
                    </button>
                    <button
                      onClick={() => setTriggerType('km')}
                      className={`btn ${triggerType === 'km' ? 'btn-primary' : 'btn-ghost'} flex-1`}
                    >
                      🛣️ A chilometri
                    </button>
                  </div>
                )}

                {triggerType === 'time' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Tra (mesi)</label>
                      <input
                        className="input"
                        type="number"
                        value={intervalMonths}
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          setIntervalMonths(m);
                          setDueDate(addMonthsIso(eventDate, m));
                        }}
                      />
                    </div>
                    <div>
                      <label className="label">Data promemoria</label>
                      <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="label">Prossimo a (km)</label>
                    <input
                      className="input"
                      type="number"
                      value={dueKm}
                      onChange={(e) => setDueKm(e.target.value)}
                      placeholder="es. 145000"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Scatta alla prima condizione tra tempo e km soddisfatta.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
                    🔁 Ricorrente
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Avvisami
                    <input
                      className="input w-16 py-1"
                      type="number"
                      value={advanceDays}
                      onChange={(e) => setAdvanceDays(Number(e.target.value))}
                    />
                    giorni prima
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="btn-ghost">
                Indietro
              </button>
              <button onClick={() => setStep(4)} className="btn-primary">
                Avanti
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-800">Conferma</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Categoria" value={`${category?.icon} ${category?.name}`} />
              <Row label="Titolo" value={title} />
              <Row label="Data" value={eventDate} />
              {notes && <Row label="Note" value={notes} />}
              {expAmount && <Row label="Spesa" value={`${expAmount} € · ${expCategory}`} />}
              {remEnabled && (
                <Row
                  label="Promemoria"
                  value={
                    triggerType === 'km'
                      ? `a ${dueKm || '—'} km${recurring ? ' · ricorrente' : ''}`
                      : `${dueDate} (${intervalMonths} mesi)${recurring ? ' · ricorrente' : ''}`
                  }
                />
              )}
            </dl>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(3)} className="btn-ghost">
                Indietro
              </button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Salvataggio…' : 'Salva ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
