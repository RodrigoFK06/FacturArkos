'use client';
import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { FadeIn, Field, Toast, money } from '@/components/ui';

interface Movement { id: string; type: string; amount: string; concept?: string | null; createdAt: string; }
interface Session {
  id: string;
  openingAmount: string;
  status: string;
  openedAt: string;
  closingAmount?: string | null;
  expectedAmount?: string | null;
  movements: Movement[];
}

const MOV_LABEL: Record<string, string> = {
  OPENING: 'Apertura', SALE_INCOME: 'Venta', INCOME: 'Ingreso', EXPENSE: 'Gasto', WITHDRAWAL: 'Retiro', CLOSING: 'Cierre',
};
const sign = (t: string) => (t === 'EXPENSE' || t === 'WITHDRAWAL' ? -1 : 1);

export default function CajaPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [establishmentId, setEstablishmentId] = useState('');
  const [opening, setOpening] = useState('0');
  const [mov, setMov] = useState({ type: 'INCOME', amount: '', concept: '' });
  const [counted, setCounted] = useState('');
  const [closed, setClosed] = useState<Session | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiGet<Session | null>('/cash/current').then((s) => setSession(s ?? null)).catch(() => undefined);
    apiGet<{ id: string }[]>('/establishments').then((e) => e[0] && setEstablishmentId(e[0].id)).catch(() => undefined);
  }
  useEffect(load, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); } finally { setBusy(false); }
  }

  const balance = session
    ? Number(session.openingAmount) + session.movements.reduce((a, m) => a + sign(m.type) * Number(m.amount), 0)
    : 0;

  return (
    <div className="col" style={{ gap: 24 }}>
      <FadeIn>
        <div className="page-label">Operación</div>
        <h1 className="page-title serif">Caja</h1>
      </FadeIn>

      {/* Arqueo de cierre reciente */}
      {closed && (
        <FadeIn>
          <div className="panel" style={{ maxWidth: 560 }}>
            <h2 className="serif" style={{ fontSize: 19, margin: '0 0 12px' }}>Arqueo de cierre</h2>
            <Row k="Esperado en caja" v={money(closed.expectedAmount)} />
            <Row k="Contado" v={money(closed.closingAmount)} />
            <Row k="Diferencia" v={money(Number(closed.closingAmount) - Number(closed.expectedAmount))} strong />
            <button className="btn-glass" style={{ marginTop: 14 }} onClick={() => { setClosed(null); load(); }}>Cerrar</button>
          </div>
        </FadeIn>
      )}

      {!session && !closed && (
        <FadeIn delay={0.05}>
          <div className="panel col" style={{ gap: 14, maxWidth: 460 }}>
            <div className="row" style={{ gap: 8 }}><Unlock size={18} className="muted" /><h2 className="serif" style={{ fontSize: 19, margin: 0 }}>Abrir caja</h2></div>
            <Field label="Monto inicial (S/)"><input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
            <Toast msg={msg} />
            <button className="btn-primary" disabled={busy || !establishmentId} style={{ alignSelf: 'flex-start' }}
              onClick={() => run(async () => { await apiPost('/cash/open', { establishmentId, openingAmount: Number(opening || 0) }); load(); })}>
              {busy ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </div>
        </FadeIn>
      )}

      {session && (
        <div className="dash-grid">
          <div className="col" style={{ gap: 16 }}>
            <FadeIn delay={0.05}>
              <div className="panel">
                <h2 className="serif" style={{ fontSize: 19, margin: '0 0 12px' }}>Movimientos</h2>
                <table className="table">
                  <thead><tr><th>Tipo</th><th>Concepto</th><th className="num">Monto</th></tr></thead>
                  <tbody>
                    <tr><td><span className="badge neutral">Apertura</span></td><td className="muted">Saldo inicial</td><td className="num">{money(session.openingAmount)}</td></tr>
                    {session.movements.map((m) => (
                      <tr key={m.id}>
                        <td><span className="badge neutral">{MOV_LABEL[m.type] ?? m.type}</span></td>
                        <td className="muted">{m.concept || '—'}</td>
                        <td className="num" style={{ color: sign(m.type) < 0 ? 'var(--err)' : 'inherit' }}>{sign(m.type) < 0 ? '−' : '+'}{money(m.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FadeIn>
          </div>

          <div className="col" style={{ gap: 16 }}>
            <FadeIn delay={0.05}>
              <div className="panel">
                <div className="kpi-label">Saldo en caja</div>
                <div className="kpi-value serif">{money(balance)}</div>
                <div className="kpi-sub">Apertura {money(session.openingAmount)} · {session.movements.length} movimientos</div>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="panel col" style={{ gap: 10 }}>
                <h2 className="serif" style={{ fontSize: 17, margin: 0 }}>Registrar movimiento</h2>
                <select value={mov.type} onChange={(e) => setMov({ ...mov, type: e.target.value })}>
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Gasto</option>
                  <option value="WITHDRAWAL">Retiro</option>
                </select>
                <input type="number" step="0.01" placeholder="Monto" value={mov.amount} onChange={(e) => setMov({ ...mov, amount: e.target.value })} />
                <input placeholder="Concepto" value={mov.concept} onChange={(e) => setMov({ ...mov, concept: e.target.value })} />
                <button className="btn-glass" disabled={busy || !mov.amount}
                  onClick={() => run(async () => { await apiPost(`/cash/${session.id}/movements`, { type: mov.type, amount: Number(mov.amount), concept: mov.concept || undefined }); setMov({ type: 'INCOME', amount: '', concept: '' }); load(); })}>
                  Agregar
                </button>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="panel col" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 8 }}><Lock size={16} className="muted" /><h2 className="serif" style={{ fontSize: 17, margin: 0 }}>Cerrar caja</h2></div>
                <Field label="Efectivo contado (S/)"><input type="number" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} /></Field>
                <Toast msg={msg} />
                <button className="btn-primary" disabled={busy || counted === ''}
                  onClick={() => run(async () => { const r = await apiPost<Session>(`/cash/${session.id}/close`, { countedAmount: Number(counted) }); setClosed(r); setSession(null); setCounted(''); })}>
                  {busy ? 'Cerrando…' : 'Cerrar caja y arquear'}
                </button>
              </div>
            </FadeIn>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontWeight: strong ? 600 : 400 }}>
      <span className={strong ? '' : 'muted'}>{k}</span><span>{v}</span>
    </div>
  );
}
