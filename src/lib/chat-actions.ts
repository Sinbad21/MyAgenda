import { getDb, newId, nowIso } from './db';
import { addExpense, monthTotal, budgetStatuses, compareWithPreviousMonth } from './expenses';
import { createReminder, cancelReminder } from './reminders';
import { categoryByKind, resolveVehicle, updateVehicleKm } from './lookups';
import { addMonthsIso, formatCurrency, todayIso } from './format';
import { EXPENSE_CATEGORY_ICONS } from './categories';
import type { ChatAction } from '@/ai/assistant';

export interface ExecutionResult {
  createdLogs: number; createdReminders: number; createdExpenses: number; insights: string[];
}

export async function executeActions(userId: string, actions: ChatAction[]): Promise<ExecutionResult> {
  const db = getDb();
  const result: ExecutionResult = { createdLogs: 0, createdReminders: 0, createdExpenses: 0, insights: [] };

  for (const action of actions) {
    switch (action.type) {
      case 'expense': {
        const cat = action.expense_category || 'Altro';
        await addExpense({ userId, amount: action.amount, category: cat, date: action.date || todayIso(), note: action.note ?? null });
        result.createdExpenses++;
        const total = await monthTotal(userId);
        result.insights.push(`Spese totali del mese: ${formatCurrency(total)}.`);
        const cmp = await compareWithPreviousMonth(userId, cat);
        if (cmp.deltaPct != null && Math.abs(cmp.deltaPct) >= 10) {
          const verso = cmp.deltaPct > 0 ? 'in più' : 'in meno';
          result.insights.push(`Questo mese stai spendendo il ${Math.abs(Math.round(cmp.deltaPct))}% ${verso} in ${cat} rispetto al mese scorso.`);
        }
        const bs = (await budgetStatuses(userId)).find((b) => b.category === cat);
        if (bs?.level === 'over') result.insights.push(`⚠️ Hai superato il budget ${cat} (${Math.round(bs.pct)}%).`);
        else if (bs?.level === 'warn') result.insights.push(`Hai già usato il ${Math.round(bs.pct)}% del budget ${cat}.`);
        break;
      }
      case 'log': {
        const category = await categoryByKind(userId, action.category_kind);
        const logId = newId();
        await db
          .prepare(`INSERT INTO logs (id, user_id, category_id, title, notes, event_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(logId, userId, category?.id ?? null, action.title, action.notes ?? null, action.date || todayIso(), nowIso())
          .run();
        result.createdLogs++;
        if (action.create_reminder && action.interval_months) {
          const due = addMonthsIso(action.date || todayIso(), action.interval_months);
          await createReminder({ userId, logId, categoryId: category?.id ?? null, title: action.title, dueDate: due, intervalMonths: action.interval_months, recurring: !!action.recurring });
          result.createdReminders++;
          result.insights.push(`Promemoria "${action.title}" schedulato per il ${due}.`);
        }
        break;
      }
      case 'reminder': {
        const category = await categoryByKind(userId, 'general');
        await createReminder({ userId, categoryId: category?.id ?? null, title: action.title, dueDate: action.date || todayIso(), dueTime: (action as any).time ?? null, intervalMonths: action.interval_months ?? null, recurring: !!action.recurring });
        result.createdReminders++;
        break;
      }
      case 'update_km': {
        const vehicle = await resolveVehicle(userId, action.vehicle_name);
        if (vehicle) {
          await updateVehicleKm(userId, vehicle.id, action.km);
          result.insights.push(`${vehicle.name}: chilometraggio aggiornato a ${action.km.toLocaleString('it-IT')} km.`);
        }
        break;
      }
      case 'update_reminder': {
        const db = getDb();
        const rem = await db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').bind(action.id, userId).first<any>();
        if (rem) {
          await db.prepare(
            'UPDATE reminders SET title = ?, due_date = ?, due_time = ? WHERE id = ? AND user_id = ?'
          ).bind(
            action.title ?? rem.title,
            action.due_date !== undefined ? action.due_date : rem.due_date,
            action.due_time !== undefined ? action.due_time : rem.due_time,
            action.id, userId
          ).run();
          result.insights.push(`Promemoria "${action.title ?? rem.title}" aggiornato.`);
        }
        break;
      }
      case 'delete_reminder': {
        await cancelReminder(userId, action.id);
        result.insights.push('Promemoria eliminato.');
        break;
      }
      case 'update_log': {
        const db = getDb();
        const log = await db.prepare('SELECT * FROM logs WHERE id = ? AND user_id = ?').bind(action.id, userId).first<any>();
        if (log) {
          await db.prepare(
            'UPDATE logs SET title = ?, notes = ?, event_date = ? WHERE id = ? AND user_id = ?'
          ).bind(
            action.title ?? log.title,
            action.notes !== undefined ? action.notes : log.notes,
            action.event_date ?? log.event_date,
            action.id, userId
          ).run();
          result.insights.push(`Log "${action.title ?? log.title}" aggiornato.`);
        }
        break;
      }
      case 'delete_log': {
        await getDb().prepare('DELETE FROM logs WHERE id = ? AND user_id = ?').bind(action.id, userId).run();
        result.insights.push('Evento eliminato.');
        break;
      }
    }
  }
  return result;
}
