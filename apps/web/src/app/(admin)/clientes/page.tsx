'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, Toast } from '@/components/ui';

interface Customer {
  id: string;
  identityType: string;
  documentNumber: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

const DOC_LABEL: Record<string, string> = { DNI: 'DNI', RUC: 'RUC', CE: 'C.E.', PASSPORT: 'Pasaporte', NONE: '—' };
const empty = { identityType: 'DNI', documentNumber: '', name: '', email: '', phone: '', address: '' };

export default function ClientesPage() {
  const [list, setList] = useState<Customer[] | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function load(query = '') {
    apiGet<Customer[]>(`/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`).then(setList).catch(() => setList([]));
  }
  useEffect(() => { load(); }, []);

  async function lookup() {
    if (!form.documentNumber) return;
    setMsg(null);
    setBusy(true);
    try {
      const type = form.identityType === 'RUC' ? 'RUC' : 'DNI';
      const c = await apiGet<Customer>(`/customers/lookup?type=${type}&number=${form.documentNumber}`);
      setForm({ ...form, name: c.name });
      setMsg({ kind: 'ok', text: `Encontrado: ${c.name}` });
      load(q);
    } catch (e) {
      setMsg({ kind: 'warn', text: `${(e as Error).message}. Completa el nombre manualmente.` });
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await apiPost('/customers', {
        identityType: form.identityType,
        documentNumber: form.documentNumber,
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      setForm({ ...empty });
      setOpen(false);
      load(q);
      setMsg({ kind: 'ok', text: 'Cliente guardado.' });
    } catch (e2) {
      setMsg({ kind: 'err', text: (e2 as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col" style={{ gap: 24 }}>
      <FadeIn>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="page-label">Clientes</div>
            <h1 className="page-title serif">Clientes</h1>
          </div>
          <button className="btn-primary row" style={{ gap: 6 }} onClick={() => setOpen((o) => !o)}><Plus size={16} /> Nuevo cliente</button>
        </div>
      </FadeIn>

      {open && (
        <FadeIn>
          <form className="panel col" style={{ gap: 14, maxWidth: 720 }} onSubmit={submit}>
            <div className="grid-3">
              <Field label="Tipo de documento">
                <select value={form.identityType} onChange={(e) => setForm({ ...form, identityType: e.target.value })}>
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">Carné de extranjería</option>
                  <option value="PASSPORT">Pasaporte</option>
                </select>
              </Field>
              <Field label="Número">
                <input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} />
              </Field>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" className="btn-glass row" style={{ gap: 6 }} onClick={lookup} disabled={busy}><Search size={15} /> Autocompletar</button>
              </div>
            </div>
            <Field label="Nombre / Razón social *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid-3">
              <Field label="Teléfono"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Correo"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Dirección"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            </div>
            <Toast msg={msg} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>{busy ? 'Guardando…' : 'Guardar cliente'}</button>
          </form>
        </FadeIn>
      )}

      <FadeIn delay={0.1}>
        <div className="panel">
          <div className="row" style={{ marginBottom: 14 }}>
            <input placeholder="Buscar por nombre o documento…" value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} style={{ maxWidth: 360 }} />
          </div>
          {list === null ? (
            <SkeletonRows rows={5} cols={3} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<Users size={24} />}
              title={q ? 'Sin resultados' : 'Aún no tienes clientes'}
              description={q ? `No encontramos clientes para “${q}”.` : 'Agrega un cliente o búscalo por DNI/RUC; se guarda automáticamente al vender.'}
            />
          ) : (
            <table className="table">
              <thead><tr><th>Documento</th><th>Nombre / Razón social</th><th>Contacto</th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><span className="badge neutral">{DOC_LABEL[c.identityType] ?? c.identityType}</span> {c.documentNumber}</td>
                    <td>{c.name}</td>
                    <td className="muted">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</td>
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
