'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { ArkosCredit } from '@/components/ArkosCredit';

export function LandingNav() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(!!getToken()), []);

  return (
    <nav className="lp-nav">
      <div className="lp lp-nav-inner">
        <Link href="/" className="brand serif" style={{ padding: 0, fontSize: 19, color: 'var(--text)' }}>
          <Globe size={20} /> FacturArkos
        </Link>
        <div className="lp-nav-links">
          <a href="/#features">Funciones</a>
          <a href="/#como">Cómo funciona</a>
          <Link href="/precios">Precios</Link>
          {authed ? (
            <Link href="/dashboard" className="lp-cta">Ir al panel</Link>
          ) : (
            <>
              <Link href="/login">Ingresar</Link>
              <Link href="/registro" className="lp-cta">Empezar gratis</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp">
      <div className="lp-foot">
        <span>© {2026} FacturArkos · Facturación electrónica SUNAT + POS para Perú</span>
        <span>Hecho en Perú 🇵🇪</span>
        <ArkosCredit />
      </div>
    </footer>
  );
}
