import { getCurrentUser } from '@/lib/auth';
import {
  listExpenses,
  dailyTotals,
  monthTotal,
  categoryTotals,
  budgetStatuses,
  getBudgets,
  multiMonthTotals,
} from '@/lib/expenses';
import { listExpenseCategories, EXPENSE_CATEGORY_ICONS } from '@/lib/categories';
import { formatCurrency, formatDateIt } from '@/lib/format';
import ExpenseForm from '@/components/ExpenseForm';
import BudgetEditor from '@/components/BudgetEditor';
import ExpenseRow from '@/components/ExpenseRow';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function SpesePage() {
  const user = (await getCurrentUser())!;
  const now = new Date();
  const curKey = now.toISOString().slice(0, 7);
  const prevKey = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  const total = await monthTotal(user.id, curKey);
  const prevTotal = await monthTotal(user.id, prevKey);
  const totals = await categoryTotals(user.id, curKey);
  const budgets = await budgetStatuses(user.id, curKey);
  const expenses = await listExpenses(user.id, curKey);
  const daily = await dailyTotals(user.id, curKey);
  const budgetMap = Object.fromEntries((await getBudgets(user.id)).map((b) => [b.category, b.monthly_limit]));
  const cats = await listExpenseCategories(user.id);
  const catNames = cats.map((c) => c.name);
  const iconMap: Record<string, string> = { ...EXPENSE_CATEGORY_ICONS };
  for (const c of cats) iconMap[c.name] = c.icon;
  const trend6 = await multiMonthTotals(user.id, 6);

  const maxDaily = Math.max(1, ...daily.map((d) => d.total));
  const maxTrend = Math.max(1, ...trend6.map((m) => m.total));
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
        <ExpenseForm categories={catNames} />

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
          {cats.map((cat) => {
            const spent = totals[cat.name] ?? 0;
            const limit = budgetMap[cat.name];
            const b = budgets.find((x) => x.category === cat.name);
            const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
            const barColor = b?.level === 'over' ? 'bg-red-500' : b?.level === 'warn' ? 'bg-amber-400' : 'bg-emerald-400';
            return (
              <div key={cat.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {iconMap[cat.name] ?? '📦'} {cat.name}
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

      {/* Trend ultimi 6 mesi */}
      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-800">Trend ultimi 6 mesi</h2>
        <div className="flex h-28 items-end gap-1">
          {trend6.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400">{formatCurrency(m.total)}</span>
              <div
                title={`${m.month}: ${formatCurrency(m.total)}`}
                className={`w-full rounded-t ${m.month === curKey ? 'bg-brand-500' : 'bg-brand-200'}`}
                style={{ height: `${Math.max(4, (m.total / maxTrend) * 80)}px` }}
              />
              <span className="text-[10px] text-slate-400">
                {m.month.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <BudgetEditor initial={budgetMap} categories={catNames} />

      {/* Elenco spese con modifica/elimina */}
      <div className="card !p-0">
        <h2 className="border-b border-slate-100 px-5 py-3 font-semibold text-slate-800">Movimenti del mese</h2>
        {expenses.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">Nessuna spesa registrata questo mese.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Importo</th>
                  <th className="px-2 py-2 text-left font-medium">Categoria</th>
                  <th className="px-2 py-2 text-left font-medium">Data</th>
                  <th className="px-2 py-2 text-left font-medium">Nota</th>
                  <th className="px-2 py-2 text-right font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <ExpenseRow key={e.id} expense={e} categories={catNames} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
