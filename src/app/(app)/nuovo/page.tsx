import { getCurrentUser } from '@/lib/auth';
import { listCategories, listVehicles } from '@/lib/queries';
import { expenseCategoryNames } from '@/lib/categories';
import NewLogWizard from '@/components/NewLogWizard';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function NuovoPage() {
  const user = (await getCurrentUser())!;
  const categories = (await listCategories(user.id)).map((c) => ({ id: c.id, name: c.name, icon: c.icon, kind: c.kind }));
  const vehicles = (await listVehicles(user.id)).map((v) => ({ id: v.id, name: v.name, current_km: v.current_km }));
  const expenseCategories = await expenseCategoryNames(user.id);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Nuovo evento</h1>
      <p className="mb-6 text-sm text-slate-500">Registra un evento e imposta il promemoria in pochi passi.</p>
      <NewLogWizard categories={categories} vehicles={vehicles} expenseCategories={expenseCategories} />
    </div>
  );
}
