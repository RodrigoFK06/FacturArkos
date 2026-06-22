'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Plus, Boxes, Tag } from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
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
  active: boolean;
  category?: { name: string } | null;
  categoryId?: string | null;
}
interface Category {
  id: string;
  name: string;
  active: boolean;
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
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [catNames, setCatNames] = useState<Record<string, string>>({});
  const [catMsg, setCatMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  function loadProducts() {
    apiGet<Product[]>('/products?all=1').then(setProducts).catch(() => setProducts([]));
  }
  function loadCategories() {
    apiGet<Category[]>('/categories').then(setCategories).catch(() => undefined);
    apiGet<Category[]>('/categories?all=1')
      .then((list) => {
        setAllCategories(list);
        setCatNames(Object.fromEntries(list.map((c) => [c.id, c.name])));
      })
      .catch(() => undefined);
  }
  function load() {
    loadProducts();
    loadCategories();
  }
  useEffect(load, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setMsg(null);
    setCatOpen(false);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      barcode: p.barcode ?? '',
      code: p.code ?? '',
      price: String(p.price ?? ''),
      cost: String(p.cost ?? ''),
      unitCode: p.unitCode,
      igvAffectation: p.igvAffectation,
      minStock: String(p.minStock ?? '0'),
      categoryId: p.categoryId ?? '',
    });
    setMsg(null);
    setCatOpen(false);
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const body = {
      name: form.name,
      barcode: form.barcode || undefined,
      code: form.code || undefined,
      price: Number(form.price || 0),
      cost: Number(form.cost || 0),
      unitCode: form.unitCode,
      igvAffectation: form.igvAffectation,
      minStock: Number(form.minStock || 0),
      categoryId: form.categoryId || undefined,
    };
    try {
      if (editingId) {
        await apiPatch(`/products/${editingId}`, body);
        setMsg({ kind: 'ok', text: `Producto "${form.name}" actualizado.` });
      } else {
        await apiPost('/products', body);
        setMsg({ kind: 'ok', text: `Producto "${form.name}" creado.` });
      }
      setForm({ ...emptyForm });
      setEditingId(null);
      setOpen(false);
      loadProducts();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleProduct(p: Product) {
    try {
      await apiPatch(`/products/${p.id}`, { active: !p.active });
      loadProducts();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  async function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    setCatMsg(null);
    try {
      await apiPost('/categories', { name });
      setNewCat('');
      setCatMsg({ kind: 'ok', text: `Categoría "${name}" creada.` });
      loadCategories();
    } catch (err) {
      setCatMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  async function renameCategory(c: Category) {
    const name = (catNames[c.id] ?? '').trim();
    if (!name || name === c.name) return;
    setCatMsg(null);
    try {
      await apiPatch(`/categories/${c.id}`, { name });
      setCatMsg({ kind: 'ok', text: 'Categoría actualizada.' });
      loadCategories();
    } catch (err) {
      setCatMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  async function toggleCategory(c: Category) {
    setCatMsg(null);
    try {
      await apiPatch(`/categories/${c.id}`, { active: !c.active });
      loadCategories();
    } catch (err) {
      setCatMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  const visible = (products ?? []).filter((p) => showHidden || p.active !== false);

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="page-label">Catálogo</div>
            <h1 className="page-title serif">Productos</h1>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-glass row" style={{ gap: 6 }} onClick={() => { setCatOpen((o) => !o); setOpen(false); }}>
              <Tag size={16} /> Categorías
            </button>
            <button className="btn-primary row" style={{ gap: 6 }} onClick={openCreate}>
              <Plus size={16} /> Nuevo producto
            </button>
          </div>
        </div>
      </FadeIn>

      {catOpen && (
        <FadeIn>
          <div className="panel liquid-glass col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
              <Field label="Nueva categoría">
                <input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                />
              </Field>
              <button className="btn-primary" type="button" onClick={addCategory}>Agregar</button>
            </div>
            <Toast msg={catMsg} />
            {allCategories.length === 0 ? (
              <div className="muted">Aún no tienes categorías.</div>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                {allCategories.map((c) => (
                  <div key={c.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <input
                      style={{ flex: 1 }}
                      value={catNames[c.id] ?? ''}
                      onChange={(e) => setCatNames({ ...catNames, [c.id]: e.target.value })}
                      onBlur={() => renameCategory(c)}
                    />
                    <button className="btn-glass" type="button" onClick={() => renameCategory(c)}>Guardar</button>
                    <span className={`badge ${c.active ? 'ok' : 'neutral'}`}>{c.active ? 'Activo' : 'Oculto'}</span>
                    <button className="btn-glass" type="button" onClick={() => toggleCategory(c)}>
                      {c.active ? 'Ocultar' : 'Activar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeIn>
      )}

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
              {busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </form>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="panel liquid-glass col" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <label className="row muted" style={{ gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
              Mostrar ocultos
            </label>
          </div>
          {products === null ? (
            <SkeletonRows rows={5} cols={6} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Boxes size={24} />}
              title="Aún no tienes productos"
              description="Crea tu primer producto para venderlo en el punto de venta y en tu tienda online."
              action={<button className="btn-primary" onClick={openCreate}>Nuevo producto</button>}
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
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}{p.barcode ? <span className="muted"> · {p.barcode}</span> : null}</td>
                    <td className="muted">{p.category?.name ?? '—'}</td>
                    <td><span className="badge neutral">{t(IGV_AFFECTATION, p.igvAffectation)}</span></td>
                    <td className="num">{money(p.price)}</td>
                    <td className="num muted">{money(p.cost)}</td>
                    <td>
                      {p.active ? <span className="badge ok">Activo</span> : <span className="badge neutral">Oculto</span>}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn-glass" type="button" onClick={() => openEdit(p)}>Editar</button>
                        <button className="btn-glass" type="button" onClick={() => toggleProduct(p)}>
                          {p.active ? 'Ocultar' : 'Activar'}
                        </button>
                      </div>
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
