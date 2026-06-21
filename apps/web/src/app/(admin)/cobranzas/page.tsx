'use client';
import { useEffect, useState } from 'react';
import { Wallet, MessageCircle, HandCoins } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, SkeletonRows, StatCard, Toast, money } from '@/components/ui';
import { useDialog } from '@/components/Dialog';
import { PAYMENT_METHOD } from '@/lib/labels';

interface Cuenta {
  orderId: string;
  vence: string | null;
  diasVencido: number;
  vencido: boolean;
  cliente: string;
  clienteTelefono: string | null;
  comprobante: string | null;
  total: number;
  pagado: number;
  saldo: number;
}
interface Data {
  totalPorCobrar: number;
  vencido: number;
  porVencer: number;
  cuentas: Cuenta[];
}

export default function CobranzasPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const dialog = useDialog();

  function load() {
    apiGet<Data>('/receivables').then(setData).catch(() => setData({ totalPorCobrar: 0, vencido: 0, porVencer: 0, cuentas: [] }));
  }
  useEffect(load, []);

  async function cobrar(c: Cuenta) {
    const res = await dialog.prompt({
      title: `Registrar cobro`,
      message: `${c.cliente} · saldo ${money(c.saldo)}`,
      confirmText: 'Registrar',
      fields: [
        { name: 'amount', label: 'Monto a cobrar', type: 'number', value: String(c.saldo), required: true },
        { name: 'method', label: 'Método de pago', value: 'CASH', options: ['CASH', 'YAPE', 'PLIN', 'TRANSFER', 'CARD'].map((m) => ({ value: m, label: PAYMENT_METHOD[m] })) },
      ],
    });
    if (!res) return;
    const amount = Number(res.amount);
    if (!amount || amount <= 0) return;
    setBusy(c.orderId);
    setMsg(null);
    try {
      await apiPost(`/receivables/${c.orderId}/payment`, { method: res.method, amount });
      setMsg({ kind: 'ok', text: `Cobro de ${money(amount)} registrado.` });
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function recordar(c: Cuenta) {
    const venc = c.vence ? new Date(c.vence).toLocaleDateString('es-PE') : 'pronto';
    const texto = `Hola ${c.cliente}, te recordamos tu saldo pendiente de ${money(c.saldo)}${c.comprobante ? ` (${c.comprobante})` : ''} con vencimiento ${venc}. ¡Gracias!`;
    const phone = (c.clienteTelefono ?? '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(texto)}`, '_blank');
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="page-label">Finanzas</div>
        <h1 className="page-title serif">Cobranzas</h1>
        <p className="muted" style={{ maxWidth: 640 }}>
          Cuentas por cobrar de tus ventas al crédito. Registra abonos y envía recordatorios por WhatsApp.
        </p>
      </FadeIn>

      <Toast msg={msg} />

      {!data && <div className="panel liquid-glass"><SkeletonRows rows={5} cols={4} /></div>}

      {data && (
        <>
          <FadeIn delay={0.05}>
            <div className="kpi-grid">
              <StatCard label="Total por cobrar" value={money(data.totalPorCobrar)} />
              <StatCard label="Vencido" value={money(data.vencido)} sub="requiere gestión" />
              <StatCard label="Por vencer" value={money(data.porVencer)} />
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            {data.cuentas.length === 0 ? (
              <div className="panel liquid-glass">
                <EmptyState icon={<Wallet size={24} />} title="¡Todo al día!" description="No tienes cuentas por cobrar. Las ventas al crédito con saldo pendiente aparecerán aquí." />
              </div>
            ) : (
            <div className="panel liquid-glass">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th><th>Comprobante</th><th>Vence</th><th className="num">Saldo</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cuentas.map((c) => (
                    <tr key={c.orderId}>
                      <td>{c.cliente}</td>
                      <td className="muted">{c.comprobante ?? '—'}</td>
                      <td>
                        {c.vence ? new Date(c.vence).toLocaleDateString('es-PE') : '—'}{' '}
                        {c.vencido && <span className="badge err">{c.diasVencido}d</span>}
                      </td>
                      <td className="num"><strong>{money(c.saldo)}</strong></td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <button className="badge ok" disabled={busy === c.orderId} onClick={() => cobrar(c)}>
                            <HandCoins size={12} style={{ verticalAlign: -2 }} /> Cobrar
                          </button>
                          {c.clienteTelefono && (
                            <button className="badge neutral" onClick={() => recordar(c)}>
                              <MessageCircle size={12} style={{ verticalAlign: -2 }} /> Recordar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </FadeIn>
        </>
      )}
    </div>
  );
}
