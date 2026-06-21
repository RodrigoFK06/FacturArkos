# FacturArkos — Documento de Traspaso (estado del proyecto)

> SaaS multi-tenant de **facturación electrónica SUNAT + POS + inventario + tienda online** para Perú.
> Objetivo: igualar y superar a competidores (SmartClic, Keyfacil, listados de ComparaSoftware).
> Última actualización: 2026-06-20 (añadidas emisión masiva Excel, PDF propio, WhatsApp, landing+precios+registro, resumen diario, IA agnóstica/DeepSeek, y el set "aplastar competencia": **cobranzas, Yape/Plin, facturación recurrente, comprobante por WhatsApp + portal del cliente**). Lanzamiento objetivo: ~1 día.

---

## 1. Estado en una línea

Núcleo fiscal **completo y validado contra SUNAT (5/5 comprobantes aceptados)**, panel operable de punta a punta con estética Apple/iOS, onboarding (wizard + tour), monitoreo SUNAT, tienda online, y artefactos de despliegue. Corre localmente end-to-end. Falta breadth comercial (cotizaciones, etc.), endurecimiento de producción real y marketing.

## 2. Stack y arquitectura

- **Monorepo pnpm**: `apps/api` (NestJS 11 + Prisma + PostgreSQL), `apps/web` (Next.js 15 PWA).
- **Facturación SUNAT vía APISUNAT** (intermediario PAC; firma UBL 2.1 + CDR). NO se habla directo a SUNAT.
- **Multi-tenant single-DB**: todo se aísla por `organizationId` (del JWT, nunca del body).
- **Patrones clave (de `PLAYBOOK_INTEGRACIONES_SAAS.md`)**: secrets cifrados AES-256-GCM, config per-tenant, webhooks fail-closed + lock optimista, outbox-lite (PENDING antes de enviar), correlativos atómicos `upsert+increment`, montos recalculados desde BD, fechas fiscales en timezone Lima, fail-fast sin dummies.
- Docs de referencia: `docs/requerimientos-sector-facturacion-pos.md` (162 reqs), `docs/plan-desarrollo.md`, `README.md`, `DEPLOY.md`.

## 3. Cómo levantar el proyecto (local, Windows)

> **Docker es inestable en esta máquina** → usamos **PostgreSQL portable** en `.pgdev/` (puerto **55433**; el 5432 está ocupado por otro Postgres local).

```bash
# 1. Postgres portable (ya descargado en .pgdev/). Arrancar:
"C:/Trabajo/Clientes/FacturArkos/.pgdev/pgsql/bin/pg_ctl.exe" -D "C:/Trabajo/Clientes/FacturArkos/.pgdev/data" -o "-p 55433" -l "C:/Trabajo/Clientes/FacturArkos/.pgdev/pg.log" -w start
# (si la BD 'facturarkos' no existe): .pgdev/pgsql/bin/createdb.exe -h 127.0.0.1 -p 55433 -U postgres facturarkos

# 2. Dependencias + Prisma
pnpm install
pnpm --filter @facturarkos/api exec prisma generate
pnpm --filter @facturarkos/api exec prisma db push
pnpm --filter @facturarkos/api seed     # crea org demo

# 3. Arrancar (en terminales separadas o background)
pnpm --filter @facturarkos/api start:prod   # API :3001/api  (compila con `build` primero si cambió código)
pnpm --filter @facturarkos/web dev           # Web :3000
```

- **Login demo:** `demo@facturarkos.pe` / `password123`
- **Tienda pública:** `/tienda/{organizationId}` (el orgId se obtiene de `/api/auth/me`; cambia en cada re-seed).
- `apps/api/.env` ya tiene `DATABASE_URL=...127.0.0.1:55433...` y las credenciales dev de APISUNAT.

## 4. Credenciales y datos clave

