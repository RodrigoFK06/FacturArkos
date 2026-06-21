'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Package, ArrowLeftRight, PackagePlus } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, Toast } from '@/components/ui';

interface StockRow {
  id: string;
  quantity: string;
  product: { name: string; code?: string | null; unitCode: string };
  warehouse: { name: string };
}
interface LowStock { id: string; name: string; stock: number; minStock: number }
interface Product { id: string; name: string }
interface Warehouse { id: string; name: string }

const MOV_TYPES = [
  { value: 'ADJUST_IN', label: 'Ingreso / ajuste (+)' },
  { value: 'ADJUST_OUT', label: 'Salida / merma (−)' },
  { value: 'INITIAL', label: 'Stock inicial' },
  { value: 'RETURN_IN', label: 'Devolución (+)' },
];

export default function InventoryPage() {
  const [stock, setStock] = useState<StockRow[] | null>(null);
  const [low, setLow] = useState<LowStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [panel, setPanel] = useState<'none' | 'movement' | 'transfer'>('none');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [mov, setMov] = useState({ productId: '', warehouseId: '', type: 'ADJUST_IN', quantity: '', unitCost: '', reference: '' });
  const [trf, setTrf] = useState({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', reference: '' });

  function loadStock() {
    apiGet<StockRow[]>('/inventory/stock').then(setStock).catch(() => setStock([]));
    apiGet<LowStock[]>('/inventory/alerts/low-stock').then(setLow).catch(() => undefined);
  }
  useEffect(() => {
    loadStock();
    apiGet<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiGet<Warehouse[]>('/inventory/warehouses').then((w) => {
      setWarehouses(w);
      const main = w[0]?.id ?? '';
      setMov((m) => ({ ...m, warehouseId: main }));
      setTrf((t) => ({ ...t, fromWarehouseId: main, toWarehouseId: w[1]?.id ?? '' }));
    }).catch(() => undefined);
  }, []);

  async function submitMovement() {
    if (!mov.productId || !mov.warehouseId || !(Number(mov.quantity) > 0)) {
      setMsg({ kind: 'err', text: 'Producto, almacén y cantidad (> 0) son obligatorios.' });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      await apiPost('/inventory/movements', {
        productId: mov.productId, warehouseId: mov.warehouseId, type: mov.type,
        quantity: Number(mov.quantity),
        ...(mov.unitCost ? { unitCost: Number(mov.unitCost) } : {}),
        ...(mov.reference ? { reference: mov.reference } : {}),
      });
      setMsg({ kind: 'ok', text: 'Movimiento registrado.' });
      setMov((m) => ({ ...m, quantity: '', unitCost: '', reference: '' }));
      setPanel('none');
      loadStock();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  async function submitTransfer() {
    if (!trf.productId || !trf.fromWarehouseId || !trf.toWarehouseId || !(Number(trf.quantity) > 0)) {
      setMsg({ kind: 'err', text: 'Producto, almacenes y cantidad (> 0) son obligatorios.' });
      return;
    }
    if (trf.fromWarehouseId === trf.toWarehouseId) {
      setMsg({ kind: 'err', text: 'El almacén de origen y destino deben ser distintos.' });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      await apiPost('/inventory/transfers', {
        productId: trf.productId, fromWarehouseId: trf.fromWarehouseId, toWarehouseId: trf.toWarehouseId,
        quantity: Number(trf.quantity), ...(trf.reference ? { reference: trf.reference } : {}),
      });
      setMsg({ kind: 'ok', text: 'Traslado registrado.' });
      setTrf((t) => ({ ...t, quantity: '', reference: '' }));
      setPanel('none');
      loadStock();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="page-label">Almacén</div>
            <h1 className="page-title serif">Inventario</h1>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-glass row" style={{ gap: 6 }} onClick={() => setPanel(panel === 'movement' ? 'none' : 'movement')}>
              <PackagePlus size={16} /> Registrar movimiento
            </button>
            <button className="btn-glass row" style={{ gap: 6 }} onClick={() => setPanel(panel === 'transfer' ? 'none' : 'transfer')} disabled={warehouses.length < 2}>
              <ArrowLeftRight size={16} /> Trasladar
            </button>
          </div>
        </div>
      </FadeIn>

      {panel === 'movement' && (
        <FadeIn>
          <div className="panel liquid-glass col" style={{ gap: 14 }}>
            <h2 className="serif" style={{ fontSize: 20, margin: 0 }}>Movimiento manual</h2>
            <div className="grid-2">
              <Field label="Producto">
                <select value={mov.productId} onChange={(e) => setMov({ ...mov, productId: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Almacén">
                <select value={mov.warehouseId} onChange={(e) => setMov({ ...mov, warehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Tipo">
                <select value={mov.type} onChange={(e) => setMov({ ...mov, type: e.target.value })}>
                  {MOV_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Cantidad"><input type="number" step="0.001" min="0" value={mov.quantity} onChange={(e) => setMov({ ...mov, quantity: e.target.value })} /></Field>
              <Field label="Costo unitario (opcional)"><input type="number" step="0.0001" min="0" value={mov.unitCost} onChange={(e) => setMov({ ...mov, unitCost: e.target.value })} placeholder="Para ingresos" /></Field>
              <Field label="Referencia (opcional)"><input value={mov.reference} onChange={(e) => setMov({ ...mov, reference: e.target.value })} placeholder="Motivo / documento" /></Field>
            </div>
            <Toast msg={msg} />
            <button className="btn-primary" disabled={busy} style={{ alignSelf: 'flex-start' }} onClick={submitMovement}>{busy ? 'Registrando…' : 'Registrar movimiento'}</button>
          </div>
        </FadeIn>
      )}

      {panel === 'transfer' && (
        <FadeIn>
          <div className="panel liquid-glass col" style={{ gap: 14 }}>
            <h2 className="serif" style={{ fontSize: 20, margin: 0 }}>Traslado entre almacenes</h2>
            <div className="grid-2">
              <Field label="Producto">
                <select value={trf.productId} onChange={(e) => setTrf({ ...trf, productId: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Cantidad"><input type="number" step="0.001" min="0" value={trf.quantity} onChange={(e) => setTrf({ ...trf, quantity: e.target.value })} /></Field>
              <Field label="Desde">
                <select value={trf.fromWarehouseId} onChange={(e) => setTrf({ ...trf, fromWarehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Hacia">
                <select value={trf.toWarehouseId} onChange={(e) => setTrf({ ...trf, toWarehouseId: e.target.value })}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Referencia (opcional)"><input value={trf.reference} onChange={(e) => setTrf({ ...trf, reference: e.target.value })} /></Field>
            </div>
            <Toast msg={msg} />
            <button className="btn-primary" disabled={busy} style={{ alignSelf: 'flex-start' }} onClick={submitTransfer}>{busy ? 'Registrando…' : 'Registrar traslado'}</button>
          </div>
        </FadeIn>
      )}

      {panel === 'none' && <Toast msg={msg} />}

      {(low?.length ?? 0) > 0 && (
        <FadeIn delay={0.05}>
          <div className="panel liquid-glass">
            <div className="row" style={{ gap: 8, marginBottom: 12, color: 'var(--warn)' }}>
              <AlertTriangle size={18} />
              <h2 className="serif" style={{ fontSize: 22, margin: 0 }}>Stock bajo el mínimo</h2>
            </div>
            <table className="table">
              <thead>
                <tr><th>Producto</th><th className="num">Stock</th><th className="num">Mínimo</th></tr>
              </thead>
              <tbody>
                {low.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="num"><span className="badge warn">{p.stock}</span></td>
                    <td className="num">{p.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="panel liquid-glass">
          <h2 className="serif" style={{ fontSize: 24, margin: '0 0 12px' }}>Existencias por almacén</h2>
          {stock === null ? (
            <SkeletonRows rows={5} cols={4} />
          ) : stock.length === 0 ? (
            <EmptyState
              icon={<Package size={24} />}
              title="Aún no hay existencias"
              description="Registra un movimiento de ingreso o una compra y verás aquí el stock por almacén."
              action={<button className="btn-primary" onClick={() => setPanel('movement')}>Registrar movimiento</button>}
            />
          ) : (
            <table className="table">
              <thead>
                <tr><th>Producto</th><th>Almacén</th><th className="num">Cantidad</th><th>Unidad</th></tr>
              </thead>
              <tbody>
                {stock.map((s) => (
                  <tr key={s.id}>
                    <td>{s.product.name}</td>
                    <td className="muted">{s.warehouse.name}</td>
                    <td className="num">{Number(s.quantity)}</td>
                    <td className="muted">{s.product.unitCode}</td>
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
