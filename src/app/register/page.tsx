import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isGoogleEnabled } from '@/lib/oauth';
import AuthForm from '@/components/AuthForm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect('/');
  const { error } = await searchParams;
  return <AuthForm mode="register" googleEnabled={isGoogleEnabled()} errorMessage={error} />;
}
