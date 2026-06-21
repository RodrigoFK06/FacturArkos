import Link from 'next/link';
import { Check } from 'lucide-react';

export interface Plan {
  name: string;
  desc: string;
  price: string;
  per?: string;
  featured?: boolean;
  cta: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    name: 'Emprende',
    desc: 'Para empezar a facturar hoy mismo, sin costo.',
    price: 'S/ 0',
    per: '/mes',
    cta: 'Crear cuenta gratis',
    features: [
      '1 usuario',
      'Hasta 50 comprobantes / mes',
      'Boletas y facturas electrónicas SUNAT',
      'Punto de venta (POS)',
      'Catálogo de productos',
      'Tienda online básica',
    ],
  },
  {
    name: 'Negocio',
    desc: 'Todo lo que una Mype necesita para crecer.',
    price: 'S/ 59',
    per: '/mes',
    featured: true,
    cta: 'Empezar prueba de 14 días',
    features: [
      'Comprobantes ilimitados',
      'Hasta 3 usuarios',
      'Notas de crédito y débito',
      'Inventario y compras (costeo promedio)',
      'Reportes y P&L',
      'Monitoreo diario SUNAT',
      'Pedidos por WhatsApp',
    ],
  },
  {
    name: 'Pro',
    desc: 'Para varias sucursales y alto volumen.',
    price: 'S/ 119',
    per: '/mes',
    cta: 'Hablar con ventas',
    features: [
      'Todo lo de Negocio, y además:',
      'Multi-sucursal y usuarios ilimitados',
      'Emisión masiva por Excel',
      'Guía de Remisión Electrónica (GRE)',
      'SIRE / PLE (RVIE y RCE)',
      'Formato de comprobante con tu logo',
      'Soporte prioritario',
    ],
  },
];

export function PricingCards() {
  return (
    <div className="lp-prices">
      {PLANS.map((p) => (
        <div key={p.name} className={`lp-price ${p.featured ? 'featured' : ''}`}>
          {p.featured && <span className="lp-price-badge">Más popular</span>}
          <h3>{p.name}</h3>
          <div className="desc">{p.desc}</div>
          <div className="amount">
            {p.price}
            {p.per && <span className="per">{p.per}</span>}
          </div>
          <ul>
            {p.features.map((f) => (
              <li key={f}>
                <Check size={18} /> <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/registro" className={p.featured ? 'btn-primary' : 'btn-glass'} style={{ textAlign: 'center', padding: '12px 18px', borderRadius: 12, fontWeight: 600 }}>
            {p.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}
