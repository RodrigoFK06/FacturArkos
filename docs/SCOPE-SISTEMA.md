# FacturArkos — Scope técnico del sistema (detalle a detalle)

> Estado: en producción. Frontend `https://facturarkos-web.vercel.app` · API `https://facturarkos.vercel.app/api` · DB Neon Postgres (us-east-1).
> Última actualización: 2026-06-22.

---

## 1. Qué es

SaaS peruano para Mypes que combina **facturación electrónica SUNAT** (boleta, factura, NC, ND, guía de remisión, retención, percepción, detracción) + **POS** + **inventario** + **compras** + **caja** + **CRM/cobranzas** + **tienda online** + **reportes/SIRE** + **asistente IA**. Multi-tenant: un mismo despliegue atiende a muchos negocios, aislados por `organizationId`.

---

## 2. Stack y despliegue

| Capa | Tecnología |
|---|---|
| API | NestJS 11 + TypeScript, Prisma 6 ORM |
| DB | PostgreSQL (Neon en prod; Postgres portable local en `.pgdev/`) |
| Frontend | Next.js 15 (App Router) PWA, React 19 |
| Auth | JWT (HS256), bcrypt para hashes |
| Facturación | APISUNAT (proveedor SEE) vía REST; builders UBL 2.1 propios |
| Hosting | Vercel (2 proyectos desde el monorepo) — la API corre **serverless** |

**Monorepo** (`pnpm workspaces`): `apps/api` (NestJS) + `apps/web` (Next). Detalle de despliegue serverless en `apps/api/api/index.js` + `apps/api/vercel.json` (ver memoria `facturarkos-deployment.md`).

---

## 3. Arquitectura multi-tenant (cómo se aísla cada negocio)

**Modelo: single-DB, aislamiento por fila vía `organizationId`.**

1. **Origen de verdad = el JWT.** Al hacer login, el token lleva `{ sub: userId, org: organizationId, email, role }`. El `organizationId` **vive en el token, nunca en el body** del request → un usuario no puede pedir datos de otra organización manipulando el payload.
2. **`JwtAuthGuard`** (global) verifica el token y arma `req.user = { userId, organizationId, email, role }`.
3. **`@OrgId()`** (param decorator) extrae `req.user.organizationId` y se inyecta en cada handler.
4. **Cada query de Prisma filtra por `organizationId`** (`where: { organizationId, ... }`). Todas las tablas de negocio tienen la columna `organizationId` con índice.
5. **Endpoints públicos** (tienda, webhooks, portal) reciben el `organizationId` **en la ruta** (`/store/:orgId/...`) porque no hay sesión — y solo exponen datos no sensibles / de esa tienda.

Resultado: imposible cruzar datos entre tenants desde la capa autenticada; el `organizationId` no es manipulable por el cliente.

---

## 4. Seguridad (defensa en capas)

- **Secure-by-default**: tres guards globales en `app.module.ts` aplican a TODAS las rutas salvo `@Public()`:
  - `ThrottlerGuard` — rate limit 120 req/min por IP.
  - `JwtAuthGuard` — exige `Authorization: Bearer <jwt>` válido.
  - `RolesGuard` — valida `@Roles(...)` contra `user.role`.
- **Roles** (`UserRole`): `OWNER`, `ADMIN`, `MANAGER`, `CASHIER`, `ACCOUNTANT`. `@Roles()` vacío anula el rol de clase (se usa en los cron públicos).
- **Cifrado de secretos at-rest** (`common/crypto/encrypt.ts`): credenciales de terceros (token SUNAT, llaves de pasarela) se guardan con **AES-256-GCM** (`iv:authTag:ciphertext` en base64). Clave maestra `SECRETS_ENCRYPTION_KEY` (32 bytes hex) en env. `toStored()` evita doble-cifrado; `maskTail()` nunca devuelve el plaintext al admin (solo `••••••XXXX`). Si alguien manipula el ciphertext, el descifrado falla por el authTag.
- **Validación de entrada**: `ValidationPipe` global con `whitelist: true` + `transform: true` (DTOs con `class-validator`); descarta campos no declarados.
- **Helmet** (cabeceras de seguridad) + **CORS** restringido por `CORS_ORIGINS` (normalizado, sin barra final).
- **Fail-fast de entorno** (`validateEnv`): si falta `DATABASE_URL`/`JWT_SECRET`/`SECRETS_ENCRYPTION_KEY` o la llave no decodifica a 32 bytes, la app **no arranca** (nunca corre con cifrado roto).
- **Cron protegido**: los endpoints `/recurring/cron` y `/monitor/cron` son `@Public` pero exigen `Authorization: Bearer <CRON_SECRET>`.

