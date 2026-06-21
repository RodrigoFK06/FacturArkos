'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  HelpCircle,
  Receipt,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { AnimatedNumber, FadeIn, StatCard, StatusBadge, money } from '@/components/ui';
import { Tour, TourStep } from '@/components/Tour';

interface Dashboard {
  ventasHoy: { total: number; count: number };
  ventasMes: { total: number; count: number };
  comprobantes: Record<string, number>;
  alertasStockBajo: number;
  topProductos: { name: string; quantity: number; total: number }[];
}
interface Invoice { id: string; documentType: string; series: string; number: number; status: string; total: string; }
interface Health { aceptados: number; pendientes: number; rechazados: number; saludable: boolean; ultimaRevision: string | null; problemas: { id: string; series: string; number: number; status: string }[]; }

const DOC_LABEL: Record<string, string> = { FACTURA: 'Factura', BOLETA: 'Boleta', NOTA_CREDITO: 'N. Crédito', NOTA_DEBITO: 'N. Débito' };

const TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="sidebar"]', title: 'Tu menú', body: 'Accede a comprobantes, productos, inventario, compras, reportes y tu tienda online.' },
  { selector: '[data-tour="kpis"]', title: 'Tus números en vivo', body: 'Ventas del día y del mes, comprobantes emitidos y alertas de stock.' },
  { selector: '[data-tour="quick"]', title: 'Accesos rápidos', body: 'Haz una venta, crea un producto o registra una compra con un clic.' },
  { selector: '[data-tour="store"]', title: 'Tu tienda online', body: 'Comparte el enlace con tus clientes para recibir pedidos por internet.' },
];

