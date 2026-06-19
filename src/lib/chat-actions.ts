import { getDb, newId, nowIso } from './db';
import { addExpense, monthTotal, budgetStatuses, compareWithPreviousMonth } from './expenses';
import { createReminder } from './reminders';
import { categoryByKind, resolveVehicle, updateVehicleKm } from './lookups';
import { addMonthsIso, formatCurrency, todayIso } from './format';
import { EXPENSE_CATEGORY_ICONS } from './categories';
import type { ChatAction } from '@/ai/assistant';

export interface ExecutionResult {
  createdLogs: number;
  createdReminders: number;
  createdExpenses: number;
  insights: string[];
}

/** Applica le azioni estratte dalla chat e produce insight contestuali. */
export function executeActions(userId: string, actions: ChatAction[]): ExecutionResult {
  const db = getDb();
  const result: ExecutionResult = { createdLogs: 0, createdReminders: 0, createdExpenses: 0, insights: [] };

  for (const action of actions) {
    switch (action.type) {
      case 'expense': {
        const cat = action.expense_category || 'Altro';
        addExpense({
          userId,
          amount: action.amount,
          category: cat,
          date: action.date || todayIso(),
          note: action.note ?? null,
        });
        result.createdExpenses++;

        // Insight: balance mensile + confronto + budget
        const total = monthTotal(userId);
        result.insights.push(`Spese totali del mese: ${formatCurrency(total)}.`);

        const cmp = compareWithPreviousMonth(userId, cat);
        if (cmp.deltaPct != null && Math.abs(cmp.deltaPct) >= 10) {
          const verso = cmp.deltaPct > 0 ? 'in più' : 'in meno';
          result.insights.push(
            `Questo mese stai spendendo il ${Math.abs(Math.round(cmp.deltaPct))}% ${verso} in ${cat} rispetto al mese scorso.`
          );
        }
        const bs = budgetStatuses(userId).find((b) => b.category === cat);
        if (bs) {
          if (bs.level === 'over') {
            result.insights.push(`⚠️ Hai superato il budget ${cat} (${Math.round(bs.pct)}%).`);
          } else if (bs.level === 'warn') {
            result.insights.push(`Hai già usato il ${Math.round(bs.pct)}% del budget ${cat}.`);
          }
        }
        break;
      }

      case 'log': {
        const category = categoryByKind(userId, action.category_kind);
        const logId = newId();
        db.prepare(
          `INSERT INTO logs (id, user_id, category_id, title, notes, event_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(logId, userId, category?.id ?? null, action.title, action.notes ?? null, action.date || todayIso(), nowIso());
        result.createdLogs++;

        if (action.create_reminder && action.interval_months) {
          const due = addMonthsIso(action.date || todayIso(), action.interval_months);
          createReminder({
            userId,
            logId,
            categoryId: category?.id ?? null,
            title: action.title,
            dueDate: due,
            intervalMonths: action.interval_months,
            recurring: !!action.recurring,
          });
          result.createdReminders++;
          result.insights.push(`Promemoria "${action.title}" schedulato per il ${due}.`);
        }
        break;
      }

      case 'reminder': {
        const category = categoryByKind(userId, 'general');
        createReminder({
          userId,
          categoryId: category?.id ?? null,
          title: action.title,
          dueDate: action.date || todayIso(),
          intervalMonths: action.interval_months ?? null,
          recurring: !!action.recurring,
        });
        result.createdReminders++;
        break;
      }

      case 'update_km': {
        const vehicle = resolveVehicle(userId, action.vehicle_name);
        if (vehicle) {
          updateVehicleKm(userId, vehicle.id, action.km);
          result.insights.push(`${vehicle.name}: chilometraggio aggiornato a ${action.km.toLocaleString('it-IT')} km.`);
        }
        break;
      }
    }
  }

  return result;
}

export { EXPENSE_CATEGORY_ICONS };
