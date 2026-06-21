import Link from 'next/link';
import {
  Receipt,
  Store,
  Boxes,
  ShieldCheck,
  MessageCircle,
  FileSpreadsheet,
  ShoppingBag,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { LandingNav, LandingFooter } from '@/components/LandingChrome';
import { PricingCards } from '@/components/Pricing';

export const metadata = {
  title: 'FacturArkos — Facturación electrónica SUNAT + POS para Perú',
  description:
    'Emite boletas y facturas electrónicas aceptadas por SUNAT, vende con tu punto de venta, controla tu inventario y abre tu tienda online. Todo en un solo sistema para tu Mype.',
};

const FEATURES = [
  { icon: Receipt, title: 'Facturación SUNAT', desc: 'Boletas, facturas, notas de crédito y débito y guías de remisión aceptadas por SUNAT, con su CDR y PDF.' },
  { icon: Store, title: 'Punto de venta (POS)', desc: 'Vende rápido desde cualquier dispositivo. Funciona aun sin internet y sincroniza al volver la conexión.' },
  { icon: Boxes, title: 'Inventario y compras', desc: 'Stock por almacén, kardex valorizado, alertas de stock bajo y costeo promedio en cada compra.' },
  { icon: ShieldCheck, title: 'Monitoreo diario SUNAT', desc: 'Revisamos cada día el estado de tus comprobantes y te avisamos si algo necesita tu atención.' },
  { icon: ShoppingBag, title: 'Tienda online', desc: 'Tu catálogo en una página lista para vender, con pedidos que llegan directo a tu panel.' },
  { icon: MessageCircle, title: 'Pedidos por WhatsApp', desc: 'Tus clientes arman su carrito y te lo envían por WhatsApp con un solo toque.' },
  { icon: FileSpreadsheet, title: 'Emisión masiva por Excel', desc: 'Carga un Excel y emite cientos de comprobantes en lote en segundos.' },
  { icon: BarChart3, title: 'Reportes y rentabilidad', desc: 'Ventas, márgenes, IGV débito/crédito y P&L para tomar mejores decisiones.' },
  { icon: Wallet, title: 'Caja y arqueo', desc: 'Abre y cierra caja, registra ingresos y gastos, y cuadra con el arqueo esperado vs. contado.' },
];

const STEPS = [
  { n: 1, title: 'Crea tu cuenta', desc: 'Regístrate en minutos y configura los datos de tu negocio.' },
  { n: 2, title: 'Conecta SUNAT', desc: 'Vincula tu cuenta del proveedor (APISUNAT) y empieza a emitir.' },
  { n: 3, title: 'Vende y crece', desc: 'Factura, vende en el POS, abre tu tienda y controla todo desde un panel.' },
];

export default function LandingPage() {
  return (
    <>
      <LandingNav />

      <header className="lp lp-hero">
        <span className="lp-eyebrow">Facturación electrónica + POS para el Perú 🇵🇪</span>
        <h1 className="lp-h1">Tu negocio facturando con SUNAT en minutos</h1>
        <p className="lp-sub">
          Emite boletas y facturas electrónicas aceptadas por SUNAT, vende con tu punto de venta,
          controla tu inventario y abre tu tienda online. Todo en un solo lugar, hecho para Mypes.
        </p>
        <div className="lp-hero-actions">
          <Link href="/registro" className="btn-primary lp-btn-lg">Empezar gratis</Link>
          <Link href="/precios" className="btn-glass lp-btn-lg">Ver precios</Link>
        </div>
        <div className="lp-trust">Sin instalación · Funciona en celular, tablet y PC · Comprobantes validados en vivo con SUNAT</div>
      </header>

      <section id="features" className="lp lp-section">
        <div className="lp-section-head">
          <h2>Todo lo que tu negocio necesita</h2>
          <p>Deja de pagar varios sistemas distintos. FacturArkos une facturación, ventas, inventario y tienda online.</p>
        </div>
        <div className="lp-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-feat">
              <div className="lp-feat-ico"><f.icon size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="como" className="lp lp-section">
        <div className="lp-section-head">
          <h2>Empieza en 3 pasos</h2>
          <p>De cero a tu primera boleta electrónica el mismo día.</p>
        </div>
        <div className="lp-features">
          {STEPS.map((s) => (
            <div key={s.n} className="lp-feat">
              <div className="lp-feat-ico" style={{ fontWeight: 700, fontSize: 20 }}>{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="precios" className="lp lp-section">
        <div className="lp-section-head">
          <h2>Precios simples y transparentes</h2>
          <p>Sin costos ocultos. Cambia o cancela tu plan cuando quieras.</p>
        </div>
        <PricingCards />
      </section>

      <section className="lp">
        <div className="lp-final">
          <h2>Empieza a facturar hoy</h2>
          <p>Crea tu cuenta gratis y emite tu primer comprobante en minutos.</p>
          <Link href="/registro" className="lp-btn-lg" style={{ display: 'inline-block', fontWeight: 600 }}>Crear cuenta gratis</Link>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}
