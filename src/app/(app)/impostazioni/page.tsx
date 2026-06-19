import { getCurrentUser } from '@/lib/auth';
import { listCategories, listVehicles } from '@/lib/queries';
import { listExpenseCategories } from '@/lib/categories';
import { listRecurring } from '@/lib/expenses';
import SettingsForm from '@/components/SettingsForm';
import VehicleManager from '@/components/VehicleManager';
import CategoryManager from '@/components/CategoryManager';
import ShareForm from '@/components/ShareForm';
import ExpenseCategoryManager from '@/components/ExpenseCategoryManager';
import RecurringManager from '@/components/RecurringManager';
import ExportImportPanel from '@/components/ExportImportPanel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ImpostazioniPage() {
  const user = (await getCurrentUser())!;
  const vehicles = listVehicles(user.id).map((v) => ({ id: v.id, name: v.name, current_km: v.current_km }));
  const categories = listCategories(user.id).map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    is_default: c.is_default,
  }));
  const expCats = listExpenseCategories(user.id).map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    is_default: c.is_default,
  }));
  const recurring = listRecurring(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Impostazioni</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <SettingsForm
          initial={{
            name: user.name || '',
            email: user.email,
            email_notifications: user.email_notifications,
            push_notifications: user.push_notifications,
            advance_days: user.advance_days,
            weekly_summary: user.weekly_summary,
          }}
        />
        <div className="space-y-6">
          <VehicleManager vehicles={vehicles} />
          <ShareForm categories={categories} />
        </div>
      </div>

      <CategoryManager categories={categories} />

      <div className="grid gap-6 md:grid-cols-2">
        <ExpenseCategoryManager categories={expCats} />
        <RecurringManager recurring={recurring} expenseCategories={expCats.map((c) => c.name)} />
      </div>

      <ExportImportPanel />
    </div>
  );
}
