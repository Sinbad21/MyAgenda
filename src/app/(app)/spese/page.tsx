import { getCurrentUser } from '@/lib/auth';
import {
  listExpenses,
  dailyTotals,
  monthTotal,
  categoryTotals,
  budgetStatuses,
  getBudgets,
} from '@/lib/expenses';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS } from '@/lib/categories';
import { formatCurrency, formatDateIt } from '@/lib/format';
import ExpenseForm from '@/components/ExpenseForm';
import BudgetEditor from '@/components/BudgetEditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SpesePage() {
  const user = (await getCurrentUser())!;
  const now = new Date();
  const curKey = now.toISOString().slice(0, 7);
  const prevKey = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  const total = monthTotal(user.id, curKey);
  const prevTotal = monthTotal(user.id, prevKey);
  const totals = categoryTotals(user.id, curKey);
  const budgets = budgetStatuses(user.id, curKey);
  const expenses = listExpenses(user.id, curKey);
  const daily = dailyTotals(user.id, curKey);
  const budgetMap = Object.fromEntries(getBudgets(user.id).map((b) => [b.category, b.monthly_limit]));

  const maxDaily = Math.max(1, ...daily.map((d) => d.total));
  const delta = total - prevTotal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Spese & Budget</h1>
        <p className="text-sm text-slate-500 capitalize">
          {now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ExpenseForm />

        {/* Riepilogo */}
        <div className="card">
          <h2 className="mb-2 font-semibold text-slate-800">Riepilogo</h2>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(total)}</p>
          <p className="text-xs text-slate-500">
            {prevTotal > 0 ? (
              <>
                {delta >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(delta))} rispetto a {prevKey}
              </>
            ) : (
              'Nessun confronto disponibile'
            )}
          </p>

          {/* andamento giornaliero */}
          {daily.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium text-slate-500">Andamento giornaliero</p>
              <div className="flex h-20 items-end gap-0.5">
                {daily.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${formatCurrency(d.total)}`}
                    className="flex-1 rounded-t bg-brand-300"
                    style={{ height: `${(d.total / maxDaily) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown per categoria con budget */}
      <div className="card">
        <h2 className="mb-4 font-semibold text-slate-800">Per categoria</h2>
        <div className="space-y-3">
          {EXPENSE_CATEGORIES.map((cat) => {
            const spent = totals[cat] ?? 0;
            const limit = budgetMap[cat];
            const b = budgets.find((x) => x.category === cat);
            const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
            const barColor = b?.level === 'over' ? 'bg-red-500' : b?.level === 'warn' ? 'bg-amber-400' : 'bg-emerald-400';
            return (
              <div key={cat}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {EXPENSE_CATEGORY_ICONS[cat]} {cat}
                  </span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(spent)}
                    {limit ? <span className="text-xs text-slate-400"> / {formatCurrency(limit)}</span> : null}
                  </span>
                </div>
                {limit ? (
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                ) : (
                  <div className="h-2 rounded-full bg-slate-50" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <BudgetEditor initial={budgetMap} />

      {/* Elenco spese */}
      <div className="card !p-0">
        <h2 className="border-b border-slate-100 px-5 py-3 font-semibold text-slate-800">Movimenti del mese</h2>
        {expenses.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">Nessuna spesa registrata questo mese.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-lg">{EXPENSE_CATEGORY_ICONS[e.category] || '📦'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{e.note || e.category}</p>
                  <p className="text-xs text-slate-400">
                    {e.category} · {formatDateIt(e.date)}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-slate-800">{formatCurrency(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