- **APISUNAT (ambiente DESARROLLO, cuenta "arkosprueba"):** `personaId=69fb5c4e003caf0029394d5f`, token `DEV_evOe...` (en `.env`). **RUC de la cuenta = `10758936746`** (el seed ya usa este RUC para que emita de fábrica).
- **Descubrir documentos/RUC de la cuenta:** `GET https://back.apisunat.com/documents/getAll?personaId=&personaToken=`.
- **APISUNAT endpoints reales:** sendBill `POST /personas/v1/sendBill`; getById `GET /documents/:id/getById`; getAll `GET /documents/getAll`; voidBill `POST /personas/v1/voidBill`; PDF `GET /documents/:id/getPDF/{A4|ticket58mm|...}/{fileName}.pdf`.
- **Generador JSON de APISUNAT** (en el portal de la empresa, ícono `{ }`): da el `documentBody` exacto válido de cada tipo de documento — usarlo cuando un builder no sea aceptado.

## 5. Backend — módulos (`apps/api/src/`)

`common` (crypto/encrypt AES-256-GCM, utils/lima-time, utils/money [decomposeIgv, round2, weightedAverageCost], config fail-fast, prisma, decorators) · `auth` (JWT, guards secure-by-default, roles OWNER/ADMIN/MANAGER/CASHIER/ACCOUNTANT) · `tenancy` (org/establecimientos/usuarios) · `sunat-config` (creds per-tenant cifradas) · `apisunat` (cliente HTTP + builder UBL + errores) · `invoices` (correlativos + emisión outbox-lite + polling + baja + refreshStatus + **createCreditNote + createDebitNote**) · `catalog` (productos/categorías) · `customers` + `peru-api` (DNI/RUC) · `pos/orders` (venta + IGV + stock + caja + emisión) · `cash` (caja) · `inventory` (almacenes, movimientos, traslados, kardex valorizado, alertas, lotes) · `purchases` (proveedores, compras + costeo promedio) · `gre` (Guía de Remisión DespatchAdvice) · `reports` (dashboard, ventas, P&L, IGV, top productos) · `sire` (RVIE/RCE + PLE TXT) · `payments` (config per-tenant + Niubiz + webhook seguro) · `store` (tienda pública) · `monitor` (**revisión diaria SUNAT** + salud) · `reports` (+ **daily-boletas** resumen diario) · `ai` (**asistente sobre datos** `/ai/ask` + **OCR de compras** `/ai/scan-purchase`; SDK `openai` agnóstico, default **DeepSeek**, key opcional, visión aparte) · `receivables` (**cobranzas**: por cobrar + abonos) · `recurring` (**facturación recurrente** + cron) · `health` (+ helmet + throttler + shutdown).

## 6. Frontend (`apps/web/src/app/`)

