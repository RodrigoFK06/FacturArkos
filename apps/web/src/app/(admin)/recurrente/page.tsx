'use client';
import { useEffect, useState } from 'react';
import { Repeat, Plus, Play, Pause, Trash2, Pencil } from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, Toast, money } from '@/components/ui';

interface Customer { id: string; name: string; documentNumber: string; identityType: string }
interface Item { name: string; quantity: number; unitPrice: number }
interface Plan {
  id: string;
  name: string;
  documentType: string;
  series?: string | null;
  frequency: string;
  status: string;
  nextRunAt: string;
  customerId: string;
  customer: { name: string };
  items: { name: string; quantity: string; unitPrice: string }[];
}

const FREQ: Record<string, string> = { WEEKLY: 'Semanal', MONTHLY: 'Mensual', YEARLY: 'Anual' };
const STATUS: Record<string, string> = { ACTIVE: 'ok', PAUSED: 'warn', ENDED: 'neutral' };
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activo', PAUSED: 'Pausado', ENDED: 'Finalizado' };

export default function RecurrentePage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({ name: '', customerId: '', documentType: 'FACTURA', frequency: 'MONTHLY', series: '', startDate: '' });
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: 1, unitPrice: 0 }]);

  function load() {
    apiGet<Plan[]>('/recurring').then(setPlans).catch(() => setPlans([]));
  }
  useEffect(() => {
    load();
    apiGet<Customer[]>('/customers').then(setCustomers).catch(() => undefined);
  }, []);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function resetForm() {
    setForm({ name: '', customerId: '', documentType: 'FACTURA', frequency: 'MONTHLY', series: '', startDate: '' });
    setItems([{ name: '', quantity: 1, unitPrice: 0 }]);
  }

  function startCreate() {
    setEditingId(null);
    resetForm();
    setShow(true);
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      customerId: plan.customerId,
      documentType: plan.documentType,
      frequency: plan.frequency,
      series: plan.series ?? '',
      startDate: plan.nextRunAt ? new Date(plan.nextRunAt).toISOString().slice(0, 10) : '',
    });
    setItems(
      plan.items.length
        ? plan.items.map((it) => ({ name: it.name, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) }))
        : [{ name: '', quantity: 1, unitPrice: 0 }],
    );
    setShow(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    if (!form.name || !form.customerId) {
      setMsg({ kind: 'err', text: 'Nombre y cliente son obligatorios.' });
      return;
    }
    const validItems = items.filter((it) => it.name && it.quantity > 0);
    if (!validItems.length) {
      setMsg({ kind: 'err', text: 'Agrega al menos un ítem.' });
      return;
    }
    setBusy('submit');
    setMsg(null);
    try {
      const body = { ...form, series: form.series || undefined, startDate: form.startDate || undefined, items: validItems };
      if (editingId) {
        await apiPatch(`/recurring/${editingId}`, body);
        setMsg({ kind: 'ok', text: 'Plan actualizado.' });
      } else {
        await apiPost('/recurring', body);
        setMsg({ kind: 'ok', text: 'Plan recurrente creado.' });
      }
      setEditingId(null);
      setShow(false);
      resetForm();
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, kind: 'run' | 'pause' | 'activate') {
    setBusy(id + kind);
    setMsg(null);
    try {
      if (kind === 'run') {
        await apiPost(`/recurring/${id}/run`, {});
        setMsg({ kind: 'ok', text: 'Comprobante emitido.' });
      } else {
        await apiPost(`/recurring/${id}/status`, { status: kind === 'pause' ? 'PAUSED' : 'ACTIVE' });
      }
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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="page-label">Automatización</div>
            <h1 className="page-title serif">Facturación recurrente</h1>
            <p className="muted" style={{ maxWidth: 620 }}>Emite mensualidades y suscripciones de forma automática. Ideal para alquileres, gimnasios y servicios.</p>
          </div>
          <button className="btn-primary row" style={{ gap: 8 }} onClick={startCreate}>
            <Plus size={16} /> Nuevo plan
          </button>
        </div>
      </FadeIn>

      <Toast msg={msg} />

      {show && (
        <FadeIn>
          <div className="panel liquid-glass col" style={{ gap: 14 }}>
            <h2 className="serif" style={{ fontSize: 20, margin: 0 }}>{editingId ? 'Editar plan recurrente' : 'Nuevo plan recurrente'}</h2>
            <div className="grid-2">
              <Field label="Nombre del plan"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mensualidad gimnasio" /></Field>
              <Field label="Cliente">
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.documentNumber})</option>)}
                </select>
              </Field>
            </div>
            <div className="grid-3">
              <Field label="Documento">
                <select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
                  <option value="FACTURA">Factura</option>
                  <option value="BOLETA">Boleta</option>
                </select>
              </Field>
              <Field label="Frecuencia">
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  <option value="MONTHLY">Mensual</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="YEARLY">Anual</option>
                </select>
              </Field>
              <Field label="Primera emisión"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            </div>

            <div className="col" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>Ítems</span>
              {items.map((it, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <input style={{ flex: 2 }} placeholder="Descripción" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                  <input style={{ width: 80 }} type="number" min={0} placeholder="Cant." value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
                  <input style={{ width: 110 }} type="number" min={0} step="0.01" placeholder="P. unit." value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} />
                  {items.length > 1 && <button className="badge err" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}><Trash2 size={12} /></button>}
                </div>
              ))}
              <button className="btn-glass" style={{ alignSelf: 'flex-start' }} onClick={() => setItems((a) => [...a, { name: '', quantity: 1, unitPrice: 0 }])}>+ Ítem</button>
            </div>

            <button className="btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy === 'submit'} onClick={submit}>
              {busy === 'submit' ? (editingId ? 'Guardando…' : 'Creando…') : (editingId ? 'Guardar cambios' : 'Crear plan')}
            </button>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="panel liquid-glass">
          {plans === null ? (
            <SkeletonRows rows={4} cols={6} />
          ) : plans.length === 0 ? (
            <EmptyState
              icon={<Repeat size={24} />}
              title="Aún no tienes planes recurrentes"
              description="Crea una mensualidad o suscripción y FacturArkos emitirá el comprobante solo, en la frecuencia que definas."
              action={<button className="btn-primary" onClick={startCreate}>Nuevo plan</button>}
            />
          ) : (
            <table className="table">
              <thead>
                <tr><th>Plan</th><th>Cliente</th><th>Frecuencia</th><th>Próxima</th><th className="num">Monto</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const monto = p.items.reduce((a, it) => a + Number(it.quantity) * Number(it.unitPrice), 0);
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="muted">{p.customer.name}</td>
                      <td>{FREQ[p.frequency] ?? p.frequency}</td>
                      <td>{new Date(p.nextRunAt).toLocaleDateString('es-PE')}</td>
                      <td className="num">{money(monto)}</td>
                      <td><span className={`badge ${STATUS[p.status] ?? 'neutral'}`}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <button className="badge ok" disabled={!!busy} onClick={() => act(p.id, 'run')}><Play size={12} style={{ verticalAlign: -2 }} /> Emitir</button>
                          <button className="badge neutral" disabled={!!busy} onClick={() => startEdit(p)}><Pencil size={12} style={{ verticalAlign: -2 }} /> Editar</button>
                          {p.status === 'ACTIVE'
                            ? <button className="badge warn" disabled={!!busy} onClick={() => act(p.id, 'pause')}><Pause size={12} style={{ verticalAlign: -2 }} /> Pausar</button>
                            : <button className="badge neutral" disabled={!!busy} onClick={() => act(p.id, 'activate')}>Activar</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
