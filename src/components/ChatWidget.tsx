'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

export default function ChatWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text:
        'Ciao! Scrivimi in linguaggio naturale, ad es. "oggi ho speso 40,44 € di benzina" oppure "domani ho il dentista alle 10".',
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const updatedMessages = [...messages, { role: 'user' as const, text }];
    setMessages(updatedMessages);
    setBusy(true);
    try {
      // Invia la storia (escluso il messaggio di benvenuto iniziale e quello corrente)
      const history = updatedMessages
        .slice(1, -1)
        .map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json() as any;
      const reply = res.ok
        ? [data.reply, ...(data.insights || [])].filter(Boolean).join('\n')
        : data.error || 'Qualcosa è andato storto.';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
      if (res.ok && !data.needs_clarification) router.refresh();
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Errore di rete, riprova.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Pulsante fisso */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Apri assistente"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow-lg transition hover:bg-brand-700 md:bottom-6"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="fixed bottom-36 right-4 z-30 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 md:bottom-24">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-brand-600 px-4 py-3 text-white">
            <span className="text-lg">🤖</span>
            <div>
              <p className="text-sm font-semibold leading-none">Assistente MyAgenda</p>
              <p className="text-[11px] text-brand-100">Inserimento in linguaggio naturale</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-brand-600 text-white'
                      : 'rounded-bl-sm bg-white text-slate-700 ring-1 ring-slate-200'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-slate-400">L&apos;assistente sta scrivendo…</div>}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-100 p-2">
            <input
              className="input"
              placeholder="Scrivi qui…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button className="btn-primary px-3" disabled={busy}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
