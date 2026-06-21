'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Plus, Boxes } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, Toast, money } from '@/components/ui';
import { IGV_AFFECTATION, t } from '@/lib/labels';

interface Product {
  id: string;
  name: string;
  code?: string | null;
  barcode?: string | null;
  price: string | number;
  cost: string | number;
  unitCode: string;
  igvAffectation: string;
  minStock: string | number;
  category?: { name: string } | null;
}
interface Category {
  id: string;
  name: string;
}

const AFFECTATIONS = ['GRAVADO', 'EXONERADO', 'INAFECTO', 'EXPORTACION', 'GRATUITO'];
const emptyForm = {
  name: '',
  barcode: '',
  code: '',
  price: '',
  cost: '',
  unitCode: 'NIU',
  igvAffectation: 'GRAVADO',
  minStock: '0',
  categoryId: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiGet<Product[]>('/products').then(setProducts).catch(() => setProducts([]));
    apiGet<Category[]>('/categories').then(setCategories).catch(() => undefined);
  }
  useEffect(load, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await apiPost('/products', {
        name: form.name,
        barcode: form.barcode || undefined,
        code: form.code || undefined,
        price: Number(form.price || 0),
        cost: Number(form.cost || 0),
        unitCode: form.unitCode,
        igvAffectation: form.igvAffectation,
        minStock: Number(form.minStock || 0),
        categoryId: form.categoryId || undefined,
      });
      setMsg({ kind: 'ok', text: `Producto "${form.name}" creado.` });
      setForm({ ...emptyForm });
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
            <div className="page-label">Catálogo</div>
            <h1 className="page-title serif">Productos</h1>
          </div>
          <button className="btn-primary row" style={{ gap: 6 }} onClick={() => setOpen((o) => !o)}>
            <Plus size={16} /> Nuevo producto
          </button>
        </div>
      </FadeIn>

      {open && (
        <FadeIn>
          <form className="panel liquid-glass col" style={{ gap: 14 }} onSubmit={submit}>
            <div className="grid-2">
              <Field label="Nombre *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Código de barras"><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
            </div>
            <div className="grid-3">
              <Field label="Precio (con IGV) *"><input type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
              <Field label="Costo"><input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
              <Field label="Stock mínimo"><input type="number" step="0.001" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></Field>
            </div>
            <div className="grid-3">
              <Field label="Afectación IGV">
                <select value={form.igvAffectation} onChange={(e) => setForm({ ...form, igvAffectation: e.target.value })}>
                  {AFFECTATIONS.map((a) => <option key={a} value={a}>{IGV_AFFECTATION[a] ?? a}</option>)}
                </select>
              </Field>
              <Field label="Unidad (SUNAT)"><input value={form.unitCode} onChange={(e) => setForm({ ...form, unitCode: e.target.value })} /></Field>
              <Field label="Categoría">
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Toast msg={msg} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>
              {busy ? 'Guardando…' : 'Crear producto'}
            </button>
          </form>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="panel liquid-glass">
          {products === null ? (
            <SkeletonRows rows={5} cols={5} />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Boxes size={24} />}
              title="Aún no tienes productos"
              description="Crea tu primer producto para venderlo en el punto de venta y en tu tienda online."
              action={<button className="btn-primary" onClick={() => setOpen(true)}>Nuevo producto</button>}
            />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>IGV</th>
                  <th className="num">Precio</th>
                  <th className="num">Costo</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}{p.barcode ? <span className="muted"> · {p.barcode}</span> : null}</td>
                    <td className="muted">{p.category?.name ?? '—'}</td>
                    <td><span className="badge neutral">{t(IGV_AFFECTATION, p.igvAffectation)}</span></td>
                    <td className="num">{money(p.price)}</td>
                    <td className="num muted">{money(p.cost)}</td>
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
