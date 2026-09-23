/**
 * Lo que decide qué ve un buscador. En .mjs porque lo leen robots.ts y
 * sitemap.ts, pero también next.config.mjs, que no importa TypeScript.
 */
export const SITE_URL = 'https://facturarkos-web.vercel.app';

/** Rutas del grupo (admin) más /bienvenida: cascarones tras login. */
export const PANEL = [
  '/asistente',
  '/bienvenida',
  '/caja',
  '/clientes',
  '/cobranzas',
  '/cotizaciones',
  '/dashboard',
  '/emision-masiva',
  '/escanear-compra',
  '/guias',
  '/inventory',
  '/invoices',
  '/listas-precios',
  '/pedidos',
  '/products',
  '/purchases',
  '/recurrente',
  '/reports',
  '/resumen-diario',
  '/retenciones',
  '/settings',
  '/usuarios',
  '/ventas',
];

export const PRIVATE = ['/api/', '/pos', '/portal', '/imprimir', '/login', '/registro', ...PANEL];