---

## 5. Optimización e integridad de datos (los patrones clave)

1. **Correlativos atómicos (P4)** — `BillingSeriesService.getNextNumber` usa `upsert + increment` como lock optimista de Postgres: dos cajas concurrentes **nunca** obtienen el mismo número ni dejan huecos. Reintento único ante `P2002`.
2. **Outbox-lite (P6)** — al emitir a SUNAT: se persiste el comprobante en `PENDING` **antes** de llamar a APISUNAT; si APISUNAT está caído (error transitorio) queda `PENDING` y se reconcilia luego (cron/endpoint); si SUNAT rechaza, pasa a `REJECTED` con el mensaje. Nunca se pierde un comprobante por una caída de red.
3. **Idempotencia**:
   - `Invoice.orderId` es **único** → 1:1 venta↔comprobante; doble-click devuelve el mismo comprobante (maneja la carrera `P2002`).
   - `Payment.externalId` único → no se duplica un pago del proveedor.
4. **Transacciones** — `createSale` corre orden + ítems + descuento de stock + movimiento de inventario + ingreso a caja **en una sola `$transaction`** (todo o nada).
5. **Dinero en `Decimal`** (`@db.Decimal(14,2)` montos, `(14,4)` precios/costos, `(14,3)` cantidades) — sin errores de coma flotante. El **IGV se descompone "hacia atrás"** desde el total cobrado (el precio del POS ya incluye IGV).
6. **Reconciliación de montos en backend (P5)** — los importes (detracción, retención, percepción, totales) se recalculan **desde la BD**, nunca se confía en el número que manda el front.
7. **Índices** — `@@index([organizationId, ...])` en todas las tablas de negocio (por estado, fecha, tipo de doc, etc.) para listados rápidos por tenant.
8. **Proyecciones `select`** — endpoints públicos/listados traen solo los campos necesarios (no `SELECT *`), p. ej. tienda online, listado de usuarios.
9. **Límites de lectura** — listados con `take: 100` (o 200/2000 según el caso) para no traer historiales enormes.
10. **Polling con backoff exponencial** — al esperar el CDR de SUNAT (`waitForFinal`: 2s → ×1.4 → máx 8s, timeout 30s); un `getById` fallido no aborta el loop.
11. **Fechas fiscales en timezone Lima** (`limaDateString`/`limaTimeString`) — el día contable no se corre por UTC.
12. **Soft-disable, no borrado físico** — los maestros (producto, categoría, cliente, proveedor, almacén, usuario, establecimiento) no se eliminan: tienen un flag `active` y se deshabilitan. Así no se rompe la integridad referencial con el historial (ventas, kardex, comprobantes). Los listados operativos (POS, tienda, selectores) traen solo `active: true`; los paneles de gestión piden `?all=1` para ver y reactivar los ocultos. No existe ningún endpoint `DELETE`.

---

## 6. Modelo de datos (entidades núcleo)

`Organization` (tenant raíz) → `User`, `Establishment`, `SunatConfig`, `PaymentConfig`, `BillingSeries`, `Category`, `Unit`, `PriceList`/`ProductPrice`, `Product`, `Warehouse`/`Stock`/`StockMovement`/`Lot`, `Customer`, `Supplier`, `CashSession`/`CashMovement`, `Order`/`OrderItem`/`Payment`, `Invoice`, `GuiaRemision`/`GuiaRemisionItem`, `CommercialDoc` (cotización/nota de venta), `RecurringPlan`, `TaxDocument`/`TaxDocumentRef` (retención/percepción), `AuditLog`, `Purchase`/`PurchaseItem`.

