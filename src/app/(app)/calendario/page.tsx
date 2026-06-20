import { getCurrentUser } from '@/lib/auth';
import { pendingReminderViews, recentLogs } from '@/lib/queries';
import Calendar, { type CalEvent } from '@/components/Calendar';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function CalendarioPage() {
  const user = (await getCurrentUser())!;
  const [reminders, logs] = await Promise.all([pendingReminderViews(user.id), recentLogs(user.id, 300)]);

  const events: CalEvent[] = [
    ...reminders
      .filter((r) => r.due_date)
      .map((r) => ({
        id: `r-${r.id}`,
        date: r.due_date!.slice(0, 10),
        time: r.due_time ?? null,
        title: r.title,
        type: 'reminder' as const,
        icon: r.category_icon || '🔔',
      })),
    ...logs.map((l) => ({
      id: `l-${l.id}`,
      date: l.event_date.slice(0, 10),
      time: null,
      title: l.title,
      type: 'log' as const,
      icon: l.category_icon || '📋',
    })),
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Calendario</h1>
      <p className="mb-6 text-sm text-slate-500">Promemoria ed eventi in vista mensile.</p>
      <Calendar events={events} />
    </div>
  );
}
