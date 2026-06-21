'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, LogOut, Store as StoreIcon, ShoppingBag, FileText } from 'lucide-react';
import { getUser, logout } from '@/lib/auth';
import { navForRole, type NavItem } from '@/lib/nav';

interface Cmd {
  id: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number }>;
  keywords?: string;
  run: () => void;
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const cmds = useMemo<Cmd[]>(() => {
    const user = getUser();
    const orgId = user?.organizationId;
    const groups = navForRole(user?.role);
    const items: Cmd[] = [];
    for (const g of groups) {
      for (const it of g.items as NavItem[]) {
        const href = it.dynamic === 'store' ? `/tienda/${orgId}` : it.dynamic === 'portal' ? `/portal/${orgId}` : it.href;
        const external = !!it.dynamic;
        items.push({
          id: it.href,
          label: it.label,
          group: g.title ?? 'Ir a',
          icon: it.icon,
          keywords: it.keywords,
          run: () => (external ? window.open(href, '_blank') : router.push(href)),
        });
      }
    }
    // Acciones rápidas
    items.push({ id: 'act-pos', label: 'Nueva venta (POS)', group: 'Acciones', icon: StoreIcon, keywords: 'vender cobrar', run: () => router.push('/pos') });
    items.push({ id: 'act-store', label: 'Abrir tienda online', group: 'Acciones', icon: ShoppingBag, keywords: 'tienda', run: () => orgId && window.open(`/tienda/${orgId}`, '_blank') });
    items.push({ id: 'act-portal', label: 'Abrir portal del cliente', group: 'Acciones', icon: FileText, keywords: 'portal comprobantes', run: () => orgId && window.open(`/portal/${orgId}`, '_blank') });
    items.push({ id: 'act-logout', label: 'Cerrar sesión', group: 'Acciones', icon: LogOut, keywords: 'salir logout', run: () => { logout(); router.replace('/login'); } });
    return items;
  }, [router]);

  const results = useMemo(() => {
    const term = norm(q.trim());
    if (!term) return cmds;
    return cmds.filter((c) => norm(c.label + ' ' + (c.keywords ?? '') + ' ' + c.group).includes(term));
  }, [q, cmds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);
  useEffect(() => setIdx(0), [q]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return setOpen(false);
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const c = results[idx];
      if (c) { setOpen(false); c.run(); }
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector('.cmdk-item.active');
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;

  // Agrupar resultados conservando orden, asignando índice plano para navegación.
  let flat = -1;
  const grouped: { title: string; items: { c: Cmd; i: number }[] }[] = [];
  for (const c of results) {
    flat++;
    const last = grouped[grouped.length - 1];
    if (last && last.title === c.group) last.items.push({ c, i: flat });
    else grouped.push({ title: c.group, items: [{ c, i: flat }] });
  }

  return (
    <div className="cmdk-scrim" onMouseDown={() => setOpen(false)}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="row" style={{ gap: 0 }}>
          <Search size={18} style={{ color: 'var(--faint)', margin: '0 0 0 16px' }} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Buscar pantallas y acciones…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="cmdk-list" ref={listRef}>
          {results.length === 0 && <div className="cmdk-empty">Sin resultados para “{q}”.</div>}
          {grouped.map((g) => (
            <div key={g.title}>
              <div className="cmdk-group">{g.title}</div>
              {g.items.map(({ c, i }) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.id}
                    className={`cmdk-item ${i === idx ? 'active' : ''}`}
                    onMouseEnter={() => setIdx(i)}
                    onMouseDown={(e) => { e.preventDefault(); setOpen(false); c.run(); }}
                  >
                    <span className="ico"><Icon size={17} /></span>
                    {c.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