export default function DashboardPage() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [sunatOk, setSunatOk] = useState(false);
  const [prodCount, setProdCount] = useState(0);
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [runTour, setRunTour] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    apiGet<Dashboard>('/reports/dashboard').then(setD).catch(() => undefined);
    apiGet<{ configured: boolean }>('/sunat-config').then((c) => setSunatOk(!!c.configured)).catch(() => undefined);
    apiGet<unknown[]>('/products').then((p) => setProdCount(Array.isArray(p) ? p.length : 0)).catch(() => undefined);
    apiGet<Invoice[]>('/invoices').then((r) => setRecent(r.slice(0, 6))).catch(() => undefined);
    apiGet<Health>('/monitor/health').then(setHealth).catch(() => undefined);
  }, []);

  async function reconcile() {
    setChecking(true);
    try {
      await apiPost('/monitor/reconcile', {});
      setHealth(await apiGet<Health>('/monitor/health'));
    } catch {
      /* ignore */
    } finally {
      setChecking(false);
    }
  }

  const user = getUser();
  const name = user?.name?.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const todayRaw = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  // Capitaliza solo la primera letra (en español los días y meses van en minúscula).
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
  const storeUrl = user?.organizationId ? `/tienda/${user.organizationId}` : '#';

  const steps = [
    { label: 'Conecta tu cuenta SUNAT', desc: 'Carga tus credenciales para emitir', done: sunatOk, href: '/settings' },
    { label: 'Crea tu primer producto', desc: 'Arma tu catálogo de venta', done: prodCount > 0, href: '/products' },
    { label: 'Registra tu primera venta', desc: 'Usa el punto de venta', done: (d?.ventasMes.count ?? 0) > 0, href: '/pos' },
    { label: 'Emite un comprobante', desc: 'Boleta o factura aceptada por SUNAT', done: (d?.comprobantes?.ACCEPTED ?? 0) > 0, href: '/invoices' },
  ];
  const pending = steps.filter((s) => !s.done).length;

  const quickActions = [
    { label: 'Nueva venta', href: '/pos', icon: ShoppingCart },
    { label: 'Nuevo producto', href: '/products', icon: ShoppingBag },
    { label: 'Registrar compra', href: '/purchases', icon: Store },
    { label: 'Ver comprobantes', href: '/invoices', icon: Receipt },
  ];

  return (
    <div className="col" style={{ gap: 24 }}>
      <Tour steps={TOUR_STEPS} storageKey="tour_dashboard_v1" run={runTour} />

      <FadeIn>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="page-label">Panel</div>
            <h1 className="page-title">{greeting}, <span className="italic">{name}</span></h1>
            <p className="muted" style={{ marginTop: 6 }}>{today}</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/bienvenida" className="btn-glass row" style={{ gap: 7, textDecoration: 'none' }}>
              <Sparkles size={16} /> Configuración guiada
            </Link>
            <button className="btn-glass row" style={{ gap: 7 }} onClick={() => setRunTour((x) => x + 1)}>
              <HelpCircle size={16} /> Ver tutorial
            </button>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="kpi-grid" data-tour="kpis">
          <StatCard label="Ventas hoy" value={<AnimatedNumber value={d?.ventasHoy.total ?? 0} format={money} />} sub={`${d?.ventasHoy.count ?? 0} ventas`} icon={<TrendingUp size={18} />} />
          <StatCard label="Ventas del mes" value={<AnimatedNumber value={d?.ventasMes.total ?? 0} format={money} />} sub={`${d?.ventasMes.count ?? 0} ventas`} icon={<Wallet size={18} />} />
          <StatCard label="Comprobantes" value={<AnimatedNumber value={d?.comprobantes?.ACCEPTED ?? 0} />} sub={`${d?.comprobantes?.PENDING ?? 0} pendientes · ${d?.comprobantes?.REJECTED ?? 0} rechazados`} icon={<Receipt size={18} />} />
          <StatCard label="Alertas de stock" value={<AnimatedNumber value={d?.alertasStockBajo ?? 0} />} sub="productos bajo el mínimo" icon={<AlertTriangle size={18} />} />
        </div>
      </FadeIn>

      <div className="dash-grid">
        <div className="col" style={{ gap: 16 }}>
          {pending > 0 && (
            <FadeIn delay={0.1}>
              <div className="panel">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
                  <h2 className="serif" style={{ fontSize: 19, margin: 0 }}>Primeros pasos</h2>
                  <span className="muted" style={{ fontSize: 13 }}>{steps.length - pending}/{steps.length} completado</span>
                </div>
                <div className="steps">
                  {steps.map((s, i) => (
                    <Link key={i} href={s.href} className={`step ${s.done ? 'done' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <span className="step-num">{s.done ? <Check size={15} /> : i + 1}</span>
                      <span style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
                        <div className="muted" style={{ fontSize: 13 }}>{s.desc}</div>
                      </span>
                      {!s.done && <ArrowRight size={16} className="muted" />}
                    </Link>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          <FadeIn delay={0.15}>
            <div className="panel">
              <h2 className="serif" style={{ fontSize: 19, margin: '0 0 14px' }}>Productos más vendidos del mes</h2>
              <table className="table">
                <thead><tr><th>Producto</th><th className="num">Cantidad</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {(d?.topProductos ?? []).map((p, i) => (
                    <tr key={i}><td>{p.name}</td><td className="num">{p.quantity}</td><td className="num">{money(p.total)}</td></tr>
                  ))}
                  {d && d.topProductos.length === 0 && <tr><td colSpan={3} className="muted">Aún no hay ventas este mes</td></tr>}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <FadeIn delay={0.1}>
            <div className="panel" data-tour="salud">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 className="serif row" style={{ fontSize: 17, margin: 0, gap: 7 }}><ShieldCheck size={17} /> Salud SUNAT</h2>
                <span className={`badge ${health?.saludable ? 'ok' : health?.rechazados ? 'err' : 'warn'}`}>
                  {health ? (health.saludable ? 'Todo en orden' : 'Requiere atención') : '—'}
                </span>
              </div>
              <div className="row" style={{ gap: 18, marginBottom: 12 }}>
                <div><div className="kpi-label">Aceptados</div><div style={{ fontSize: 22, fontWeight: 600 }}>{health?.aceptados ?? 0}</div></div>
                <div><div className="kpi-label">Pendientes</div><div style={{ fontSize: 22, fontWeight: 600 }}>{health?.pendientes ?? 0}</div></div>
                <div><div className="kpi-label">Rechazados</div><div style={{ fontSize: 22, fontWeight: 600, color: health?.rechazados ? 'var(--err)' : 'inherit' }}>{health?.rechazados ?? 0}</div></div>
              </div>
              <button className="btn-glass row" style={{ gap: 7, justifyContent: 'center', width: '100%' }} onClick={reconcile} disabled={checking}>
                <RefreshCw size={15} /> {checking ? 'Revisando…' : 'Revisar ahora'}
              </button>
              <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Revisión automática diaria ante SUNAT.</p>
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            <div className="panel" data-tour="quick">
              <h2 className="serif" style={{ fontSize: 17, margin: '0 0 10px' }}>Accesos rápidos</h2>
              <div className="col" style={{ gap: 2 }}>
                {quickActions.map((a) => (
                  <Link key={a.href} href={a.href} className="quick"><span className="ico"><a.icon size={18} /></span>{a.label}</Link>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.18}>
            <div className="panel" data-tour="store">
              <h2 className="serif" style={{ fontSize: 17, margin: '0 0 6px' }}>Tu tienda online</h2>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>Comparte el enlace con tus clientes para que compren.</p>
              <a href={storeUrl} target="_blank" rel="noreferrer" className="btn-primary row" style={{ justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
                <ExternalLink size={16} /> Abrir tienda
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={0.22}>
            <div className="panel">
              <h2 className="serif" style={{ fontSize: 17, margin: '0 0 12px' }}>Comprobantes recientes</h2>
              <div className="col" style={{ gap: 10 }}>
                {recent.map((i) => (
                  <div key={i.id} className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{DOC_LABEL[i.documentType] ?? i.documentType} <span className="muted">{i.series}-{i.number}</span></span>
                    <span className="row" style={{ gap: 8 }}><span style={{ fontSize: 13 }}>{money(i.total)}</span><StatusBadge status={i.status} /></span>
                  </div>
                ))}
                {recent.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Sin comprobantes aún.</span>}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
