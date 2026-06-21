'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Plus, Users, ShieldCheck } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState, FadeIn, Field, SkeletonRows, Toast } from '@/components/ui';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero',
  ACCOUNTANT: 'Contador',
};
const ROLE_HELP: Record<string, string> = {
  ADMIN: 'Acceso casi total; gestiona configuración y usuarios.',
  MANAGER: 'Opera ventas, inventario, compras y reportes.',
  CASHIER: 'Punto de venta, comprobantes y caja.',
  ACCOUNTANT: 'Comprobantes, compras, reportes y SIRE.',
};
// El OWNER no se crea desde aquí (es la cuenta dueña del registro).
const CREATABLE = ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT'];

export default function UsuariosPage() {
  const [list, setList] = useState<User[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CASHIER' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiGet<User[]>('/users').then(setList).catch(() => setList([]));
  }
  useEffect(load, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.name.length < 2 || !form.email || form.password.length < 8) {
      setMsg({ kind: 'err', text: 'Nombre, correo y contraseña (mín. 8 caracteres) son obligatorios.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiPost('/users', form);
      setMsg({ kind: 'ok', text: `Usuario ${form.name} creado.` });
      setForm({ name: '', email: '', password: '', role: 'CASHIER' });
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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="page-label">Sistema</div>
            <h1 className="page-title serif">Usuarios</h1>
            <p className="muted" style={{ maxWidth: 620 }}>Da acceso a tu equipo con el rol adecuado. Cada rol ve solo lo que necesita.</p>
          </div>
          <button className="btn-primary row" style={{ gap: 6 }} onClick={() => setOpen((o) => !o)}>
            <Plus size={16} /> Nuevo usuario
          </button>
        </div>
      </FadeIn>

      {open && (
        <FadeIn>
          <form className="panel liquid-glass col" style={{ gap: 14 }} onSubmit={submit}>
            <h2 className="serif" style={{ fontSize: 20, margin: 0 }}>Nuevo usuario</h2>
            <div className="grid-2">
              <Field label="Nombre completo"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre y apellido" /></Field>
              <Field label="Correo"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="persona@negocio.pe" /></Field>
              <Field label="Contraseña"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" /></Field>
              <Field label="Rol">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {CREATABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </Field>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> {ROLE_HELP[form.role]}</p>
            <Toast msg={msg} />
            <button className="btn-primary" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>{busy ? 'Creando…' : 'Crear usuario'}</button>
          </form>
        </FadeIn>
      )}

      {!open && <Toast msg={msg} />}

      <FadeIn delay={0.1}>
        <div className="panel liquid-glass">
          {list === null ? (
            <SkeletonRows rows={4} cols={4} />
          ) : list.length === 0 ? (
            <EmptyState icon={<Users size={24} />} title="Solo estás tú por ahora" description="Crea usuarios para tu equipo (cajeros, gerentes, contador) con el rol que corresponda." />
          ) : (
            <table className="table">
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="muted">{u.email}</td>
                    <td><span className="badge neutral">{ROLE_LABEL[u.role] ?? u.role}</span></td>
                    <td>{u.active ? <span className="badge ok">Activo</span> : <span className="badge neutral">Inactivo</span>}</td>
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