Notas:
- `Invoice` es 1:1 con `Order` para ventas; `orderId` nulo en NC/ND (referencian otro comprobante).
- `TaxDocument` es modelo aparte porque CRE/PRE no son ventas: referencian varios comprobantes.
- `Order` incluye `saleType` (LOCAL/ONLINE/DELIVERY), `fulfillmentStatus`, `detraction`, `dueDate` (crédito).

---

## 7. Integración SUNAT (flujo)

1. Builders UBL 2.1 **puros** (sin red, testeables): `apisunat.builder.ts` (factura/boleta/NC/ND), `tax-doc.builder.ts` (retención/percepción), `gre.builder.ts` (guía). Generan el `documentBody` estilo `xml-js` que espera APISUNAT.
2. `ApiSunatService` = cliente HTTP "tonto" (solo llamadas + timeouts + mapeo de errores a tipos de dominio).
3. Servicios de negocio (invoices/taxdoc/gre) aplican correlativo atómico → persisten `PENDING` → `sendBill` → `waitForFinal` (polling) → mapean estado SUNAT (`ACEPTADO`→ACCEPTED, etc.) → guardan `externalId`, `sunatCode`, `sunatMessage`, `pdfUrl`.
4. Credenciales por tenant (cifradas en `SunatConfig`) o fallback a la cuenta dev de env.
5. **Verificado en vivo**: boleta, factura, factura con detracción, NC, ND, GRE (público y privado) → ACEPTADAS por SUNAT. Pendiente: retención/percepción (APISUNAT no expone el builder tipo 20/40 en la cuenta dev).

---

## 8. Referencia de endpoints (prefijo global `/api`)

Convención de roles: **(auth)** = cualquier usuario autenticado; **(público)** = sin login; el resto lista los roles permitidos.

### Auth — `/auth`
- `POST /auth/register` **(público)** — alta self-service: crea organización + usuario OWNER + establecimiento + almacén + unidades; devuelve token.
- `POST /auth/login` **(público)** — valida credenciales (bcrypt), devuelve `access_token` + `user`.
- `GET /auth/me` **(auth)** — datos del usuario del token.

### Organización / tenant — (raíz)
- `GET /organization` **(auth)** — datos del negocio.
- `PATCH /organization` **(OWNER, ADMIN)** — actualiza perfil (dirección, ubigeo, logo, WhatsApp, Yape/Plin, flags de agente retención/percepción, cuenta de detracción).
- `GET /establishments` **(auth)** — sucursales/anexos (`?all=1` incluye deshabilitados).
- `POST /establishments` **(OWNER, ADMIN)** — crea establecimiento (código 4 dígitos).
- `PATCH /establishments/:id` **(OWNER, ADMIN)** — edita nombre/dirección o deshabilita (el principal no se puede deshabilitar).
- `GET /users` **(OWNER, ADMIN)** — equipo.
- `POST /users` **(OWNER, ADMIN)** — crea usuario con rol.
- `PATCH /users/:id` **(OWNER, ADMIN)** — edita nombre/rol, resetea contraseña o activa/desactiva. Protege al OWNER (no se desactiva ni se le cambia el rol; tampoco se asigna OWNER a otro). Un usuario inactivo no puede iniciar sesión.

### Catálogo — (raíz)
- `GET /products` **(auth)** — lista (filtro `q`; `?all=1` incluye ocultos, para la gestión del catálogo). POS/tienda usan el default (solo activos).
- `GET /products/barcode/:barcode` **(auth)** — busca por código de barras (POS).
- `GET /products/:id` **(auth)**.
- `POST /products` / `PATCH /products/:id` **(OWNER, ADMIN, MANAGER)** — alta/edición; precio con IGV incluido, afectación IGV, código SUNAT, stock mínimo; `active` para ocultar/mostrar.
- `GET /categories` **(auth)** (`?all=1` incluye ocultas) / `POST /categories` / `PATCH /categories/:id` **(OWNER, ADMIN, MANAGER)** — renombra o deshabilita.
- **Listas de precios** (menudeo/mayorista): `GET /price-lists` **(auth)** · `POST /price-lists` / `PATCH /price-lists/:id` (nombre / predeterminada) **(OWNER, ADMIN, MANAGER)** · `GET /price-lists/:id/prices` **(auth)** (productos con su precio en la lista) · `PUT /price-lists/:id/prices` **(OWNER, ADMIN, MANAGER)** (fija/elimina precios). `GET /products?priceListId=` devuelve los productos con el precio de esa lista (el POS lo usa con su selector).