- **(admin)** (sidebar + auth guard): `/dashboard`, `/asistente` (**IA**), `/invoices` (comprobantes + NC/ND/anular/PDF/Imprimir/WhatsApp), `/resumen-diario`, `/emision-masiva`, `/cotizaciones`, `/products`, `/clientes`, `/inventory`, `/purchases`, `/escanear-compra` (**OCR IA**), `/caja`, `/cobranzas`, `/recurrente`, `/reports`, `/settings`.
- **Públicas/full-screen:** `/` (landing), `/precios`, `/registro`, `/login`, `/pos` (PWA offline), `/bienvenida`, `/tienda/[orgId]` (storefront + Yape/Plin), `/portal/[orgId]` (**portal del cliente**: consulta comprobantes por documento), `/imprimir/[id]`.
- **UX overhaul (2026-06-20):** sidebar **agrupado por secciones y filtrado por rol** (`lib/nav.ts` + `Sidebar.tsx`; cajero/gerente/contador ven solo lo suyo) con menú hamburguesa móvil (topbar en `(admin)/layout.tsx`); **paleta de comandos ⌘K** (`components/CommandPalette.tsx`, instantánea); **diálogos modales** propios que reemplazan `window.prompt/confirm` (`components/Dialog.tsx` → `useDialog().confirm/prompt`, usado en invoices y cobranzas); **etiquetas en español** (`lib/labels.ts` + StatusBadge → "Aceptado/Rechazado…"); **EmptyState/Skeleton** (`components/ui.tsx`); **tokens de movimiento** (easings custom de Emil Kowalski, `button:active scale(0.97)`, `prefers-reduced-motion`). Principios aplicados de las skills **pbakaus/impeccable**, **Emil Kowalski (emil-design-eng)** y **leonxlnx/taste-skill** (analizadas/clonadas en local; NO instaladas como config del agente por seguridad). Síntesis en `docs/UX-PRINCIPLES.md`.
- **Diseño:** estética **Apple/iOS** en `globals.css` — tema claro (#f5f5f7/#fff), tipografía del sistema (NO serif; `.serif`=sans 600), azul #0071e3, badges iOS, layouts a todo el ancho (regla: **nada de cajas blancas vacías**). framer-motion (FadeIn), lucide-react.
- **Onboarding:** `components/Tour.tsx` (spotlight con sombreado, auto-inicia 1 vez, botón "Ver tutorial") + wizard `/bienvenida` + checklist "Primeros pasos".
- Cliente API: `lib/api.ts` (apiGet/Post/Put/Patch, token de localStorage). Login redirige cuentas nuevas (sin SUNAT ni productos) a `/bienvenida`.

## 7. SUNAT — 5 comprobantes ACEPTADOS (validados en vivo)

Boleta, Factura, **Nota de Crédito**, **Guía de Remisión** (público), **Nota de Débito** — todos ACEPTADOS limpios con CDR + PDF. Hallazgos que costó descubrir (ya aplicados en el builder):
- Emisor: `cac:RegistrationAddress/cbc:ID` = ubigeo (cat 13), `cbc:AddressTypeCode` = código local anexo → corrige obs. 4093/4198.
- Factura/Boleta requieren `cac:PaymentTerms` (FormaPago=Contado) → corrige 3244.
- GRE (3617): `cac:ShipmentStage/cac:LoadingTransportEvent/cbc:OccurrenceDate` (fecha entrega al transportista); CarrierParty = PartyIdentification + PartyLegalEntity/CompanyID(MTC).
- Nota de Débito usa `cac:RequestedMonetaryTotal` (no LegalMonetaryTotal).
- `getById` extrae el motivo del rechazo de `faults[].faultstring._text`.
- **Cuenta dev compartida**: ya usó series F001/T001/FC01/B001 → en el demo usar series frescas (F002, B002, FC02, BD02, T002) para evitar "Numeración repetida". En producción cada tenant tiene su cuenta/series propias.
- **Pendiente SUNAT:** GRE **privado** (mode 02) tiene un TypeError estructural sin resolver (solo público validado).

## 8. Monitoreo SUNAT (diferenciador vs. competencia)

`monitor` module: cron diario (`@Cron EVERY_DAY_AT_8AM`) reconcilia todos los comprobantes PENDING/VOID_PENDING contra SUNAT; `GET /monitor/health` (aceptados/pendientes/rechazados + saludable + problemas), `POST /monitor/reconcile` ("Revisar ahora"). Widget "Salud SUNAT" en el dashboard.

## 9. Producción / despliegue

`/api/health`, helmet (CSP/HSTS), rate limiting (throttler 120/min), graceful shutdown · `apps/api/Dockerfile` + `apps/web/Dockerfile` (Next standalone, **gated por `NEXT_STANDALONE=1`** porque en Windows los symlinks fallan) · `docker-compose.prod.yml` · `.github/workflows/ci.yml` · guía `DEPLOY.md` (incluye checklist para producción real SUNAT: certificado digital, usuario secundario SOL, credenciales GRE, token de producción).

## 10. Gotchas (no perder tiempo redescubriéndolos)

- Docker daemon NO arranca confiable aquí → usar Postgres portable `.pgdev` (puerto 55433).
- Tras cambiar código de la API: `pnpm --filter @facturarkos/api build` y reiniciar `start:prod` (mata el proceso en :3001 y relanza).
- Re-seed cambia el `organizationId` del demo (afecta la URL de la tienda) — re-consultar vía `/auth/me`.
- Capturas de pantalla: Playwright con Edge del sistema (`channel:'msedge'`), scripts en `apps/web/shot*.mjs` y `shots/`.
- El badge "1 Issue" del POS es el overlay de Next dev (no aparece en prod).

## 11. Pendiente (roadmap para igualar/superar competencia)

1. ~~Cotizaciones / Notas de venta~~ ✅ HECHO — módulo `commercial` (CommercialDoc/Item/Series), endpoints `/commercial` (crear/listar/convertir), página `/cotizaciones` (toggle, crear con ítems, convertir a venta). Series C001/NV01.
2. ~~Emisión masiva por Excel~~ ✅ HECHO (2026-06-20) — `OrdersService.bulkSale` + `POST /orders/bulk` (procesa cada documento aislado, upsert de cliente, reusa createSale+emit); página `/emision-masiva` (plantilla .xlsx descargable, parseo cliente con SheetJS por dynamic import, agrupa filas por columna `grupo`, preview + resultados). e2e: 2 boletas ACEPTADAS por SUNAT en lote (B076-1/2).
3. ~~Personalización del formato PDF (logo/pie)~~ ✅ HECHO (2026-06-20) — campos `logoUrl`/`pdfFooter` en Organization, `InvoicesService.getForPrint` + `GET /invoices/:id/print` (trae ítems de la orden o del comprobante referenciado para NC/ND), página imprimible propia `/imprimir/[id]` (A4 con logo+pie, `window.print()`, `@media print`), enlace "Imprimir" en `/invoices`. (El PDF oficial sigue siendo el de APISUNAT, enlace "PDF SUNAT".)
4. ~~Pedidos por **WhatsApp** desde la tienda~~ ✅ HECHO (2026-06-20) — campo `whatsapp` en Organization expuesto en `/store/:orgId/info`; botón "Pedir por WhatsApp" en el storefront que crea el pedido online y abre `wa.me` con el carrito + datos prellenados. Configurable en `/settings`.
5. ~~**Landing + página de precios** pública~~ ✅ HECHO (2026-06-20) — landing en `/` (raíz, antes redirigía): hero, grilla de 9 funciones, "Empieza en 3 pasos", precios y CTA; página dedicada `/precios` con 3 planes (Emprende S/0, **Negocio S/59** destacado, Pro S/119) + FAQ. Componentes `components/Pricing.tsx` (PLANS + PricingCards) y `components/LandingChrome.tsx` (LandingNav detecta token → "Ir al panel", LandingFooter). Estilos `.lp-*` en globals.css. **Registro self-service** `/registro` (conectado a `POST /auth/register` que ya existía; crea org+owner+establecimiento+almacén+unidades, redirige a /bienvenida); todas las CTAs de landing/precios/login apuntan ahí. Capturas: `shots/landing-full.png`, `shots/precios.png`.
6. ~~Resumen diario de boletas~~ ✅ HECHO (2026-06-20) — `ReportsService.dailyBoletas` + `GET /reports/daily-boletas?date=`; página `/resumen-diario` (selector de fecha, KPIs, desglose por estado, tabla, botón "Reportar pendientes" → `POST /monitor/reconcile`). NOTA arquitectónica: las boletas ya se envían individualmente y SUNAT las acepta con CDR, así que el resumen es de **vigilancia/consolidación** (no un comprobante RC UBL — eso queda pendiente si algún tenant quiere modo resumen en vez de envío individual).
7. ~~**Diferenciador IA**~~ ✅ HECHO (2026-06-20) — módulo `ai` **agnóstico de proveedor** vía API compatible con OpenAI (SDK `openai`). Por costo (NO Claude) el default es **DeepSeek** (`AI_BASE_URL=https://api.deepseek.com`, `AI_MODEL=deepseek-chat`); sirve cualquier compatible (MiniMax, OpenRouter, Gemini…). `AI_API_KEY` **opcional** → degradación elegante. (a) **Asistente** `POST /ai/ask`: arma snapshot en vivo del negocio (ventas hoy/mes, comprobantes por estado, pendientes SUNAT, top productos, stock bajo, IGV débito/crédito, clientes) y responde en lenguaje natural; página `/asistente`. (b) **OCR de compras** `POST /ai/scan-purchase`: imagen base64 → modelo con **visión** extrae proveedor+ítems+montos (JSON); página `/escanear-compra`. ⚠️ **DeepSeek NO tiene visión** → el OCR usa config aparte `AI_VISION_*` (recomendado: Gemini Flash / Qwen-VL / MiniMax vía OpenRouter); sin `AI_VISION_MODEL` el OCR queda deshabilitado con aviso. `GET /ai/status` → `{available, visionAvailable}`. **Activar: definir `AI_API_KEY` (y `AI_VISION_*` para OCR) en `apps/api/.env` (ya documentado, comentado) y reiniciar.** (Pendiente opcional: auto-crear la compra desde el borrador OCR; hoy solo extrae/muestra; OCR es imágenes, no PDF, en proveedores genéricos.)
8. ~~**Cobranzas / cuentas por cobrar**~~ ✅ HECHO (2026-06-20) — `Order.dueDate` (venta al crédito vía `CreateSaleDto.dueDate`); módulo `receivables`: `GET /receivables` (saldos, aging vencido/por vencer, datos de contacto) + `POST /receivables/:orderId/payment` (abono parcial, marca PAID al saldar, ingreso a caja si CASH). Página `/cobranzas` (KPIs, tabla, "Cobrar", "Recordar" → wa.me al cliente). e2e ✓.
9. ~~**Pagos Yape/Plin**~~ ✅ HECHO (2026-06-20) — `Organization.yapeNumber/yapeQrUrl/plinNumber/plinQrUrl`; config en `/settings`; expuestos en `/store/:orgId/info`; el storefront muestra QR+número Yape/Plin al confirmar el pedido. (PaymentMethod ya tenía YAPE/PLIN; cobros se registran con esos métodos. QR estático + confirmación manual, sin integración pesada.)
10. ~~**Facturación recurrente**~~ ✅ HECHO (2026-06-20) — modelos `RecurringPlan`/`RecurringPlanItem` (enums RecurFrequency/RecurStatus); módulo `recurring`: CRUD + `POST /recurring/:id/run` + `@Cron(EVERY_DAY_AT_6AM)` que emite los vencidos (reusa OrdersService.createSale+emit, avanza nextRunAt). Página `/recurrente` (crear plan con cliente+ítems+frecuencia, pausar/activar, emitir ahora). e2e: plan → **boleta B054-1 ACEPTADA por SUNAT**.
11. ~~**Comprobante por WhatsApp + portal cliente**~~ ✅ HECHO (2026-06-20) — botón "WhatsApp" en `/invoices` (wa.me con tipo+serie-número+total+link PDF). Portal público `/portal/[orgId]`: el cliente ingresa su DNI/RUC y ve/descarga sus comprobantes (`GET /store/:orgId/comprobantes?doc=`); enlace "Portal cliente" en el sidebar.
12. ~~GRE privado (mode 02)~~ ✅ HECHO (2026-06-21) — eran dos bugs del builder UBL: (a) en transporte **público** se enviaba `cac:TransportEquipment` (placa) → SUNAT 3354; ahora la placa solo va en privado (la declara el transportista en público); (b) en privado faltaban subcampos del `cac:DriverPerson` (FamilyName/JobTitle/IdentityDocumentReference) que el builder de APISUNAT dereferencia → `TypeError reading _text`; y el `cac:LoadingTransportEvent` iba **después** del `DriverPerson` (orden XSD inválido). Reordenado (LoadingTransportEvent antes de DriverPerson) + DriverPerson completo. DTO ampliado (`driverFamilyName`, `driverLicense`). **e2e: GRE público T971-3 y GRE privado T972-3 AMBAS ACEPTADAS por SUNAT.** Página nueva `/guias` (form con modo 01/02 condicional + listado). Smoke: `apps/api/scripts/smoke-gre.mjs`.
13. Endurecimiento producción real: cert digital + cuenta APISUNAT prod por tenant, backups, monitoreo (Sentry), pruebas e2e automatizadas.
14. ~~UI movimientos de inventario y gestión de usuarios~~ ✅ HECHO (2026-06-21): `/usuarios` (lista + crear con rol, admin only, backend `/users`) y `/inventory` con formularios de **movimiento manual** (ADJUST_IN/OUT, INITIAL, RETURN_IN) y **traslado entre almacenes** (backend `/inventory/movements` + `/transfers`). Verificado e2e (201). Pendientes restantes (NO por API key): GRE privado mode 02 (TypeError estructural, bloqueo técnico), **retención/percepción/detracción** (feature nueva grande — **spec de build completo en `docs/IMPLEMENTACION-RETENCION-PERCEPCION-DETRACCION.md`**), auto-crear compra desde OCR (depende de la key de visión), fulfillment de pedidos online, comprobante RC UBL.

15. ~~**Retención / Percepción / Detracción**~~ ✅ CONSTRUIDO (2026-06-21, siguiendo `docs/IMPLEMENTACION-RETENCION-PERCEPCION-DETRACCION.md`):
    - **Detracción (SPOT)** — ✅ **VALIDADO EN VIVO**. Builder de factura extendido (tipo op. cat.51 `1001`, leyenda 2006, `cac:PaymentMeans` cuenta BN + `cac:PaymentTerms` array detracción+forma de pago). `CreateSaleDto.detraction {code,percent,account?}` → `Order.detraction` + campos `Invoice.detraction*` (monto recalculado desde el total, P5). Toggle en POS (solo FACTURA, cat.54 común autocompletando %), cuenta de detracción en `/settings`, leyenda en `/imprimir/[id]`. e2e: **FACTURA F961-2 con detracción 12% ACEPTADA por SUNAT** (S/ 141.60).
    - **Retención (20) + Percepción (40)** — código completo (schema `TaxDocument`/`TaxDocumentRef` + enum `TaxDocKind`, flags de agente en Organization; `tax-doc.builder.ts` con UBL Retention/Perception; módulo `taxdoc` outbox-lite espejo de `createCreditNote`; endpoints `GET/POST /tax-docs(/retencion|/percepcion|/:id/refresh)`; página `/retenciones` con toggle Ret/Perc, lookup RUC, editor de refs, gating por agente). Persistencia y listados verificados e2e. **BLOQUEO EXTERNO**: la cuenta dev APISUNAT (`arkosprueba`) devuelve `TypeError: xmlBuilderFn is not a function` para los tipos 20/40 → APISUNAT no tiene builder para esos tipos en esa cuenta (elige el builder por el `TT` del fileName, no por el documentBody). El registro queda REJECTED con ese mensaje (outbox-lite correcto). Para activar: habilitar comprobante de retención/percepción en la cuenta APISUNAT del tenant **o** calcar el `documentBody` exacto del generador JSON del portal de la empresa (requiere login de APISUNAT del usuario). Smoke: `apps/api/scripts/smoke-taxdocs.mjs`.

16. ~~**Fulfillment de pedidos online**~~ ✅ HECHO (2026-06-21) — enum `FulfillmentStatus` (PENDING/PREPARING/READY/DELIVERED/CANCELLED) + `Order.fulfillmentStatus` y contacto estructurado (`contactName/Phone/Address`); `store.createOnlineOrder` los setea. Backend `GET /orders/online`, `PATCH /orders/:id/fulfillment`. Página `/pedidos` (tablero por estado con tabs, tarjetas con contacto+ítems, avanzar estado, registrar pago vía receivables, emitir boleta, anular, links PDF/imprimir). nav "Pedidos online" (SALES). **e2e: pedido online → tablero → PREPARING→READY→DELIVERED → pago → boleta B001-2 ACEPTADA.** Smoke: `apps/api/scripts/smoke-pedidos.mjs`.
17. **RC SummaryDocuments (resumen diario de boletas)** — DECISIÓN DE PRODUCTO (2026-06-21): **no se construye**. Es un modo de emisión *alternativo*, no una pieza faltante: hoy las boletas se emiten individualmente y SUNAT las acepta con CDR inmediato (verificado). Reportarlas además por RC las duplicaría (rechazo). Construir RC implicaría un "modo resumen" (boletas sin envío individual, reportadas al día siguiente, sin CDR por boleta) que conflictúa con el flujo vigente. Se construirá solo si se quiere ese modo explícitamente. El reporte/consolidado para el contador ya existe en `/resumen-diario`.

## 12. Cómo continuar

El contexto detallado vive en la **memoria del proyecto** (`C:\Users\clanp\.claude\projects\C--Trabajo-Clientes-FacturArkos\memory\`): `facturarkos-overview.md`, `facturarkos-architecture.md`, `facturarkos-codebase.md` (este último es el más detallado y actualizado). En un chat nuevo, leer esos + este HANDOFF.md da el panorama completo para retomar.
