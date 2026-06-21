import Link from 'next/link';
import { LandingNav, LandingFooter } from '@/components/LandingChrome';
import { PricingCards } from '@/components/Pricing';

export const metadata = {
  title: 'Precios — FacturArkos',
  description: 'Planes de FacturArkos: factura electrónica SUNAT, POS, inventario y tienda online para Mypes. Desde S/ 0.',
};

const FAQ = [
  {
    q: '¿Los comprobantes son válidos ante SUNAT?',
    a: 'Sí. Emitimos boletas, facturas, notas de crédito/débito y guías de remisión electrónicas que SUNAT acepta, con su CDR y representación impresa (PDF).',
  },
  {
    q: '¿Necesito instalar algo?',
    a: 'No. FacturArkos funciona desde el navegador en celular, tablet o PC. El POS además funciona sin internet y sincroniza al reconectar.',
  },
  {
    q: '¿Puedo cambiar de plan después?',
    a: 'Claro. Puedes subir, bajar o cancelar tu plan cuando quieras, sin penalidades.',
  },
  {
    q: '¿El plan gratis tiene límite de tiempo?',
    a: 'No. El plan Emprende es gratuito de forma permanente, con un límite mensual de comprobantes. Cuando crezcas, pasas a Negocio o Pro.',
  },
];

export default function PreciosPage() {
  return (
    <>
      <LandingNav />

      <header className="lp lp-hero" style={{ paddingBottom: 32 }}>
        <span className="lp-eyebrow">Planes para cada etapa de tu negocio</span>
        <h1 className="lp-h1" style={{ fontSize: 'clamp(34px, 5vw, 52px)' }}>Precios simples y transparentes</h1>
        <p className="lp-sub">Empieza gratis y paga solo cuando tu negocio crezca. Sin costos ocultos.</p>
      </header>

      <section className="lp" style={{ paddingBottom: 40 }}>
        <PricingCards />
      </section>

      <section className="lp lp-section">
        <div className="lp-section-head">
          <h2>Preguntas frecuentes</h2>
        </div>
        <div className="grid-2">
          {FAQ.map((f) => (
            <div key={f.q} className="lp-feat">
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp">
        <div className="lp-final">
          <h2>¿Listo para empezar?</h2>
          <p>Crea tu cuenta gratis y emite tu primer comprobante hoy.</p>
          <Link href="/registro" className="lp-btn-lg" style={{ display: 'inline-block', fontWeight: 600 }}>Crear cuenta gratis</Link>
        </div>
      </section>

      <LandingFooter />
    </>
  );
}
