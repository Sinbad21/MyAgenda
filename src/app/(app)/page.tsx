import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import {
  groupedReminders,
  recentLogs,
  categorySummaries,
  expenseWidget,
} from '@/lib/queries';
import ReminderCard from '@/components/ReminderCard';
import NotificationBanner from '@/components/NotificationBanner';
import { formatCurrency, formatDateIt, relativeDue } from '@/lib/format';
import { EXPENSE_CATEGORY_ICONS } from '@/lib/categories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BAR_COLORS: Record<string, string> = {
  Alimentari: 'bg-emerald-400',
  Trasporti: 'bg-blue-400',
  Salute: 'bg-rose-400',
  Casa: 'bg-amber-400',
  Svago: 'bg-violet-400',
  Altro: 'bg-slate-400',
};

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const groups = groupedReminders(user.id);
  const logs = recentLogs(user.id, 8);
  const summaries = categorySummaries(user.id);
  const exp = expenseWidget(user.id);

  const upcoming = [...groups.today, ...groups.week, ...groups.month];
  const maxCat = Math.max(1, ...exp.byCategory.map((c) => c.total));
  const delta = exp.total - exp.prevTotal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ciao {user.name || ''} 👋</h1>
        <p className="text-sm text-slate-500">Ecco la tua agenda di oggi.</p>
      </div>

      <NotificationBanner />

      {/* Reminder scaduti */}
      {groups.overdue.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-600">
            ⚠️ Da gestire ({groups.overdue.length})
          </h2>
          <div className="space-y-2">
            {groups.overdue.map((r) => (
              <ReminderCard key={r.id} data={r} />
            ))}
          </div>
        </section>
      )}

      {/* In scadenza */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">In arrivo</h2>
          <Link href="/nuovo" className="text-sm font-medium text-brand-600 hover:underline">
            + Nuovo evento
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="card text-center text-sm text-slate-500">
            Nessun promemoria imminente. Crea un evento o usa la chat 💬
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((r) => (
              <ReminderCard key={r.id} data={r} />
            ))}
          </div>
        )}
      </section>

      {/* Widget spese */}
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Spese del mese</h2>
          <Link href="/spese" className="text-sm font-medium text-brand-600 hover:underline">
            Dettagli
          </Link>
        </div>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(exp.total)}</p>
            <p className="text-xs text-slate-500">
              {exp.prevTotal > 0 ? (
                <>
                  {delta >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(delta))} vs mese scorso
                </>
              ) : (
                'Primo mese di tracciamento'
              )}
            </p>
          </div>
        </div>

        {exp.byCategory.length > 0 && (
          <div className="mt-4 space-y-2">
            {exp.byCategory.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-slate-600">
                  {EXPENSE_CATEGORY_ICONS[c.category]} {c.category}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${BAR_COLORS[c.category] || 'bg-slate-400'}`}
                    style={{ width: `${(c.total / maxCat) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-medium text-slate-700">
                  {formatCurrency(c.total)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Alert budget */}
        {exp.budgets.filter((b) => b.level !== 'ok').length > 0 && (
          <div className="mt-4 space-y-1">
            {exp.budgets
              .filter((b) => b.level !== 'ok')
              .map((b) => (
                <p
                  key={b.category}
                  className={`text-xs ${b.level === 'over' ? 'text-red-600' : 'text-amber-600'}`}
                >
                  {b.level === 'over' ? '🔴' : '🟠'} {b.category}: {Math.round(b.pct)}% del budget (
                  {formatCurrency(b.spent)} / {formatCurrency(b.limit)})
                </p>
              ))}
          </div>
        )}
      </section>

      {/* Riepilogo categorie */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Per categoria</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {summaries.map((s) => (
            <div key={s.category.id} className="card !p-4">
              <div className="mb-1 text-2xl">{s.category.icon}</div>
              <p className="font-medium text-slate-800">{s.category.name}</p>
              <p className="text-xs text-slate-500">
                {s.lastEvent ? `Ultimo: ${formatDateIt(s.lastEvent)}` : 'Nessun evento'}
              </p>
              {s.nextReminder && (
                <p className="text-xs text-brand-600">Prossimo {relativeDue(s.nextReminder)}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Storico recente</h2>
          <Link href="/logs" className="text-sm font-medium text-brand-600 hover:underline">
            Tutto
          </Link>
        </div>
        {logs.length === 0 ? (
          <div className="card text-center text-sm text-slate-500">Ancora nessun evento registrato.</div>
        ) : (
          <div className="card divide-y divide-slate-100 !p-0">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg">{l.category_icon || '📋'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{l.title}</p>
                  {l.notes && <p className="truncate text-xs text-slate-500">{l.notes}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatDateIt(l.event_date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
