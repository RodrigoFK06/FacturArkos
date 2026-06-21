# FacturArkos

SaaS multi-tenant de **facturación electrónica (SUNAT vía APISUNAT) + POS + inventario** para Perú.
Construido sobre los patrones probados de `PLAYBOOK_INTEGRACIONES_SAAS.md`.

- **Backend:** NestJS 11 + Prisma + PostgreSQL (`apps/api`)
- **Frontend:** Next.js 15 PWA con POS offline (`apps/web`)
- **Docs:** catálogo de 162 requerimientos y plan de desarrollo en `docs/`

## Estado (lo implementado en este repo)

| Fase | Módulo | Estado |
|------|--------|--------|
| F0 | Monorepo, capa común (cifrado AES-256-GCM, timezone Lima, fail-fast), multi-tenant, auth JWT, roles | ✅ |
| F1 | SUNAT: config per-tenant cifrada, cliente APISUNAT, builder UBL (Factura/Boleta/NC/ND), correlativos atómicos, emisión outbox-lite + polling, baja `VOID_PENDING`, reconciliación | ✅ |
| F2 | POS (venta + IGV + stock), Caja (apertura/cierre/arqueo), Clientes (consulta DNI/RUC), contingencia offline (PWA + IndexedDB) | ✅ |
| F3 | Inventario (multi-almacén, movimientos, traslados, **kardex valorizado**, alertas de stock/vencimiento, lotes), Compras (proveedores, recepción + **costeo promedio**), **GRE remitente** | ✅ |
| F4 | Reportes (dashboard KPIs, ventas, **P&L/margen**, **resumen IGV**, top productos, caja, compras), **SIRE** (RVIE/RCE), **export PLE** TXT (ventas/compras) | ✅ |
| F5 | Pagos per-tenant + webhook Niubiz (fail-closed, lock optimista, idempotencia) | ✅ base |
| F6 | **Tienda online** (storefront público por tenant: catálogo + carrito + checkout → pedido ONLINE sincronizado al panel) | ✅ base |

Verificado: `typecheck` ✅ · `build` (api + web) ✅ · `test` (7/7) ✅.

### ✅ Validado contra SUNAT (APISUNAT dev, cuenta arkosprueba RUC 10758936746)
**Los 5 comprobantes ACEPTADOS por SUNAT sin observaciones**, end-to-end (Postgres real → API → APISUNAT → CDR + PDF):
**Boleta**, **Factura**, **Nota de Crédito**, **Guía de Remisión Remitente** y **Nota de Débito**.
El flujo completo corre: venta → IGV → stock → correlativo atómico → emisión (outbox-lite + polling) → CDR.
Infra: **Postgres portable** (sin Docker) en `:55433`. Frontend operable: onboarding SUNAT, alta de
productos/compras, POS, y emisión/NC/ND/anulación desde el panel.

**Producción:** `/api/health`, helmet (CSP/HSTS), rate limiting, graceful shutdown · Dockerfiles
(api + web), `docker-compose.prod.yml`, CI (`.github/workflows/ci.yml`) · guía completa en **[DEPLOY.md](DEPLOY.md)**.

## Requisitos

- Node ≥ 20, pnpm ≥ 10
- PostgreSQL 14+ (local o gestionado)

## Puesta en marcha

```bash
# 1. Dependencias
pnpm install
pnpm --filter @facturarkos/api exec prisma generate

# 2. Configurar entorno (ya hay un .env de ejemplo en apps/api)
#    Ajusta DATABASE_URL a tu Postgres. Genera claves:
#    openssl rand -hex 32   → SECRETS_ENCRYPTION_KEY y JWT_SECRET

# 3. Crear el esquema y datos demo
pnpm --filter @facturarkos/api exec prisma db push
pnpm --filter @facturarkos/api seed
#    → login demo: demo@facturarkos.pe / password123  (RUC 20123456789)

# 4. Levantar
pnpm dev        # API  en http://localhost:3001/api
pnpm dev:web    # Web  en http://localhost:3000
```

## Flujo de demo (POS → comprobante)

1. Entra a `http://localhost:3000`, inicia sesión con la cuenta demo.
2. Agrega productos al carrito, elige Boleta/Factura y método de pago.
3. **Cobrar y emitir** → crea la venta, descuenta stock y emite el comprobante
   contra APISUNAT (cuenta dev `arkosprueba` configurada en `.env`).
4. Sin conexión, la venta se **encola en IndexedDB** y se sincroniza al reconectar.

