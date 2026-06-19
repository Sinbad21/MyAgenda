'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  initial: {
    name: string;
    email: string;
    email_notifications: number;
    push_notifications: number;
    advance_days: number;
    weekly_summary: number;
  };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function SettingsForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [email, setEmailN] = useState(!!initial.email_notifications);
  const [push, setPush] = useState(!!initial.push_notifications);
  const [advance, setAdvance] = useState(initial.advance_days);
  const [weekly, setWeekly] = useState(!!initial.weekly_summary);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  async function enablePush(): Promise<boolean> {
    if (!vapidKey) {
      setMsg('Web Push non configurato sul server (manca la chiave VAPID).');
      return false;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setMsg('Il tuo browser non supporta le notifiche push.');
      return false;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      setMsg('Permesso notifiche negato.');
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
    const json = sub.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return true;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      let pushOn = push;
      if (push && !initial.push_notifications) {
        pushOn = await enablePush();
        setPush(pushOn);
      }
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          emailNotifications: email,
          pushNotifications: pushOn,
          advanceDays: advance,
          weeklySummary: weekly,
        }),
      });
      setMsg('Impostazioni salvate ✓');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="font-semibold text-slate-800">Profilo e notifiche</h2>
      <div>
        <label className="label">Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="mt-1 text-xs text-slate-400">{initial.email}</p>
      </div>

      <label className="flex items-center justify-between text-sm">
        <span>📧 Notifiche via email</span>
        <input type="checkbox" checked={email} onChange={(e) => setEmailN(e.target.checked)} />
      </label>
      <label className="flex items-center justify-between text-sm">
        <span>🔔 Notifiche push del browser</span>
        <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
      </label>
      <label className="flex items-center justify-between text-sm">
        <span>📊 Riepilogo settimanale</span>
        <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
      </label>

      <div>
        <label className="label">Avvisami con anticipo di (giorni)</label>
        <input
          className="input w-28"
          type="number"
          min={0}
          max={365}
          value={advance}
          onChange={(e) => setAdvance(Number(e.target.value))}
        />
      </div>

      {msg && <p className="text-sm text-slate-600">{msg}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? 'Salvataggio…' : 'Salva impostazioni'}
      </button>
    </form>
  );
}
