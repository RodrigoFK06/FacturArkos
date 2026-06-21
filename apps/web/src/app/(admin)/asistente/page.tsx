'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Sparkles, Send, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import { FadeIn } from '@/components/ui';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

const SUGERENCIAS = [
  '¿Cuánto vendí hoy?',
  '¿Qué productos están por agotarse?',
  '¿Cuánto IGV debo pagar este mes?',
  '¿Cuáles son mis productos más vendidos?',
  '¿Tengo comprobantes pendientes en SUNAT?',
];

export default function AsistentePage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<{ available: boolean }>('/ai/status').then((s) => setAvailable(s.available)).catch(() => setAvailable(false));
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);

  async function send(question: string) {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setBusy(true);
    try {
      const r = await apiPost<{ answer: string }>('/ai/ask', { question });
      setMsgs((m) => [...m, { role: 'assistant', text: r.answer }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: 'assistant', text: `⚠️ ${(err as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="col" style={{ gap: 24 }}>
      <FadeIn>
        <div className="page-label">Inteligencia artificial</div>
        <h1 className="page-title serif">Asistente IA</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Pregúntale en lenguaje natural sobre tu negocio: ventas, stock, IGV, comprobantes. Responde con tus datos en vivo.
        </p>
      </FadeIn>

      {available === false && (
        <FadeIn>
          <div className="panel" style={{ borderColor: 'var(--warn)' }}>
            <div className="row" style={{ gap: 10, marginBottom: 6 }}>
              <Sparkles size={18} style={{ color: 'var(--warn)' }} />
              <strong>IA no configurada</strong>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Para activar el asistente, define <code>AI_API_KEY</code> (y opcionalmente <code>AI_BASE_URL</code>/<code>AI_MODEL</code>) en el servidor y reinicia. Funciona con cualquier proveedor compatible con OpenAI — por defecto <strong>DeepSeek</strong> (económico). Mientras tanto, el resto del sistema funciona normal.
            </p>
          </div>
        </FadeIn>
      )}

      <div className="dash-grid">
        <FadeIn delay={0.05}>
          <div className="panel liquid-glass col" style={{ gap: 14, minHeight: 420 }}>
            <div className="col" style={{ gap: 12, flex: 1, maxHeight: 460, overflowY: 'auto' }}>
              {msgs.length === 0 && (
                <div className="col" style={{ gap: 10, alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', color: 'var(--faint)', padding: 30 }}>
                  <Sparkles size={32} style={{ color: 'var(--accent)' }} />
                  <p style={{ margin: 0 }}>Hazme una pregunta sobre tu negocio.</p>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 14,
                      background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                      color: m.role === 'user' ? '#fff' : 'var(--text)',
                      border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                      whiteSpace: 'pre-wrap',
                      fontSize: 14.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {busy && <div className="muted" style={{ fontSize: 13 }}>Pensando…</div>}
              <div ref={endRef} />
            </div>
            <form className="row" style={{ gap: 8 }} onSubmit={onSubmit}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu pregunta…"
                disabled={busy || available === false}
              />
              <button className="btn-primary row" style={{ gap: 6 }} type="submit" disabled={busy || available === false}>
                <Send size={16} /> Enviar
              </button>
            </form>
          </div>
        </FadeIn>

        <div className="col" style={{ gap: 16 }}>
          <div className="panel">
            <h2 className="serif" style={{ fontSize: 16, margin: '0 0 10px' }}>Prueba preguntar</h2>
            <div className="col" style={{ gap: 8 }}>
              {SUGERENCIAS.map((s) => (
                <button key={s} className="btn-glass" style={{ textAlign: 'left', fontSize: 13.5 }} disabled={busy || available === false} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Link href="/escanear-compra" className="panel" style={{ display: 'block', color: 'var(--text)' }}>
            <div className="row" style={{ gap: 10, marginBottom: 6 }}>
              <ScanLine size={18} style={{ color: 'var(--accent)' }} />
              <strong>Escanear factura de compra</strong>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Sube una foto o PDF y la IA extrae proveedor e ítems.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
