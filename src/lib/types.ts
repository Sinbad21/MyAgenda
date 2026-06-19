import type { CategoryKind } from './knowledge-base';

export interface User {
  id: string;
  email: string;
  name: string | null;
  email_notifications: number;
  push_notifications: number;
  advance_days: number;
  weekly_summary: number;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string | null;
  kind: CategoryKind;
  is_default: number;
  created_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  name: string;
  current_km: number;
  km_updated_at: string | null;
  created_at: string;
}

export interface LogEntry {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  notes: string | null;
  event_date: string;
  attachment_path: string | null;
  vehicle_id: string | null;
  km_at_event: number | null;
  created_at: string;
}

export type TriggerType = 'time' | 'km';
export type ReminderStatus = 'pending' | 'done' | 'cancelled';

export interface Reminder {
  id: string;
  user_id: string;
  log_id: string | null;
  category_id: string | null;
  title: string;
  trigger_type: TriggerType;
  due_date: string | null;
  due_km: number | null;
  vehicle_id: string | null;
  interval_months: number | null;
  recurring: number;
  advance_days: number;
  status: ReminderStatus;
  notified_at: string | null;
  completed_at: string | null;
  snoozed_until: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  log_id: string | null;
  amount: number;
  category: string;
  date: string;
  note: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
}

export interface ExpenseCustomCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string | null;
  is_default: number;
  created_at: string;
}

export interface RecurringExpense {
  id: string;
  user_id: string;
  label: string;
  amount: number;
  category: string;
  day_of_month: number;
  active: number;
  last_inserted: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  reminder_id: string | null;
  channel: string;
  title: string;
  body: string | null;
  read: number;
  created_at: string;
}
