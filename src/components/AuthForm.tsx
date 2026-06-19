'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isRegister ? { email, password, name } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Si è verificato un errore');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Errore di rete, riprova');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl">
          🗓️
        </div>
        <h1 className="text-2xl font-bold text-slate-900">MyAgenda</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isRegister ? 'Crea il tuo account' : 'Accedi al tuo spazio'}
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        {isRegister && (
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Come ti chiami?" />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@esempio.it"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Attendere…' : isRegister ? 'Registrati' : 'Accedi'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {isRegister ? (
          <>
            Hai già un account?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Accedi
            </Link>
          </>
        ) : (
          <>
            Non hai un account?{' '}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Registrati
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
