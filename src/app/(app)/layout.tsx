import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import NavBar from '@/components/NavBar';
import ChatWidget from '@/components/ChatWidget';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <NavBar userName={user.name || user.email} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <ChatWidget />
    </div>
  );
}
