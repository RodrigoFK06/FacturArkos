'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  HelpCircle,
  Receipt,
  RefreshCw,
  Rocket,
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
import { AnimatedNumber, FadeIn, SkeletonRows, StatCard, StatusBadge, money } from '@/components/ui';
import { Tour, TourStep } from '@/components/Tour';

interface Dashboard {
  ventasHoy: { total: number; count: number };
  ventasMes: { total: number; count: number };
  comprobantes: Record<string, number>;
  alertasStockBajo: number;
  topProductos: { name: string; quantity: number; total: number }[];
}
interface Invoice { id: string; documentType: string; series: string; number: number; status: string; total: string; }
interface OrgInfo { direccion?: string | null; ubigeo?: string | null }
interface SunatStatus { configured?: boolean }
interface OnboardingState { org: boolean; sunat: boolean; products: boolean; customers: boolean; orders: boolean; team: boolean }
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
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [runTour, setRunTour] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

  useEffect(() => {
    apiGet<Dashboard>('/reports/dashboard').then(setD).catch(() => undefined);
    apiGet<Invoice[]>('/invoices').then((r) => setRecent(r.slice(0, 6))).catch(() => undefined);
    apiGet<Health>('/monitor/health').then(setHealth).catch(() => undefined);
  }, []);

  // Puesta en marcha: deriva cada paso de datos reales. Toda llamada que falle
  // (incluido 403 para roles sin permiso en /users o /sunat-config) cuenta como
  // "no completado" y nunca rompe el dashboard.
  useEffect(() => {
    const ok = <T,>(p: PromiseSettledResult<T>): T | null => (p.status === 'fulfilled' ? p.value : null);
    Promise.allSettled([
      apiGet<OrgInfo>('/organization'),
      apiGet<SunatStatus>('/sunat-config'),
      apiGet<unknown[]>('/products'),
      apiGet<unknown[]>('/customers'),
      apiGet<unknown[]>('/orders'),
      apiGet<unknown[]>('/users'),
    ]).then(([org, sunat, products, customers, orders, users]) => {
      const orgV = ok(org);
      const sunatV = ok(sunat);
      const productsV = ok(products);
      const customersV = ok(customers);
      const ordersV = ok(orders);
      const usersV = ok(users);
      setOnboarding({
        org: !!(orgV?.direccion && orgV?.direccion.trim() && orgV?.ubigeo && orgV?.ubigeo.trim()),
        sunat: !!sunatV?.configured,
        products: Array.isArray(productsV) && productsV.length > 0,
        customers: Array.isArray(customersV) && customersV.length > 0,
        orders: Array.isArray(ordersV) && ordersV.length > 0,
        team: Array.isArray(usersV) && usersV.length > 1,
      });
    });
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

  const onbSteps = [
    { label: 'Configura los datos de tu negocio', desc: 'Dirección y ubigeo para tus comprobantes', done: !!onboarding?.org, href: '/settings' },
    { label: 'Conecta SUNAT para facturar', desc: 'Carga tus credenciales para emitir', done: !!onboarding?.sunat, href: '/settings' },
    { label: 'Crea tu primer producto', desc: 'Arma tu catálogo de venta', done: !!onboarding?.products, href: '/products' },
    { label: 'Registra tu primer cliente', desc: 'Tu cartera de clientes', done: !!onboarding?.customers, href: '/clientes' },
    { label: 'Realiza tu primera venta', desc: 'Usa el punto de venta', done: !!onboarding?.orders, href: '/pos' },
    { label: 'Invita a tu equipo', desc: 'Suma a tu personal con sus permisos', done: !!onboarding?.team, href: '/usuarios' },
  ];
  const onbDone = onbSteps.filter((s) => s.done).length;
  const onbAllDone = onbDone === onbSteps.length;

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

      {/* Puesta en marcha: guía de onboarding derivada de datos reales. */}
      {onboarding === null ? (
        <FadeIn delay={0.04}>
          <div className="panel">
            <SkeletonRows rows={3} cols={2} />
          </div>
        </FadeIn>
      ) : onbAllDone ? (
        <FadeIn delay={0.04}>
          <div className="panel liquid-glass row" style={{ gap: 14, alignItems: 'center' }}>
            <span className="ico" style={{ color: 'var(--ok)' }}><Rocket size={22} /></span>
            <div>
              <h2 className="serif" style={{ fontSize: 18, margin: 0 }}>¡Tu negocio está listo! 🎉</h2>
              <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>Completaste todos los pasos de la puesta en marcha.</p>
            </div>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.04}>
          <div className="panel liquid-glass">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span className="ico"><Rocket size={20} /></span>
                <div>
                  <h2 className="serif" style={{ fontSize: 19, margin: 0 }}>Pon en marcha tu negocio</h2>
                  <p className="muted" style={{ fontSize: 13, margin: '3px 0 0' }}>Completa estos pasos para empezar a facturar y vender.</p>
                </div>
              </div>
              <span className="badge neutral">{onbDone} de {onbSteps.length} completados</span>
            </div>
            <div className="col" style={{ gap: 2 }}>
              {onbSteps.map((s, i) => (
                <div key={i} className="row" style={{ gap: 12, alignItems: 'center', padding: '10px 0', opacity: s.done ? 0.7 : 1 }}>
                  <span style={{ color: s.done ? 'var(--ok)' : 'var(--muted)', display: 'flex' }}>
                    {s.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </span>
                  <span style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{s.desc}</div>
                  </span>
                  {!s.done && (
                    <Link href={s.href} className="btn-glass row" style={{ gap: 6, textDecoration: 'none', fontSize: 13, padding: '6px 12px' }}>
                      Hacer <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

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
