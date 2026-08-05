import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'FacturArkos POS',
  description: 'Facturación electrónica + POS para Perú',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#f5f5f7',
  width: 'device-width',
  initialScale: 1,
};

/** AEO Kit — schema WebSite + creator (Árkos). */
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'FacturArkos',
  description: 'Facturación electrónica SUNAT + POS para Perú',
  inLanguage: 'es',
  creator: {
    '@type': 'Organization',
    name: 'Árkos',
    url: 'https://xn--rkos-4na.com',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
