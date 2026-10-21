'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Globe, Menu, X } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { ArkosCredit } from '@/components/ArkosCredit';

export function LandingNav() {
  const [authed, setAuthed] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => setAuthed(!!getToken()), []);
  // Escape cierra el menú móvil.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

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
          {/* Solo en móvil (CSS): los enlaces de arriba se esconden y van al panel. */}
          <button
            type="button"
            className="lp-menu-btn"
            aria-label={menu ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menu}
            aria-controls="lp-menu"
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menu && (
        <div id="lp-menu" className="lp lp-menu" onClick={() => setMenu(false)}>
          <a href="/#features">Funciones</a>
          <a href="/#como">Cómo funciona</a>
          <Link href="/precios">Precios</Link>
          {!authed && <Link href="/login">Ingresar</Link>}
        </div>
      )}
    </nav>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp">
      <div className="lp-foot">
        <span>© {2026} FacturArkos · Facturación electrónica SUNAT + POS para Perú</span>
        <span>Hecho en Perú</span>
        <ArkosCredit />
      </div>
    </footer>
  );
}
