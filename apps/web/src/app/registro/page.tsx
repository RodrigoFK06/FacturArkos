'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { saveSession, SessionUser } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ razonSocial: '', ruc: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await apiPost<{ access_token: string; user: SessionUser }>('/auth/register', form);
      saveSession(r.access_token, r.user);
      router.replace('/bienvenida');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <form className="card col" style={{ width: 400, gap: 12 }} onSubmit={submit}>
        <Link href="/" className="brand serif" style={{ padding: 0, fontSize: 20, color: 'var(--text)' }}>
          <Globe size={20} /> FacturArkos
        </Link>
        <h1 style={{ margin: '4px 0 0', fontSize: 24 }} className="serif">Crea tu cuenta gratis</h1>
        <p className="muted" style={{ marginTop: 0 }}>Empieza a facturar con SUNAT en minutos.</p>

        <label className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>Razón social del negocio</span>
          <input value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} required placeholder="Mi Negocio S.A.C." />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>RUC</span>
          <input value={form.ruc} onChange={(e) => set('ruc', e.target.value)} required placeholder="20123456789" inputMode="numeric" />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>Tu nombre</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Nombre y apellido" />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>Correo</span>
          <input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" required placeholder="tucorreo@negocio.pe" />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>Contraseña</span>
          <input value={form.password} onChange={(e) => set('password', e.target.value)} type="password" required minLength={8} placeholder="Mínimo 8 caracteres" />
        </label>

        {error && <div className="badge err" style={{ padding: 8 }}>{error}</div>}
        <button className="btn-primary" disabled={loading} type="submit">
          {loading ? 'Creando cuenta…' : 'Crear cuenta gratis'}
        </button>
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', margin: 0 }}>
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </form>
    </main>
  );
}
