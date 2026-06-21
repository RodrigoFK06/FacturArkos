'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { saveSession, SessionUser } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@facturarkos.pe');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await apiPost<{ access_token: string; user: SessionUser }>('/auth/login', {
        email,
        password,
      });
      saveSession(r.access_token, r.user);
      // Cuenta nueva (sin SUNAT ni productos) → asistente de configuración.
      let isNew = false;
      try {
        const [cfg, prods] = await Promise.all([
          apiGet<{ configured: boolean }>('/sunat-config'),
          apiGet<unknown[]>('/products'),
        ]);
        isNew = !cfg.configured && Array.isArray(prods) && prods.length === 0;
      } catch {
        /* si falla, vamos al panel */
      }
      router.replace(isNew ? '/bienvenida' : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <form className="card col" style={{ width: 360 }} onSubmit={submit}>
        <h1 style={{ margin: '0 0 4px' }}>FacturArkos</h1>
        <p className="muted" style={{ marginTop: 0 }}>Inicia sesión para vender</p>
        <label className="col">
          <span className="muted">Correo</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="col">
          <span className="muted">Contraseña</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {error && <div className="badge err" style={{ padding: 8 }}>{error}</div>}
        <button className="primary" disabled={loading} type="submit">
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', margin: 0 }}>
          ¿No tienes cuenta? <a href="/registro">Crea una gratis</a>
        </p>
      </form>
    </main>
  );
}
