'use client';
import { useEffect, useState } from 'react';
import { Tags, Plus, Star, Save } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiPut } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, Toast, money } from '@/components/ui';

interface PriceList {
  id: string;
  name: string;
  isDefault: boolean;
}
interface PriceRow {
  productId: string;
  name: string;
  code: string | null;
  basePrice: string | number;
  listPrice: string | number | null;
}

export default function PriceListsPage() {
  const [lists, setLists] = useState<PriceList[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDefault, setNewDefault] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prices, setPrices] = useState<PriceRow[] | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  function loadLists() {
    apiGet<PriceList[]>('/price-lists').then(setLists).catch(() => setLists([]));
  }
  useEffect(loadLists, []);

  function loadPrices(id: string) {
    setPrices(null);
    setEdited({});
    apiGet<PriceRow[]>(`/price-lists/${id}/prices`).then(setPrices).catch(() => setPrices([]));
  }

  function selectList(id: string) {
    setSelectedId(id);
    loadPrices(id);
  }

  async function createList() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMsg(null);
    try {
      const created = await apiPost<PriceList>('/price-lists', { name, isDefault: newDefault || undefined });
      setNewName('');
      setNewDefault(false);
      setCreateOpen(false);
      setMsg({ kind: 'ok', text: `Lista "${name}" creada.` });
      loadLists();
      selectList(created.id);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(l: PriceList) {
    setEditingId(l.id);
    setEditName(l.name);
  }

  async function saveName(l: PriceList) {
    const name = editName.trim();
    if (!name || name === l.name) {
      setEditingId(null);
      return;
    }
    setMsg(null);
    try {
      await apiPatch(`/price-lists/${l.id}`, { name });
      setEditingId(null);
      setMsg({ kind: 'ok', text: 'Lista actualizada.' });
      loadLists();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  async function makeDefault(l: PriceList) {
    setMsg(null);
    try {
      await apiPatch(`/price-lists/${l.id}`, { isDefault: true });
      setMsg({ kind: 'ok', text: `"${l.name}" es ahora la lista predeterminada.` });
      loadLists();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  async function savePrices() {
    if (!selectedId || !prices) return;
    setBusy(true);
    setMsg(null);
    const payload = prices
      .map((r) => {
        const raw = edited[r.productId];
        const value = raw !== undefined ? raw : r.listPrice != null ? String(r.listPrice) : '';
        return { productId: r.productId, price: Number(value) || 0 };
      })
      .filter((p) => p.price > 0 || edited[p.productId] !== undefined);
    try {
      await apiPut(`/price-lists/${selectedId}/prices`, { prices: payload });
      setMsg({ kind: 'ok', text: 'Precios guardados.' });
      loadPrices(selectedId);
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const selected = (lists ?? []).find((l) => l.id === selectedId) ?? null;

  return (
    <div className="col" style={{ gap: 28 }}>
      <FadeIn>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="page-label">Catálogo</div>
            <h1 className="page-title serif">Listas de precios</h1>
          </div>
          <button className="btn-primary row" style={{ gap: 6 }} onClick={() => { setCreateOpen((o) => !o); setMsg(null); }}>
            <Plus size={16} /> Nueva lista
          </button>
        </div>
      </FadeIn>

      {createOpen && (
        <FadeIn>
          <div className="panel liquid-glass col" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
              <Field label="Nombre *">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createList(); } }}
                  placeholder="Menudeo, Mayorista…"
                />
              </Field>
              <label className="row muted" style={{ gap: 6, cursor: 'pointer', paddingBottom: 8 }}>
                <input type="checkbox" checked={newDefault} onChange={(e) => setNewDefault(e.target.checked)} />
                Predeterminada
              </label>
              <button className="btn-primary" type="button" onClick={createList} disabled={busy} style={{ marginBottom: 1 }}>
                {busy ? 'Creando…' : 'Crear lista'}
              </button>
            </div>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="panel liquid-glass col" style={{ gap: 14 }}>
          {lists === null ? (
            <SkeletonRows rows={3} cols={3} />
          ) : lists.length === 0 ? (
            <EmptyState
              icon={<Tags size={24} />}
              title="Aún no tienes listas de precios"
              description="Crea listas como Menudeo o Mayorista para asignar precios distintos a cada producto según el tipo de cliente."
              action={<button className="btn-primary" onClick={() => { setCreateOpen(true); setMsg(null); }}>Nueva lista</button>}
            />
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {lists.map((l) => (
                <div
                  key={l.id}
                  className="row liquid-glass"
                  style={{
                    gap: 10,
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 12,
                    cursor: 'pointer',
                    outline: l.id === selectedId ? '2px solid var(--accent, #6366f1)' : 'none',
                  }}
                  onClick={() => selectList(l.id)}
                >
                  {editingId === l.id ? (
                    <input
                      style={{ flex: 1 }}
                      autoFocus
                      value={editName}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(l); } }}
                      onBlur={() => saveName(l)}
                    />
                  ) : (
                    <span style={{ flex: 1, fontWeight: 600 }}>{l.name}</span>
                  )}
                  {l.isDefault && (
                    <span className="badge ok row" style={{ gap: 4 }}>
                      <Star size={12} /> Predeterminada
                    </span>
                  )}
                  <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    {editingId === l.id ? (
                      <button className="btn-glass" type="button" onClick={() => saveName(l)}>Guardar</button>
                    ) : (
                      <button className="btn-glass" type="button" onClick={() => startEdit(l)}>Editar</button>
                    )}
                    {!l.isDefault && (
                      <button className="btn-glass" type="button" onClick={() => makeDefault(l)}>Hacer predeterminada</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Toast msg={msg} />
        </div>
      </FadeIn>

      {selected && (
        <FadeIn delay={0.15}>
          <div className="panel liquid-glass col" style={{ gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div className="col" style={{ gap: 4 }}>
                <div className="page-label">Precios · {selected.name}</div>
                <span className="muted" style={{ fontSize: 12 }}>Deja vacío o 0 para usar el precio base.</span>
              </div>
              <button className="btn-primary row" style={{ gap: 6 }} onClick={savePrices} disabled={busy || prices === null}>
                <Save size={16} /> {busy ? 'Guardando…' : 'Guardar precios'}
              </button>
            </div>

            {prices === null ? (
              <SkeletonRows rows={5} cols={3} />
            ) : prices.length === 0 ? (
              <EmptyState
                icon={<Tags size={24} />}
                title="No hay productos"
                description="Crea productos en el catálogo para asignarles precios en esta lista."
              />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Precio base</th>
                    <th className="num">Precio en esta lista</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((r) => {
                    const value = edited[r.productId] !== undefined
                      ? edited[r.productId]
                      : r.listPrice != null ? String(Number(r.listPrice)) : '';
                    return (
                      <tr key={r.productId}>
                        <td>{r.name}{r.code ? <span className="muted"> · {r.code}</span> : null}</td>
                        <td className="num muted">{money(r.basePrice)}</td>
                        <td className="num">
                          <input
                            type="number"
                            step="0.01"
                            value={value}
                            placeholder={String(Number(r.basePrice))}
                            onChange={(e) => setEdited({ ...edited, [r.productId]: e.target.value })}
                            style={{ textAlign: 'right', maxWidth: 140 }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
