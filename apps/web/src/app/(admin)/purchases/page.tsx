'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, ShoppingCart, Users, Pencil, EyeOff, Eye } from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
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
interface Supplier { id: string; businessName: string; ruc: string; address?: string | null; phone?: string | null; email?: string | null; active: boolean }
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
  const [supForm, setSupForm] = useState({ ruc: '', businessName: '', address: '', phone: '', email: '' });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [supOpen, setSupOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  function loadSuppliers() {
    apiGet<Supplier[]>('/suppliers?all=1').then((s) => { setSuppliers(s); const active = s.filter((x) => x.active !== false); if (active[0] && !supplierId) setSupplierId(active[0].id); }).catch(() => undefined);
  }

  function load() {
    apiGet<Purchase[]>('/purchases').then(setPurchases).catch(() => setPurchases([]));
    loadSuppliers();
    apiGet<Warehouse[]>('/inventory/warehouses').then((w) => { setWarehouses(w); if (w[0] && !warehouseId) setWarehouseId(w[0].id); }).catch(() => undefined);
    apiGet<Product[]>('/products').then(setProducts).catch(() => undefined);
  }
  useEffect(load, []);

  function resetSupForm() {
    setSupForm({ ruc: '', businessName: '', address: '', phone: '', email: '' });
    setEditingSupplierId(null);
  }

  function startEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id);
    setSupForm({ ruc: s.ruc, businessName: s.businessName, address: s.address ?? '', phone: s.phone ?? '', email: s.email ?? '' });
    setSupOpen(true);
  }

  async function submitSupplier() {
    if (editingSupplierId) {
      if (supForm.businessName.length < 2) {
        setMsg({ kind: 'err', text: 'Razón social requerida.' });
        return;
      }
      try {
        const s = await apiPatch<Supplier>(`/suppliers/${editingSupplierId}`, { businessName: supForm.businessName, address: supForm.address, phone: supForm.phone, email: supForm.email });
        resetSupForm();
        loadSuppliers();
        setMsg({ kind: 'ok', text: `Proveedor ${s.businessName} actualizado.` });
      } catch (err) {
        setMsg({ kind: 'err', text: (err as Error).message });
      }
      return;
    }
    if (!/^(10|15|17|20)\d{9}$/.test(supForm.ruc) || supForm.businessName.length < 2) {
      setMsg({ kind: 'err', text: 'RUC (11 díg.) y razón social requeridos.' });
      return;
    }
    try {
      const s = await apiPost<Supplier>('/suppliers', { ruc: supForm.ruc, businessName: supForm.businessName, address: supForm.address, phone: supForm.phone, email: supForm.email });
      resetSupForm();
      setSuppliers((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
      setSupplierId(s.id);
      setMsg({ kind: 'ok', text: `Proveedor ${s.businessName} guardado.` });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  async function toggleSupplierActive(s: Supplier) {
    try {
      await apiPatch(`/suppliers/${s.id}`, { active: !s.active });
      loadSuppliers();
      setMsg({ kind: 'ok', text: `Proveedor ${s.active ? 'oculto' : 'activado'}.` });
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
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-glass liquid-glass row" style={{ gap: 6 }} onClick={() => setSupOpen((o) => !o)}>
              <Users size={16} /> Proveedores
            </button>
            <button className="btn-primary row" style={{ gap: 6 }} onClick={() => setOpen((o) => !o)}>
              <Plus size={16} /> Registrar compra
            </button>
          </div>
        </div>
      </FadeIn>

      {supOpen && (
        <FadeIn>
          <div className="panel liquid-glass col" style={{ gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="serif" style={{ fontSize: 18 }}>Proveedores</span>
              <label className="row muted" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Mostrar ocultos
              </label>
            </div>

            <div className="grid-3">
              <Field label="RUC">
                <input value={supForm.ruc} disabled={!!editingSupplierId} onChange={(e) => setSupForm({ ...supForm, ruc: e.target.value })} placeholder="20XXXXXXXXX" />
              </Field>
              <Field label="Razón social"><input value={supForm.businessName} onChange={(e) => setSupForm({ ...supForm, businessName: e.target.value })} /></Field>
              <Field label="Dirección"><input value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} /></Field>
              <Field label="Teléfono"><input value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} /></Field>
              <Field label="Email"><input value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} /></Field>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn-primary" onClick={submitSupplier}>
                {editingSupplierId ? 'Guardar cambios' : 'Agregar proveedor'}
              </button>
              {editingSupplierId && (
                <button type="button" className="btn-glass liquid-glass" onClick={resetSupForm}>Cancelar</button>
              )}
            </div>

            {suppliers.filter((s) => showHidden || s.active !== false).length === 0 ? (
              <EmptyState icon={<Users size={24} />} title="Sin proveedores" description="Agrega tu primer proveedor para registrar compras." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th className="num">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.filter((s) => showHidden || s.active !== false).map((s) => (
                    <tr key={s.id}>
                      <td>{s.businessName}<div className="muted" style={{ fontSize: 12 }}>{s.ruc}</div></td>
                      <td className="muted" style={{ fontSize: 12 }}>{s.phone || s.email || s.address || '—'}</td>
                      <td><span className={`badge ${s.active === false ? 'neutral' : 'ok'}`}>{s.active === false ? 'Oculto' : 'Activo'}</span></td>
                      <td className="num">
                        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn-glass row" style={{ gap: 4 }} onClick={() => startEditSupplier(s)}><Pencil size={14} /> Editar</button>
                          <button type="button" className="btn-glass row" style={{ gap: 4 }} onClick={() => toggleSupplierActive(s)}>
                            {s.active === false ? <><Eye size={14} /> Activar</> : <><EyeOff size={14} /> Ocultar</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <Toast msg={msg} />
          </div>
        </FadeIn>
      )}

      {open && (
        <FadeIn>
          <form className="panel liquid-glass col" style={{ gap: 14 }} onSubmit={submit}>
            <div className="grid-2">
              <Field label="Proveedor">
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">—</option>
                  {suppliers.filter((s) => s.active !== false).map((s) => <option key={s.id} value={s.id}>{s.businessName} ({s.ruc})</option>)}
                </select>
              </Field>
              <Field label="Almacén (recepción)">
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
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
