'use client';
import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, Phone, MapPin, User } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, SkeletonRows, Toast, money } from '@/components/ui';
import { useDialog } from '@/components/Dialog';
import { FULFILLMENT_STATUS, DOC_TYPE, t } from '@/lib/labels';

interface OrderItem { id: string; name: string; quantity: string; unitPrice: string; total: string }
interface Invoice { id: string; documentType: string; series: string; number: number; status: string; pdfUrl?: string | null }
interface Order {
  id: string;
  createdAt: string;
  status: string; // OrderStatus
  fulfillmentStatus: string | null;
  total: string;
  note?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  items: OrderItem[];
  invoice?: Invoice | null;
  payments?: { amount: string }[];
}

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  PENDING: { to: 'PREPARING', label: 'Preparar' },
  PREPARING: { to: 'READY', label: 'Marcar listo' },
  READY: { to: 'DELIVERED', label: 'Marcar entregado' },
};
const FULFILL_CLASS: Record<string, string> = {
  PENDING: 'warn', PREPARING: 'neutral', READY: 'neutral', DELIVERED: 'ok', CANCELLED: 'err',
};

const TABS = [
  { key: 'ACTIVE', label: 'Activos' },
  { key: 'PENDING', label: 'Por preparar' },
  { key: 'PREPARING', label: 'En preparación' },
  { key: 'READY', label: 'Listos' },
  { key: 'DELIVERED', label: 'Entregados' },
];

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState('ACTIVE');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const dialog = useDialog();

  function load() {
    apiGet<Order[]>('/orders/online').then(setOrders).catch(() => setOrders([]));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!orders) return null;
    if (tab === 'ACTIVE') return orders.filter((o) => o.fulfillmentStatus && !['DELIVERED', 'CANCELLED'].includes(o.fulfillmentStatus));
    return orders.filter((o) => o.fulfillmentStatus === tab);
  }, [orders, tab]);

  async function advance(o: Order, to: string, label: string) {
    setBusy(o.id + to);
    setMsg(null);
    try {
      await apiPatch(`/orders/${o.id}/fulfillment`, { status: to });
      setMsg({ kind: 'ok', text: `Pedido ${label.toLowerCase()}.` });
      load();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally { setBusy(null); }
  }

  async function cancel(o: Order) {
    const ok = await dialog.confirm({ title: 'Anular pedido', message: '¿Anular este pedido online? Si aún no se cobró, quedará cancelado.', confirmText: 'Anular', danger: true });
    if (!ok) return;
    advance(o, 'CANCELLED', 'anulado');
  }

  async function emit(o: Order) {
    setBusy(o.id + 'emit');
    setMsg(null);
    try {
      const inv = await apiPost<Invoice>(`/invoices/emit/${o.id}`, { documentType: 'BOLETA' });
      setMsg({ kind: inv.status === 'REJECTED' ? 'err' : 'ok', text: `Boleta ${inv.series}-${inv.number} · ${inv.status}` });
      load();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally { setBusy(null); }
  }

  async function registerPayment(o: Order) {
    const paid = (o.payments ?? []).reduce((a, p) => a + Number(p.amount), 0);
    const balance = Math.round((Number(o.total) - paid) * 100) / 100;
    const ok = await dialog.confirm({ title: 'Registrar pago', message: `Registrar el pago de ${money(balance)} en efectivo para este pedido.`, confirmText: 'Registrar pago' });
    if (!ok) return;
    setBusy(o.id + 'pay');
    setMsg(null);
    try {
      await apiPost(`/receivables/${o.id}/payment`, { method: 'CASH', amount: balance });
      setMsg({ kind: 'ok', text: 'Pago registrado.' });
      load();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally { setBusy(null); }
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="page-label">Tu negocio online</div>
        <h1 className="page-title serif">Pedidos online</h1>
      </FadeIn>

      <FadeIn delay={0.04}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((tb) => {
            const count = orders
              ? (tb.key === 'ACTIVE'
                  ? orders.filter((o) => o.fulfillmentStatus && !['DELIVERED', 'CANCELLED'].includes(o.fulfillmentStatus)).length
                  : orders.filter((o) => o.fulfillmentStatus === tb.key).length)
              : 0;
            return (
              <button key={tb.key} className={tb.key === tab ? 'btn-primary' : 'btn-glass'} onClick={() => setTab(tb.key)}>
                {tb.label}{count > 0 ? ` · ${count}` : ''}
              </button>
            );
          })}
        </div>
      </FadeIn>

      <Toast msg={msg} />

      <FadeIn delay={0.08}>
        {filtered === null ? (
          <div className="panel liquid-glass"><SkeletonRows rows={4} cols={4} /></div>
        ) : filtered.length === 0 ? (
          <div className="panel liquid-glass">
            <EmptyState
              icon={<PackageCheck size={24} />}
              title="No hay pedidos aquí"
              description="Cuando lleguen pedidos desde tu tienda online aparecerán en este tablero para que los prepares y despaches."
            />
          </div>
        ) : (
          <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', alignItems: 'start' }}>
            {filtered.map((o) => {
              const fs = o.fulfillmentStatus ?? 'PENDING';
              const next = NEXT[fs];
              const paid = (o.payments ?? []).reduce((a, p) => a + Number(p.amount), 0);
              const isPaid = o.status === 'PAID' || paid >= Number(o.total);
              const closed = fs === 'DELIVERED' || fs === 'CANCELLED';
              return (
                <div key={o.id} className="panel liquid-glass col" style={{ gap: 12 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className={`badge ${FULFILL_CLASS[fs] ?? 'neutral'}`}>{t(FULFILLMENT_STATUS, fs)}</span>
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{new Date(o.createdAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </div>
                    <strong style={{ fontSize: 18 }}>{money(o.total)}</strong>
                  </div>

                  <div className="col" style={{ gap: 4, fontSize: 13 }}>
                    {o.contactName && <span className="row" style={{ gap: 6 }}><User size={14} className="muted" /> {o.contactName}</span>}
                    {o.contactPhone && <span className="row" style={{ gap: 6 }}><Phone size={14} className="muted" /> {o.contactPhone}</span>}
                    {o.contactAddress && <span className="row" style={{ gap: 6 }}><MapPin size={14} className="muted" /> {o.contactAddress}</span>}
                  </div>

                  <div className="col" style={{ gap: 2, fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    {o.items.map((it) => (
                      <div key={it.id} className="row" style={{ justifyContent: 'space-between' }}>
                        <span>{Number(it.quantity)}× {it.name}</span>
                        <span className="muted">{money(it.total)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${isPaid ? 'ok' : 'warn'}`}>{isPaid ? 'Pagado' : 'Por cobrar'}</span>
                    {o.invoice
                      ? <span className="badge neutral">{t(DOC_TYPE, o.invoice.documentType)} {o.invoice.series}-{String(o.invoice.number).padStart(8, '0')}</span>
                      : <span className="badge neutral">Sin comprobante</span>}
                  </div>

                  {!closed && (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      {next && (
                        <button className="btn-primary" disabled={busy === o.id + next.to} onClick={() => advance(o, next.to, next.label)}>
                          {busy === o.id + next.to ? '…' : next.label}
                        </button>
                      )}
                      {!isPaid && <button className="btn-glass" disabled={busy === o.id + 'pay'} onClick={() => registerPayment(o)}>Registrar pago</button>}
                      {!o.invoice && <button className="btn-glass" disabled={busy === o.id + 'emit'} onClick={() => emit(o)}>Emitir boleta</button>}
                      <button className="btn-glass" onClick={() => cancel(o)}>Anular</button>
                    </div>
                  )}
                  {o.invoice && (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {o.invoice.pdfUrl && <a className="badge neutral" href={o.invoice.pdfUrl} target="_blank" rel="noreferrer">PDF SUNAT</a>}
                      <a className="badge neutral" href={`/imprimir/${o.invoice.id}`} target="_blank" rel="noreferrer">Imprimir</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </FadeIn>
    </div>
  );
}
