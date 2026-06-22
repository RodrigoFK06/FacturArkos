import {
  BarChart3, Boxes, CalendarCheck, ClipboardList, FileSpreadsheet, FileText, HandCoins,
  LayoutDashboard, Package, PackageCheck, Receipt, ReceiptText, Repeat, ScanLine, Settings, ShoppingBag,
  ShoppingCart, Sparkles, Store, Tags, Truck, UserCog, Users, Wallet, type LucideIcon,
} from 'lucide-react';

export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT';

const ALL: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT'];
const MGMT: Role[] = ['OWNER', 'ADMIN', 'MANAGER'];
const FISCAL: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const SALES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'];
const ADMIN_ONLY: Role[] = ['OWNER', 'ADMIN'];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Enlace dinámico por organización que abre en pestaña nueva. */
  dynamic?: 'store' | 'portal';
  keywords?: string;
}
export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL, keywords: 'inicio panel home' },
      { href: '/asistente', label: 'Asistente IA', icon: Sparkles, roles: ALL, keywords: 'ia chat ayuda preguntar' },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { href: '/pos', label: 'Punto de venta', icon: Store, roles: SALES, keywords: 'pos vender caja venta' },
      { href: '/ventas', label: 'Ventas', icon: ClipboardList, roles: SALES, keywords: 'ventas ordenes pedidos anular cancelar historial' },
      { href: '/invoices', label: 'Comprobantes', icon: Receipt, roles: ALL, keywords: 'boleta factura nota credito debito sunat' },
      { href: '/cotizaciones', label: 'Cotizaciones', icon: FileText, roles: SALES, keywords: 'cotizacion nota de venta proforma' },
      { href: '/emision-masiva', label: 'Emisión masiva', icon: FileSpreadsheet, roles: FISCAL, keywords: 'excel lote masivo' },
      { href: '/retenciones', label: 'Retención / Percepción', icon: ReceiptText, roles: FISCAL, keywords: 'retencion percepcion cre pre agente' },
      { href: '/resumen-diario', label: 'Resumen diario', icon: CalendarCheck, roles: FISCAL, keywords: 'boletas dia resumen rc' },
    ],
  },
  {
    title: 'Catálogo e inventario',
    items: [
      { href: '/products', label: 'Productos', icon: Boxes, roles: MGMT, keywords: 'catalogo articulos precios' },
      { href: '/listas-precios', label: 'Listas de precios', icon: Tags, roles: MGMT, keywords: 'precios mayorista menudeo lista tarifa' },
      { href: '/inventory', label: 'Inventario', icon: Package, roles: MGMT, keywords: 'stock almacen kardex' },
      { href: '/purchases', label: 'Compras', icon: ShoppingCart, roles: FISCAL, keywords: 'proveedores compra' },
      { href: '/guias', label: 'Guías de remisión', icon: Truck, roles: MGMT, keywords: 'gre guia remision traslado transporte despacho' },
      { href: '/escanear-compra', label: 'Escanear factura', icon: ScanLine, roles: FISCAL, keywords: 'ocr ia foto compra' },
    ],
  },
  {
    title: 'Clientes y finanzas',
    items: [
      { href: '/clientes', label: 'Clientes', icon: Users, roles: ALL, keywords: 'crm cliente contacto' },
      { href: '/cobranzas', label: 'Cobranzas', icon: HandCoins, roles: SALES, keywords: 'cobrar deuda credito por cobrar' },
      { href: '/recurrente', label: 'Recurrente', icon: Repeat, roles: MGMT, keywords: 'suscripcion mensualidad recurrente' },
      { href: '/caja', label: 'Caja', icon: Wallet, roles: SALES, keywords: 'caja arqueo apertura cierre' },
      { href: '/reports', label: 'Reportes', icon: BarChart3, roles: FISCAL, keywords: 'reporte ventas igv ganancia' },
    ],
  },
  {
    title: 'Tu negocio online',
    items: [
      { href: '/pedidos', label: 'Pedidos online', icon: PackageCheck, roles: SALES, keywords: 'pedidos online delivery despacho preparar entregar fulfillment' },
      { href: '/tienda', label: 'Tienda online', icon: ShoppingBag, roles: MGMT, dynamic: 'store', keywords: 'tienda ecommerce catalogo online' },
      { href: '/portal', label: 'Portal cliente', icon: FileText, roles: ALL, dynamic: 'portal', keywords: 'portal consulta comprobantes cliente' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/usuarios', label: 'Usuarios', icon: UserCog, roles: ADMIN_ONLY, keywords: 'equipo roles cajero gerente permisos' },
      { href: '/settings', label: 'Configuración', icon: Settings, roles: ADMIN_ONLY, keywords: 'ajustes sunat datos negocio yape' },
    ],
  },
];

export function navForRole(role?: string): NavGroup[] {
  const r = (role ?? '') as Role;
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(r)) })).filter((g) => g.items.length > 0);
}

export const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero',
  ACCOUNTANT: 'Contador',
};
