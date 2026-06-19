import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { groupedReminders, pendingReminderViews } from '@/lib/queries';
import ReminderCard from '@/components/ReminderCard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PromemoriPage() {
  const user = (await getCurrentUser())!;
  const groups = groupedReminders(user.id);
  const all = pendingReminderViews(user.id);

  const sections = [
    { key: 'overdue', label: '⚠️ Scaduti', items: groups.overdue, cls: 'text-red-600' },
    { key: 'today', label: '📅 Oggi', items: groups.today, cls: 'text-amber-600' },
    { key: 'week', label: '📆 Questa settimana', items: groups.week, cls: 'text-brand-600' },
    { key: 'month', label: '🗓️ Questo mese', items: groups.month, cls: 'text-slate-600' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promemoria</h1>
          <p className="text-sm text-slate-500">
            {all.length === 0 ? 'Nessun promemoria in attesa.' : `${all.length} promemoria in attesa`}
          </p>
        </div>
        <Link href="/nuovo" className="btn-primary text-sm">
          + Nuovo evento
        </Link>
      </div>

      {all.length === 0 ? (
        <div className="card text-center text-sm text-slate-500 py-10">
          🎉 Tutto in ordine! Nessun promemoria in attesa.
        </div>
      ) : (
        sections.map(
          ({ key, label, items, cls }) =>
            items.length > 0 && (
              <section key={key}>
                <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${cls}`}>
                  {label} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((r) => (
                    <ReminderCard key={r.id} data={r} />
                  ))}
                </div>
              </section>
            )
        )
      )}
    </div>
  );
}
