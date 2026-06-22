'use client';
import { useEffect, useState } from 'react';
import { ClipboardList, Ban } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, SkeletonRows, Toast, money } from '@/components/ui';
import { DOC_TYPE, t } from '@/lib/labels';

interface OrderInvoice {
  documentType: string;
  series: string;
  number: number;
  status: string;
}
interface Order {
  id: string;
  status: string;
  total: number | string;
  createdAt: string;
  saleType: string;
  customer?: { name: string } | null;
  invoice?: OrderInvoice | null;
}

const SALE_TYPE: Record<string, string> = {
  LOCAL: 'Local',
  ONLINE: 'Online',
  DELIVERY: 'Delivery',
};

function estadoBadge(status: string): { cls: string; label: string } {
  switch (status) {
    case 'PAID':
      return { cls: 'ok', label: 'Pagada' };
    case 'PENDING_PAYMENT':
      return { cls: 'warn', label: 'Por cobrar' };
    case 'OPEN':
      return { cls: 'neutral', label: 'Abierta' };
    case 'CANCELLED':
    case 'VOIDED':
      return { cls: 'neutral', label: 'Anulada' };
    default:
      return { cls: 'neutral', label: status };
  }
}

export default function VentasPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  function load() {
    apiGet<Order[]>('/orders').then(setOrders).catch(() => setOrders([]));
  }
  useEffect(load, []);

  async function anular(id: string) {
    const reason = window.prompt('Motivo de la anulación (opcional):');
    if (reason === null) return;
    setBusy(id);
    setMsg(null);
    try {
      await apiPost(`/orders/${id}/cancel`, { reason: reason || undefined });
      setMsg({ kind: 'ok', text: 'Venta anulada. Se revirtió el stock y la caja.' });
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="page-label">Ventas</div>
        <h1 className="page-title serif">Ventas</h1>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="col" style={{ gap: 12 }}>
          <Toast msg={msg} />
          {orders === null ? (
            <div className="panel liquid-glass"><SkeletonRows rows={6} cols={6} /></div>
          ) : orders.length === 0 ? (
            <div className="panel liquid-glass">
              <EmptyState icon={<ClipboardList size={24} />} title="Aún no hay ventas" description="Cuando registres tu primera venta desde el punto de venta, aparecerá aquí." />
            </div>
          ) : (
          <div className="panel liquid-glass">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Comprobante</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const badge = estadoBadge(o.status);
                  const cancelable =
                    o.status !== 'CANCELLED' &&
                    o.status !== 'VOIDED' &&
                    (!o.invoice || o.invoice.status === 'REJECTED');
                  return (
                    <tr key={o.id}>
                      <td className="muted">{new Date(o.createdAt).toLocaleString('es-PE')}</td>
                      <td>{o.customer?.name ?? '—'}</td>
                      <td>{t(SALE_TYPE, o.saleType)}</td>
                      <td className="muted">
                        {o.invoice ? `${t(DOC_TYPE, o.invoice.documentType)} ${o.invoice.series}-${o.invoice.number}` : '—'}
                      </td>
                      <td className="num">{money(Number(o.total))}</td>
                      <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {cancelable && (
                            <button className="badge err" disabled={busy === o.id} onClick={() => anular(o.id)}>
                              <Ban size={12} style={{ verticalAlign: -2 }} /> Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