## Endpoints principales (prefijo `/api`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/register` · `/auth/login` | Alta de negocio / login |
| GET/PUT | `/sunat-config` | Credenciales SUNAT per-tenant (cifradas, enmascaradas) |
| GET | `/products` · `/products/barcode/:b` | Catálogo / búsqueda por código de barras |
| GET | `/customers/lookup?type=DNI&number=` | Consulta RENIEC/SUNAT y guarda cliente |
| POST | `/orders` | Registra venta (+ emisión opcional en el mismo paso) |
| POST | `/invoices/emit/:orderId` | Emite comprobante de una orden |
| POST | `/invoices/:id/void` · `/:id/refresh` | Baja async / reconciliación |
| POST | `/cash/open` · `/cash/:id/close` | Apertura / cierre de caja con arqueo |
| POST | `/payments/niubiz/qr` | Genera QR Niubiz (per-tenant) |
| POST | `/webhooks/niubiz/:organizationId` | Webhook público fail-closed |
| GET/POST | `/inventory/stock` · `/inventory/movements` · `/inventory/transfers` | Stock, ingresos/ajustes, traslados |
| GET | `/inventory/kardex/:productId` · `/inventory/alerts/low-stock` · `/inventory/alerts/expiring` | Kardex valorizado y alertas |
| GET/POST | `/suppliers` · `/purchases` | Proveedores y compras (recepción + costeo) |
| GET/POST | `/gre` | Guía de Remisión Electrónica remitente |
| GET | `/reports/dashboard` · `/reports/sales` · `/reports/profit` · `/reports/igv` | KPIs y reportes |
| GET | `/sire/rvie` · `/sire/rce` · `/sire/ple/sales` · `/sire/ple/purchases` | Registros SIRE y export PLE (`?period=YYYYMM`) |

## Patrones del playbook aplicados

P1 cifrado AES-256-GCM at-rest · P2 config per-tenant + masking · P3 webhook fail-closed +
`timingSafeEqual` · P4 idempotencia + lock optimista (`updateMany` condicional) · P5 montos
recalculados desde BD · P6 outbox-lite (PENDING antes de la llamada) + polling con backoff ·
P7 fail-fast sin fallbacks dummy. Fechas fiscales en timezone Lima; IGV descompuesto desde el
total cobrado; correlativos `upsert+increment` atómicos.

## Estructura

```
apps/api/src/
  common/         crypto (encrypt), utils (lima-time, money), config (fail-fast), prisma, decorators
  auth/           JWT, guards (secure-by-default), roles
  tenancy/        organización, establecimientos, usuarios
  sunat-config/   credenciales SUNAT per-tenant (cifradas)
  apisunat/       cliente HTTP + builder UBL + errores tipados
  invoices/       correlativos + orquestación de emisión (outbox-lite)
  catalog/        productos, categorías
  customers/      clientes + peru-api (DNI/RUC)
  pos/            ventas (cálculo IGV, stock, caja)
  cash/           sesiones de caja
  payments/       config per-tenant + Niubiz + webhook seguro
  inventory/      almacenes, movimientos, traslados, kardex valorizado, alertas, lotes
  purchases/      proveedores, compras con recepción + costeo promedio
  gre/            guía de remisión electrónica (builder DespatchAdvice + emisión)
  reports/        dashboard + reportes (ventas, P&L, IGV, top productos, caja)
  sire/           RVIE/RCE + exportación PLE TXT (ventas 14.1 / compras 8.1)
apps/web/src/
  app/            login · pos (PWA) · (admin): dashboard, inventory, invoices, purchases, reports
  components/     ui (Glass, FadeIn, StatCard), Sidebar
  lib/            api, auth, offline (cola IndexedDB)
```

### Frontend de administración
Panel con estética **liquid glass** (fondo negro, paneles de vidrio, tipografía *Instrument Serif*,
animaciones con framer-motion, iconos lucide-react). Rutas: `/dashboard` (KPIs + top productos),
`/inventory` (stock + alertas), `/invoices` (comprobantes), `/purchases` (compras), `/reports`
(ventas/P&L/IGV). El POS (`/pos`) mantiene su vista de caja a pantalla completa con modo offline.

⚠️ **Nota:** el builder UBL (`apisunat.builder.ts`) y las rutas Niubiz siguen el estándar pero
deben reconciliarse contra el código probado de RestHUB / la doc del proveedor antes de producción.
