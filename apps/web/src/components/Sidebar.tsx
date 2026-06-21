'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Globe, LogOut, Search, ExternalLink } from 'lucide-react';
import { getUser, logout } from '@/lib/auth';
import { navForRole, ROLE_LABEL } from '@/lib/nav';

export function Sidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();
  const groups = navForRole(user?.role);

  function hrefFor(href: string, dynamic?: 'store' | 'portal') {
    if (dynamic === 'store') return `/tienda/${user?.organizationId}`;
    if (dynamic === 'portal') return `/portal/${user?.organizationId}`;
    return href;
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} data-tour="sidebar">
      <Link href="/dashboard" className="brand serif" onClick={onNavigate}>
        <Globe size={22} /> FacturArkos
      </Link>

      <button className="nav-search" onClick={() => window.dispatchEvent(new Event('open-command'))}>
        <Search size={15} /> Buscar… <kbd>⌘K</kbd>
      </button>

      <nav className="nav-scroll">
        {groups.map((g) => (
          <div key={g.title ?? 'top'}>
            {g.title && <div className="nav-section">{g.title}</div>}
            {g.items.map(({ href, label, icon: Icon, dynamic }) => {
              const target = hrefFor(href, dynamic);
              if (dynamic) {
                return (
                  <a key={href} href={target} target="_blank" rel="noreferrer" className="nav-item" onClick={onNavigate}>
                    <Icon size={18} /> {label} <ExternalLink size={13} className="nav-ext" />
                  </a>
                );
              }
              return (
                <Link key={href} href={target} className={`nav-item ${pathname === href ? 'active' : ''}`} onClick={onNavigate}>
                  <Icon size={18} /> {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot col" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', padding: '0 8px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
          </div>
          {user?.role && <span className="role-chip">{ROLE_LABEL[user.role] ?? user.role}</span>}
        </div>
        <button className="nav-item" onClick={() => { logout(); router.replace('/login'); }}>
          <LogOut size={18} /> Salir
        </button>
      </div>
    </aside>
  );
}
