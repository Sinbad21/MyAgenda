import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listCategories, recentLogs } from '@/lib/queries';
import LogRow from '@/components/LogRow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function LogsPage({ searchParams }: { searchParams: { cat?: string } }) {
  const user = (await getCurrentUser())!;
  const categories = listCategories(user.id);
  const activeCat = searchParams.cat || null;
  const logs = recentLogs(user.id, 200, activeCat);

  // raggruppa per mese
  const groups = new Map<string, typeof logs>();
  for (const l of logs) {
    const key = l.event_date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Storico</h1>
      <p className="mb-4 text-sm text-slate-500">Tutti gli eventi registrati, in ordine cronologico.</p>

      {/* Filtri categoria */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/logs"
          className={`chip ${!activeCat ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
        >
          Tutte
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/logs?cat=${c.id}`}
            className={`chip ${
              activeCat === c.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {c.icon} {c.name}
          </Link>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">
          Nessun evento.{' '}
          <Link href="/nuovo" className="font-medium text-brand-600 hover:underline">
            Creane uno
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-slate-500">
                {new Date(month + '-01T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="relative space-y-3 border-l-2 border-slate-100 pl-4">
                {items.map((l) => (
                  <div key={l.id} className="relative">
                    <span className="absolute -left-[1.42rem] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm ring-2 ring-slate-100">
                      {l.category_icon || '📋'}
                    </span>
                    <LogRow log={l} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
