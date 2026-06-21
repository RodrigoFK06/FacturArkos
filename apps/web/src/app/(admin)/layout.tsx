'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Globe, Menu } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { DialogProvider } from '@/components/Dialog';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  // Cierra el menú móvil al cambiar de ruta.
  useEffect(() => setNavOpen(false), [pathname]);

  if (!ready) {
    return <main style={{ padding: 32 }} className="muted">Cargando…</main>;
  }

  return (
    <DialogProvider>
      <div className="app-shell">
        <div className={`scrim ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="topbar">
            <button className="hamburger" aria-label="Menú" onClick={() => setNavOpen(true)}><Menu size={22} /></button>
            <div className="brand serif"><Globe size={18} /> FacturArkos</div>
            <button className="hamburger" aria-label="Buscar" style={{ marginLeft: 'auto' }} onClick={() => window.dispatchEvent(new Event('open-command'))}>
              {/* búsqueda en móvil */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </button>
          </div>
          <main className="main">{children}</main>
        </div>
        <CommandPalette />
      </div>
    </DialogProvider>
  );
}