### Clientes — `/customers`
- `GET /customers` **(auth)** — lista (filtro `q`).
- `GET /customers/lookup?type=&number=` **(auth)** — consulta RUC/DNI a apis.net.pe y **lo guarda** (upsert).
- `GET /customers/:id` **(auth)** · `POST /customers` **(auth)** — alta.
- `PATCH /customers/:id` **(auth)** — edita nombre/contacto o deshabilita (el documento/tipo es la llave, no se cambia). `?all=1` en el listado incluye ocultos.

### POS / ventas — `/orders`
- `POST /orders` **(auth)** — registra venta: calcula totales (IGV descompuesto), descuenta stock, ingreso a caja, todo en transacción; opcionalmente **emite** el comprobante (checkout) y aplica **detracción** si es factura.
- `GET /orders` **(auth)** — últimas ventas.
- `GET /orders/:id` **(auth)** — detalle.
- `GET /orders/online` **(auth)** — tablero de pedidos de tienda/delivery.
- `PATCH /orders/:id/fulfillment` **(OWNER, ADMIN, MANAGER, CASHIER)** — avanza estado de preparación/entrega.
- `POST /orders/bulk` **(OWNER, ADMIN, MANAGER, CASHIER)** — emisión masiva (cada doc aislado, no aborta el lote).
- `POST /orders/:id/cancel` **(OWNER, ADMIN, MANAGER)** — anula una venta SIN comprobante aceptado: repone stock (RETURN_IN) y revierte el ingreso de caja en una transacción. Si ya tiene comprobante, se anula por comunicación de baja. UI en `/ventas`.

### Comprobantes SUNAT — `/invoices`
- `GET /invoices` **(auth)** — últimos 100.
- `GET /invoices/series` **(auth)** — series y correlativos.
- `GET /invoices/:id` **(auth)** · `GET /invoices/:id/print` **(auth)** — datos para la representación impresa propia (logo/pie/detracción).
- `POST /invoices/emit/:orderId` **(OWNER, ADMIN, MANAGER, CASHIER)** — emite boleta/factura de una orden (outbox-lite + polling).
- `POST /invoices/:id/refresh` **(auth)** — reconcilia estado contra SUNAT.
- `POST /invoices/:id/void` **(OWNER, ADMIN, MANAGER)** — comunicación de baja (estado intermedio `VOID_PENDING`).
- `POST /invoices/:id/credit-note` / `:id/debit-note` **(OWNER, ADMIN, MANAGER)** — NC/ND que referencian un comprobante ACEPTADO.

### Retención / Percepción — `/tax-docs` **(OWNER, ADMIN, MANAGER, ACCOUNTANT)**
- `GET /tax-docs?kind=RETENCION|PERCEPCION` · `GET /tax-docs/:id`.
- `POST /tax-docs/retencion` / `percepcion` — emite CRE/PRE (recalcula montos por comprobante, outbox-lite).
- `POST /tax-docs/:id/refresh` — reconcilia.

### Guía de remisión — `/gre`
- `GET /gre` **(auth)** · `GET /gre/:id` **(auth)** · `POST /gre/:id/refresh` **(auth)**.
- `POST /gre` **(OWNER, ADMIN, MANAGER)** — emite GRE remitente (transporte público 01 / privado 02).

### Documentos comerciales (no SUNAT) — `/commercial`
- `GET /commercial` **(auth)** · `GET /commercial/:id` **(auth)** — cotizaciones / notas de venta.
- `POST /commercial` / `:id/convert` **(OWNER, ADMIN, MANAGER, CASHIER)** — crea y convierte a venta.
- `POST /commercial/:id/cancel` **(OWNER, ADMIN, MANAGER)** — anula un documento abierto (ciclo ABIERTA → CONVERTIDA | ANULADA).

