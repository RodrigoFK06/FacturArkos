'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, Toast, money } from '@/components/ui';

interface Purchase {
  id: string;
  issueDate: string;
  total: string;
  series?: string | null;
  number?: string | null;
  supplier: { businessName: string; ruc: string };
  items: { id: string }[];
}
interface Supplier { id: string; businessName: string; ruc: string }
interface Warehouse { id: string; name: string }
interface Product { id: string; name: string; cost: string | number }
interface Line { productId: string; quantity: string; unitCost: string }

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: '1', unitCost: '' }]);
  const [newSup, setNewSup] = useState({ ruc: '', businessName: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiGet<Purchase[]>('/purchases').then(setPurchases).catch(() => setPurchases([]));
    apiGet<Supplier[]>('/suppliers').then((s) => { setSuppliers(s); if (s[0] && !supplierId) setSupplierId(s[0].id); }).catch(() => undefined);
    apiGet<Warehouse[]>('/inventory/warehouses').then((w) => { setWarehouses(w); if (w[0] && !warehouseId) setWarehouseId(w[0].id); }).catch(() => undefined);
    apiGet<Product[]>('/products').then(setProducts).catch(() => undefined);
  }
  useEffect(load, []);

  async function createSupplier() {
    if (!/^(10|15|17|20)\d{9}$/.test(newSup.ruc) || newSup.businessName.length < 2) {
      setMsg({ kind: 'err', text: 'RUC (11 díg.) y razón social requeridos.' });
      return;
    }
    try {
      const s = await apiPost<Supplier>('/suppliers', newSup);
      setNewSup({ ruc: '', businessName: '' });
      setSuppliers((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
      setSupplierId(s.id);
      setMsg({ kind: 'ok', text: `Proveedor ${s.businessName} guardado.` });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function onPickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLine(i, { productId, unitCost: p ? String(Number(p.cost)) : '' });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => {
        const p = products.find((x) => x.id === l.productId)!;
        return { productId: l.productId, name: p.name, quantity: Number(l.quantity), unitCost: Number(l.unitCost || 0) };
      });
    if (!supplierId || !warehouseId || items.length === 0) {
      setMsg({ kind: 'err', text: 'Selecciona proveedor, almacén y al menos un producto.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiPost('/purchases', { supplierId, warehouseId, items });
      setMsg({ kind: 'ok', text: 'Compra registrada — stock y costo actualizados.' });
      setLines([{ productId: '', quantity: '1', unitCost: '' }]);
      setOpen(false);
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="page-label">Abastecimiento</div>
            <h1 className="page-title serif">Compras</h1>
          </div>
          <button className="btn-primary row" style={{ gap: 6 }} onClick={() => setOpen((o) => !o)}>
            <Plus size={16} /> Registrar compra
          </button>
        </div>
      </FadeIn>

      {open && (
        <FadeIn>
          <form className="panel liquid-glass col" style={{ gap: 14 }} onSubmit={submit}>
            <div className="grid-2">
              <Field label="Proveedor">
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">—</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.businessName} ({s.ruc})</option>)}
                </select>
              </Field>
              <Field label="Almacén (recepción)">
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
            </div>

            <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
              <Field label="Nuevo proveedor — RUC"><input value={newSup.ruc} onChange={(e) => setNewSup({ ...newSup, ruc: e.target.value })} placeholder="20XXXXXXXXX" /></Field>
              <Field label="Razón social"><input value={newSup.businessName} onChange={(e) => setNewSup({ ...newSup, businessName: e.target.value })} /></Field>
              <button type="button" className="btn-glass liquid-glass" onClick={createSupplier}>Agregar</button>
            </div>

            <div className="col" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>Ítems</span>
              {lines.map((l, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <select style={{ flex: 2 }} value={l.productId} onChange={(e) => onPickProduct(i, e.target.value)}>
                    <option value="">Producto…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input style={{ flex: 1 }} type="number" step="0.001" placeholder="Cant." value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                  <input style={{ flex: 1 }} type="number" step="0.0001" placeholder="Costo unit." value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} />
                  <button type="button" className="btn-glass" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" className="btn-glass liquid-glass" style={{ alignSelf: 'flex-start' }} onClick={() => setLines((p) => [...p, { productId: '', quantity: '1', unitCost: '' }])}>
                + Ítem
              </button>
            </div>

            <Toast msg={msg} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>
              {busy ? 'Registrando…' : 'Registrar compra'}
            </button>
          </form>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="panel liquid-glass">
          {purchases === null ? (
            <SkeletonRows rows={5} cols={5} />
          ) : purchases.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={24} />}
              title="Aún no hay compras"
              description="Registra la compra a un proveedor para actualizar tu stock y el costo promedio de tus productos."
              action={<button className="btn-primary" onClick={() => setOpen(true)}>Registrar compra</button>}
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Documento</th>
                  <th>Emisión</th>
                  <th className="num">Ítems</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td>{p.supplier.businessName}<div className="muted" style={{ fontSize: 12 }}>{p.supplier.ruc}</div></td>
                    <td className="muted">{p.series && p.number ? `${p.series}-${p.number}` : '—'}</td>
                    <td className="muted">{p.issueDate}</td>
                    <td className="num">{p.items.length}</td>
                    <td className="num">{money(p.total)}</td>
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
