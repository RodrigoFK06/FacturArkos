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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
