'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Plus, Trash2, FileText } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, Toast, money } from '@/components/ui';

type Kind = 'COTIZACION' | 'NOTA_VENTA';
interface Doc { id: string; kind: Kind; series: string; number: number; customerName?: string | null; total: string; status: string; }
interface Product { id: string; name: string; price: string | number; }
interface Line { productId: string; name: string; quantity: string; unitPrice: string; }

const STATUS_CLASS: Record<string, string> = { ABIERTA: 'warn', CONVERTIDA: 'ok', ANULADA: 'neutral' };
const STATUS_LABEL: Record<string, string> = { ABIERTA: 'Abierta', CONVERTIDA: 'Convertida', ANULADA: 'Anulada' };

export default function CotizacionesPage() {
  const [kind, setKind] = useState<Kind>('COTIZACION');
  const [list, setList] = useState<Doc[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', name: '', quantity: '1', unitPrice: '' }]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function load(k: Kind) {
    setList(null);
    apiGet<Doc[]>(`/commercial?kind=${k}`).then(setList).catch(() => setList([]));
  }
  useEffect(() => { load(kind); }, [kind]);
  useEffect(() => { apiGet<Product[]>('/products').then(setProducts).catch(() => undefined); }, []);

  const total = useMemo(() => lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0), [lines]);
  const label = kind === 'COTIZACION' ? 'Cotización' : 'Nota de venta';

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLine(i, { productId, name: p?.name ?? '', unitPrice: p ? String(Number(p.price)) : '' });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const items = lines.filter((l) => l.name && Number(l.quantity) > 0).map((l) => ({
      productId: l.productId || undefined,
      name: l.name,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice || 0),
    }));
    if (items.length === 0) { setMsg({ kind: 'err', text: 'Agrega al menos un ítem.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await apiPost('/commercial', { kind, customerName: customerName || undefined, items });
      setCustomerName(''); setLines([{ productId: '', name: '', quantity: '1', unitPrice: '' }]); setOpen(false);
      load(kind);
      setMsg({ kind: 'ok', text: `${label} creada.` });
    } catch (e2) { setMsg({ kind: 'err', text: (e2 as Error).message }); } finally { setBusy(false); }
  }

  async function convert(id: string) {
    if (!confirm('¿Convertir este documento en una venta?')) return;
    try {
      await apiPost(`/commercial/${id}/convert`, {});
      load(kind);
      setMsg({ kind: 'ok', text: 'Convertido a venta. La orden quedó registrada.' });
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }); }
  }

  return (
    <div className="col" style={{ gap: 24 }}>
      <FadeIn>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="page-label">Documentos</div>
            <h1 className="page-title serif">Cotizaciones y notas de venta</h1>
          </div>
          <button className="btn-primary row" style={{ gap: 6 }} onClick={() => setOpen((o) => !o)}><Plus size={16} /> Nueva {label.toLowerCase()}</button>
        </div>
      </FadeIn>

      <FadeIn delay={0.04}>
        <div className="row" style={{ gap: 8 }}>
          <button className={kind === 'COTIZACION' ? 'btn-primary' : 'btn-glass'} onClick={() => setKind('COTIZACION')}>Cotizaciones</button>
          <button className={kind === 'NOTA_VENTA' ? 'btn-primary' : 'btn-glass'} onClick={() => setKind('NOTA_VENTA')}>Notas de venta</button>
        </div>
      </FadeIn>

      {open && (
        <FadeIn>
          <form className="panel col" style={{ gap: 14, maxWidth: 760 }} onSubmit={submit}>
            <Field label="Cliente"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre del cliente" /></Field>
            <div className="col" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>Ítems</span>
              {lines.map((l, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <select style={{ flex: 2 }} value={l.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                    <option value="">Producto…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input style={{ flex: 1 }} type="number" step="0.001" placeholder="Cant." value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                  <input style={{ flex: 1 }} type="number" step="0.01" placeholder="Precio" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                  <button type="button" className="btn-glass" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="btn-glass" style={{ alignSelf: 'flex-start' }} onClick={() => setLines((p) => [...p, { productId: '', name: '', quantity: '1', unitPrice: '' }])}>+ Ítem</button>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 18 }}><span>Total</span><strong>{money(total)}</strong></div>
            <Toast msg={msg} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>{busy ? 'Guardando…' : `Crear ${label.toLowerCase()}`}</button>
          </form>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="panel">
          {msg && !open && <div style={{ marginBottom: 12 }}><Toast msg={msg} /></div>}
          {list === null ? (
            <SkeletonRows rows={5} cols={5} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<FileText size={24} />}
              title={`Sin ${label.toLowerCase()}s aún`}
              description={`Crea tu primera ${label.toLowerCase()} y conviértela en venta con un clic cuando el cliente acepte.`}
              action={<button className="btn-primary" onClick={() => setOpen(true)}>Nueva {label.toLowerCase()}</button>}
            />
          ) : (
            <table className="table">
              <thead><tr><th>Documento</th><th>Cliente</th><th className="num">Total</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id}>
                    <td><span className="muted">{d.series}-{String(d.number).padStart(8, '0')}</span></td>
                    <td>{d.customerName ?? '—'}</td>
                    <td className="num">{money(d.total)}</td>
                    <td><span className={`badge ${STATUS_CLASS[d.status] ?? 'neutral'}`}>{STATUS_LABEL[d.status] ?? d.status}</span></td>
                    <td>
                      {d.status === 'ABIERTA' && (
                        <button className="badge neutral row" style={{ gap: 5 }} onClick={() => convert(d.id)}><ArrowRightLeft size={13} /> Convertir a venta</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
