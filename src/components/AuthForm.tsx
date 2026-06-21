'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AuthForm({
  mode,
  googleEnabled = false,
  errorMessage,
}: {
  mode: 'login' | 'register';
  googleEnabled?: boolean;
  errorMessage?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(errorMessage ?? null);
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
      const data = await res.json() as any;
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
        {googleEnabled && (
          <>
            <a
              href="/api/auth/google"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
                />
              </svg>
              Continua con Google
            </a>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              oppure
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}
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