### Inventario — `/inventory`
- `GET /inventory/warehouses` (`?all=1` incluye ocultos) / `stock` / `kardex/:productId` / `alerts/low-stock` / `alerts/expiring` / `lots` **(auth)**.
- `POST /inventory/warehouses` / `PATCH /inventory/warehouses/:id` (renombra / marca principal / deshabilita — el principal no se deshabilita) / `movements` (ingreso/salida/ajuste/devolución) / `transfers` (entre almacenes) / `lots` **(OWNER, ADMIN, MANAGER)**.

### Compras — (raíz)
- `GET /suppliers` (`?all=1` incluye ocultos) / `GET /purchases` **(auth)**.
- `POST /suppliers` / `PATCH /suppliers/:id` (edita datos o deshabilita; el RUC es la llave) / `POST /purchases` **(OWNER, ADMIN, MANAGER)** — registra compra (suma stock, costo).

### Caja — `/cash` **(auth)**
- `GET /cash/current` — sesión abierta.
- `POST /cash/open` · `POST /cash/:id/movements` (ingreso/egreso) · `POST /cash/:id/close` (arqueo).

### Cobranzas — `/receivables`
- `GET /receivables` **(auth)** — cuentas por cobrar con aging (vencido/por vencer).
- `POST /receivables/:orderId/payment` **(OWNER, ADMIN, MANAGER, CASHIER)** — abono parcial, marca PAID al saldar, ingreso a caja si efectivo.

### Facturación recurrente — `/recurring`
- Clase **(OWNER, ADMIN, MANAGER)**: `GET /recurring`, `POST /recurring`, `PATCH /recurring/:id` (edita el plan; reemplaza ítems), `POST /recurring/:id/status`, `POST /recurring/:id/run`.
- `GET /recurring/cron` **(público + CRON_SECRET)** — emite todos los planes vencidos (Vercel Cron diario).

### Pagos / pasarela — `/payments`, `/webhooks/niubiz`
- `GET /payments/config` **(auth)** · `POST /payments/config` **(OWNER, ADMIN)** — credenciales de pasarela (cifradas).
- `POST /payments/niubiz/qr` **(auth)** — genera cobro QR.
- `GET|POST /webhooks/niubiz/:organizationId` **(público)** — webhook de confirmación (idempotente por `externalId`).

### Tienda online / portal — `/store` **(público)**
- `GET /store/:orgId/info` — datos de la tienda (logo, WhatsApp, Yape/Plin).
- `GET /store/:orgId/products` — catálogo activo.
- `POST /store/:orgId/orders` — crea pedido online (sin emitir; el comercio lo gestiona).
- `GET /store/:orgId/comprobantes?doc=` — portal: el cliente ve sus comprobantes por DNI/RUC.

### Reportes — `/reports` **(OWNER, ADMIN, MANAGER, ACCOUNTANT)**
- `dashboard`, `sales`, `top-products`, `purchases`, `cash`, `profit`, `igv` (débito/crédito), `daily-boletas`.

### SIRE / libros — `/sire` **(OWNER, ADMIN, ACCOUNTANT)**
- `GET /sire/rvie?period=YYYYMM` (ventas) · `rce` (compras) · `ple/sales` · `ple/purchases` (formato PLE).

### Config SUNAT — `/sunat-config`
- `GET /sunat-config` **(auth)** — estado (secretos enmascarados).
- `PUT /sunat-config` **(OWNER, ADMIN)** — guarda personaId/token cifrados; PATCH sin secreto preserva el existente.

### IA — `/ai`
- `GET /ai/status` **(auth)** — `{available, visionAvailable}` (degradación elegante sin key).
- `POST /ai/ask` **(auth)** — asistente: snapshot del negocio + chat (proveedor compatible OpenAI, default DeepSeek).
- `POST /ai/scan-purchase` **(OWNER, ADMIN, MANAGER)** — OCR de factura de compra por imagen (modelo con visión).

### Monitoreo — `/monitor`, `/health`
- `GET /health` **(público)** — `{status, db, time}`.
- `GET /monitor/health` **(auth)** — salud SUNAT del tenant.
- `POST /monitor/reconcile` **(OWNER, ADMIN, MANAGER, ACCOUNTANT)** — reconcilia comprobantes del tenant.
- `GET /monitor/cron` **(público + CRON_SECRET)** — reconcilia TODAS las orgs (Vercel Cron diario).

---

## 9. Tareas programadas (Vercel Cron)

| Cron | Horario (UTC / Lima) | Qué hace |
|---|---|---|
| `/api/recurring/cron` | 11:00 / 06:00 | Emite los planes recurrentes vencidos |
| `/api/monitor/cron` | 13:00 / 08:00 | Reconcilia el estado SUNAT de comprobantes pendientes |

> En serverless los `@Cron` in-process de `@nestjs/schedule` no corren; por eso se exponen como endpoints que dispara Vercel Cron, protegidos con `CRON_SECRET`.

---

## 10. Frontend (mapa de páginas, `apps/web`)

- **Público**: `/` (landing), `/precios`, `/login`, `/registro`, `/bienvenida`, `/tienda/[orgId]`, `/portal/[orgId]`, `/imprimir/[id]`.
- **Panel** (`(admin)`, sidebar por rol): `/dashboard`, `/asistente` (IA), `/pos`, `/ventas` (historial + anular), `/invoices`, `/cotizaciones`, `/emision-masiva`, `/retenciones`, `/resumen-diario`, `/products`, `/listas-precios`, `/inventory`, `/purchases`, `/guias`, `/escanear-compra`, `/clientes`, `/cobranzas`, `/recurrente`, `/caja`, `/reports`, `/pedidos` (fulfillment), `/tienda`, `/portal`, `/usuarios`, `/settings`.
- Nav central filtrado por rol (`lib/nav.ts`), etiquetas en español (`lib/labels.ts`), patrón de listas: skeleton (cargando) → empty state → tabla; UX con principios de motion (Emil Kowalski) e impeccable.
- **Gestión completa de maestros (CRUD)**: productos, categorías (mini-gestor dentro de Productos), clientes, proveedores (panel dentro de Compras), almacenes (panel dentro de Inventario), usuarios y establecimientos tienen alta + edición (formulario inline reutilizado) + ocultar/activar + toggle "Mostrar ocultos". El precio/stock mínimo de un producto ya es editable.
- **Onboarding guiado**: el `/dashboard` muestra una tarjeta "Pon en marcha tu negocio" con un checklist de 6 pasos (datos del negocio, SUNAT, primer producto, primer cliente, primera venta, invitar equipo) cuyo estado se deriva de datos reales; cada paso pendiente enlaza a la página correspondiente, y al completarse todo muestra un estado de "listo".
- **Listas de precios**: `/listas-precios` (crear listas menudeo/mayorista + editor de precios por producto); el POS tiene un selector que recotiza el catálogo según la lista. **Ventas**: `/ventas` (historial de ventas con anulación que repone stock). **Recurrente** y **cotizaciones** ahora se pueden editar/anular desde la UI.

## 12. Pruebas automatizadas

Jest (ts-jest, sin DB) — **26 tests** en `apps/api/src/**/*.spec.ts`, corren en CI (`.github/workflows/ci.yml`). Cubren: descomposición de IGV y costeo promedio (`money`), builders UBL (`apisunat.builder`), y la lógica de negocio crítica con Prisma mockeado: anulación de venta (repone stock, bloquea si hay comprobante aceptado), protección del OWNER al editar usuarios, override de precio por lista + `setPrices`, almacén principal no desactivable, y ciclo de anulación de documentos comerciales.

---

## 11. Configuración requerida para producción real

- **Emisión fiscal válida**: cuenta APISUNAT de **producción** por tenant (certificado digital + usuario SOL), `APISUNAT_TEST_MODE=false`. Hoy corre con cuenta de **pruebas**.
- **IA**: `AI_API_KEY` (+ `AI_VISION_*` para OCR).
- **Pasarelas** (Niubiz/Izipay/Culqi): credenciales prod por tenant.
- **Lookup RUC/DNI**: `PERU_API_TOKEN` para mayor fiabilidad.
- Pendientes conocidos: retención/percepción en vivo (APISUNAT tipo 20/40), OCR→auto-crear compra, RC resumen (decisión: no se construye, redundante con emisión individual).
