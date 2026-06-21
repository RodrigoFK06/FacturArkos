# FacturArkos — Plan de Desarrollo

**Software a medida: Facturación Electrónica (SUNAT) + POS + Inventario + Tienda Online · Perú · multi-tenant SaaS**

> Fuentes de verdad: `PLAYBOOK_INTEGRACIONES_SAAS.md` (patrones probados de RestHUB) y `docs/requerimientos-sector-facturacion-pos.md` (162 requerimientos).
> Fecha: 2026-06-19 · Versión: 1.0

---

## 1. Resumen ejecutivo

FacturArkos es un SaaS multi-tenant que permite a Mypes peruanas **facturar electrónicamente ante SUNAT, vender (POS), controlar inventario y vender online**, bajo el RUC de cada negocio. El objetivo del primer entregable vendible (MVP) es el **núcleo común a todo rubro retail**: facturación SUNAT conforme + POS + inventario básico + caja, con contingencia offline.

El desarrollo **reutiliza agresivamente** los patrones y código probados de RestHUB (NestJS + Prisma, APISUNAT, cifrado at-rest, webhooks idempotentes). No se reinventa la integración fiscal ni los patrones transversales: se copian y adaptan.

### Decisiones fijadas (locked)

| Decisión | Elección | Origen |
|----------|----------|--------|
| Stack backend | **NestJS 11 + Prisma + PostgreSQL** | Playbook (código reutilizable) |
| Facturación SUNAT | **Vía APISUNAT** (intermediario PAC; firma UBL 2.1 + CDR). No directo a SUNAT | Playbook §3 |
| Frontend / POS | **Web PWA (Next.js/React)** con modo offline (IndexedDB + service worker) | Decisión de producto |
| Cobro de pagos del cliente final | **Por-tenant**: cada negocio conecta su propia pasarela (Niubiz/Izipay/Culqi) | Decisión de producto |
| Facturación del propio SaaS (suscripción) | **Plataforma-global** (separado del cobro per-tenant) | Derivado |
| Multi-tenancy | **Single-DB, aislamiento por `organizationId`** en todo query | Playbook P2 |
| Credenciales SUNAT | **Por-tenant**, tabla `sunat_configs`, secretos cifrados AES-256-GCM | Playbook §2 |
| MVP / vertical | **Core retail/POS general**; add-ons por vertical (restaurante, etc.) después | Decisión de producto |
| Hosting | **Nube gestionada** (Render/Railway) + Postgres gestionado | Default playbook |

### Delta frente al playbook (trabajo extra a tener en cuenta)
El playbook integra pasarelas en modo **global** (la plataforma es el merchant). Aquí los pagos son **por-tenant**, así que se añade una tabla `payment_configs` (espejo de `sunat_configs`, cifrada) y el **routing de webhooks debe resolver el tenant** antes de aplicar el pago. Todos los patrones de seguridad del webhook (fail-closed, lock optimista, match de monto desde BD) se mantienen idénticos.

---

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Backend API | NestJS 11, TypeScript | Arquitectura por módulos del playbook |
| ORM / BD | Prisma + PostgreSQL | Migraciones versionadas |
| Frontend | Next.js (React) + TypeScript, PWA | POS, admin y (fase 6) tienda online |
| Estado offline POS | IndexedDB (Dexie) + Service Worker + cola de sync | Contingencia RNF-002 / FE-018 |
| Facturación | APISUNAT (`back.apisunat.com`) | Per-tenant token cifrado |
| Pagos | Niubiz QR, Izipay, Culqi (per-tenant) | Patrones webhook del playbook §4 |
| Consultas DNI/RUC | apiperu.dev (`PERU_API_TOKEN`) | Playbook §7 auxiliar |
| Cifrado secrets | `aes-256-gcm` (`encrypt.ts` copiado) | Playbook §1 (P1) |
| Auth | JWT + roles/permissions | `organizationId` en el token |
| Impresión | PDF (A4) + ESC/POS térmica 80/58mm | RNF-006 |
| Infra | Render/Railway + Postgres gestionado, CI/CD GitHub Actions | Single-DB multi-tenant |
| Observabilidad | Logs estructurados + Sentry + healthchecks | |

---

## 3. Arquitectura del sistema

### 3.1 Patrón de capas por integración (del playbook §3.1)
Cada integración externa (SUNAT, cada pasarela) sigue 4 capas:
1. **Cliente HTTP "tonto"** — solo llamadas + timeouts + mapeo de errores a tipos de dominio. Sin lógica de negocio. (`apisunat.service.ts`)
2. **Builder puro** — construye el documento (UBL JSON), 100% testeable sin red. (`apisunat.builder.ts`)
3. **Servicio de orquestación** — correlativos, idempotencia, persistencia, polling, estados. (`invoices.service.ts`)
4. **Servicio de config per-tenant** — credenciales cifradas, lectura enmascarada vs `getDecrypted()`. (`sunat-config.service.ts`)

### 3.2 Principios transversales obligatorios (P1–P7, copiar tal cual)
- **P1** Secrets de terceros cifrados at-rest (AES-256-GCM); solo se descifran justo antes de la llamada saliente.
- **P2** Config por-tenant en tablas `*_config` con `organizationId @unique`; `provider` como enum string (nunca acoplar la BD a un solo proveedor).
- **P3** Webhooks fail-closed: secreto compartido + `timingSafeEqual` sobre hashes; sin secreto configurado → rechaza todo.
- **P4** Idempotencia por ID externo + `updateMany` condicional como lock optimista en transacción.
- **P5** Nunca confiar en montos/estados del payload externo; recalcular desde BD.
- **P6** Outbox-lite: persistir `PENDING` antes de la llamada; reconciliar después (polling/cron).
- **P7** Fail-fast ante config faltante; sin fallbacks dummy.

### 3.3 Gotchas fiscales ya documentados (no re-descubrir)
- **IGV 18%** y **descomposición desde el total cobrado**: `igv = round2(total × 18/118)`, `base = total − igv`. Hacerlo al revés descuadra la caja.
- **Fecha fiscal en timezone de Lima (UTC-5)**, calculada explícitamente (`limaDateString()`), jamás `new Date()` del servidor → si no, comprobantes después de las 19:00 salen con fecha del día siguiente y SUNAT rechaza.
- **Correlativos atómicos**: `upsert + increment` sobre `BillingSeries` con `@@unique`, + retry ante P2002. Nunca read-then-write (dos cajas chocan).
- **Notas de crédito/débito**: root `CreditNote`/`DebitNote` + `BillingReference` + `DiscrepancyResponse` al documento original.
- **Factura al crédito**: declarar monto pendiente + una `CuotaNNN` por cuota con `PaymentDueDate`; la suma debe cuadrar (validaciones SUNAT 3244-3247).
- **Anulación async**: estado intermedio `VOID_PENDING` que `refreshStatus` resuelve sin retroceder a ACCEPTED.

### 3.4 Multi-tenancy
- Single-DB; **todo query filtra por `organizationId` extraído del JWT, nunca del body** (playbook).
- `Organization` = tenant (RUC, razón social, timezone='America/Lima', logo, configuración).
- Sucursales/establecimientos como entidad hija (código de establecimiento anexo SUNAT).

---

## 4. Modelo de datos núcleo (Prisma, esquema indicativo)

```
Organization     id, ruc, razonSocial, nombreComercial, direccion, ubigeo,
                 timezone="America/Lima", logoUrl, plan, estado
User             id, organizationId, email, passwordHash, rol, activo
Role/Permission  matriz de permisos por módulo/acción (SEG-001)
Establishment    id, organizationId, codigo(SUNAT), direccion, esPrincipal
SunatConfig      organizationId @unique, provider(APISUNAT|NUBEFACT),
                 personaId(enc), token(enc), testMode
PaymentConfig    id, organizationId, provider(NIUBIZ|IZIPAY|CULQI),
                 creds(enc), testMode, habilitado     // NUEVO vs playbook
BillingSeries    organizationId, establishmentId, tipo(01/03/07/08/09),
                 serie, currentNumber  @@unique([organizationId,tipo,serie])
Product          id, organizationId, codigo, codigoBarras, nombre, categoriaId,
                 marcaId, unidad, codigoSunat, afectacionIgv(gravado/exo/inafecto),
                 controlaStock, esCombo
ProductPrice     productId, listaPrecioId, precio        // múltiples precios
ProductVariant   productId, atributos(talla/color), sku  // variantes
Category / Brand / Unit / PriceList
Warehouse        id, organizationId, nombre
Stock            productId, warehouseId, cantidad
StockMovement    tipo(IN/OUT/TRANSFER/ADJUST), productId, warehouseId, cantidad,
                 costoUnit, loteId?, ref
Lot              productId, codigo, fechaVencimiento
Customer         id, organizationId, tipoDoc(DNI/RUC/CE), numDoc, nombre,
                 direccion  @@unique([organizationId,tipoDoc,numDoc])
Supplier         id, organizationId, ruc, razonSocial
Order            id, organizationId, establishmentId, customerId, cashSessionId,
                 subtotal, descuento, igv, total, estado(OPEN/PENDING_PAYMENT/
                 PAID/CANCELLED), tipoVenta(LOCAL/ONLINE/DELIVERY)
OrderItem        orderId, productId, cantidad, precioUnit, descuento
Invoice          orderId @unique, tipo, serie, numero, estado(PENDING/ACCEPTED/
                 REJECTED/VOIDED/VOID_PENDING), externalId, sunatCode, sunatMessage,
                 issueDate(Lima), xmlUrl, cdrUrl, pdfUrl
Payment          id, orderId, metodo, monto, externalId, gateway  @@unique(externalId)
CashSession      id, organizationId, establishmentId, userId, montoApertura,
                 montoCierre, abiertaEn, cerradaEn, estado
CashMovement     cashSessionId, tipo(INCOME/EXPENSE), monto, concepto
Quotation        ... (cotización → convertible a Order/Invoice)
Purchase         id, organizationId, supplierId, items, total, xmlImportado?
AuditLog         organizationId, userId, accion, entidad, antes/despues, ts
```

---

## 5. Estrategia de reúso desde RestHUB

| Patrón / archivo del playbook | Acción | Esfuerzo |
|-------------------------------|--------|----------|
| `common/crypto/encrypt.ts` (AES-256-GCM) | **Copiar tal cual** | Trivial |
| `sunat-config/*` (config per-tenant + masking) | Copiar y extender | Bajo |
| `apisunat/apisunat.service.ts` (cliente HTTP) | Copiar, revisar endpoints | Bajo |
| `apisunat/apisunat.builder.ts` (UBL builder) | Copiar; extender NC/ND, crédito, GRE | Medio |
| `apisunat/apisunat.errors.ts` (errores tipados) | Copiar | Trivial |
| `invoices/invoices.service.ts` (orquestación) | Copiar; adaptar al modelo retail (Order genérico) | Medio |
| `common/utils/lima-time.ts` (timezone) | Copiar tal cual | Trivial |
| `niubiz/*`, `izipay/*` (pasarelas) | Copiar patrón; **adaptar a per-tenant** (creds desde `payment_configs`) | Medio-Alto |
| Patrones de webhook (5 validaciones + lock optimista) | Copiar tal cual | Bajo |
| Credenciales dev (APISUNAT "arkosprueba", Niubiz sandbox) | Reusar para desarrollo | — |

> **Nota:** las credenciales dev de APISUNAT del playbook (`arkosprueba`, token `DEV_…`) sirven para construir y probar la Fase 1 sin afiliación real.

---

## 6. Roadmap por fases

> Cada fase lista los **IDs de requerimiento** que cubre (ver catálogo). Esfuerzo indicativo para equipo pequeño (2–3 devs); se comprime por reúso de RestHUB.

### Fase 0 — Fundaciones (Sprint 0) · ~2–3 sem
**Objetivo:** esqueleto multi-tenant seguro y desplegable.
- Monorepo (pnpm/Turborepo): `api` (Nest) + `web` (Next) + `packages/shared`.
- Prisma + Postgres; config con **fail-fast (P7)**; `SECRETS_ENCRYPTION_KEY` en secret manager.
- Copiar `encrypt.ts` (**P1**). Helper `lima-time.ts`.
- Auth JWT, `Organization`, `User`, scoping por `organizationId`, roles/permisos base.
- CI/CD, deploy a nube gestionada, healthchecks, logging + Sentry.
- Convenciones de capas (cliente HTTP / builder / orquestación / config).
- **Cubre:** ORG-004, ORG-006, SEG-001, SEG-003, SEG-004, RNF-001, P1/P2/P7.

### Fase 1 — Núcleo Facturación Electrónica SUNAT · ~5–7 sem 🟢 **(hito crítico / barrera de entrada)**
**1A — Emisión mínima vendible (~3–4 sem):**
- `SunatConfig` per-tenant cifrado + UI admin enmascarada (**P2**).
- Cliente APISUNAT + builder UBL **Factura (01)** y **Boleta (03)**.
- `BillingSeries` con correlativos atómicos (**P4**).
- Orquestación `emitInvoice`: outbox-lite PENDING → `sendBill` → polling `waitForFinal` (backoff) → mapeo de estados; idempotencia 1:1 con `Order`.
- IGV 18% + descomposición desde total + `round2`; fecha Lima.
- Representación impresa **A4** y **ticket 80/58mm** con **QR + hash**.
- Validación de RUC; catálogos SUNAT; envío por **correo** del XML+CDR+PDF.
- **Cubre:** FE-001, FE-002, FE-011, FE-012, FE-013, FE-014, FE-015, FE-020, FE-021, FE-022, FE-023, FE-024, FE-025, FE-028, FE-030, FE-032, FE-034, FE-035, INT-005, RNF-006, RNF-014.

**1B — Documentos complementarios (~2–3 sem):**
- **Notas de Crédito (07) y Débito (08)** con `BillingReference`.
- **Resumen diario de boletas**; **comunicación de baja** con `VOID_PENDING`.
- **Factura a crédito / cuotas** (cronograma, validaciones 3244-3247).
- `refreshStatus` (reconciliación) endpoint + cron.
- **Cubre:** FE-003, FE-004, FE-016, FE-017, FE-019, FE-029, FE-033, FE-036.

### Fase 2 — POS + Caja + Clientes · ~4–6 sem 🟢
**Objetivo:** vender en mostrador y emitir desde la venta, con contingencia offline.
- Catálogo mínimo de productos + precios múltiples + búsqueda + código de barras.
- Flujo de venta POS: ítems, descuentos, medios de pago (registro), pago mixto, vuelto.
- Registro de cliente por **DNI/RUC/CE** con consulta automática (apiperu.dev).
- Emitir comprobante desde la venta (integra Fase 1).
- **Caja:** apertura/cierre/arqueo, control por cajero, ingresos/gastos, cierre Z.
- Ventas suspendidas, devoluciones, notas de venta, cotizaciones.
- **PWA offline (RNF-002):** cola local (IndexedDB) + sync; habilita **emisión en contingencia (FE-018)** reusando el patrón outbox-lite.
- **Cubre:** POS-001,002,003,005,006,007,008,009,010,013,015,017,018,021; CAJ-001..005,010; CLI-001,002; INT-002; FE-018; RNF-002.

### Fase 3 — Inventario + Compras + GRE · ~4–5 sem 🔵
- Stock en tiempo real; ingresos/salidas/ajustes; alertas de stock mínimo.
- Multi-almacén + traslados; **kardex valorizado** (PEPS/promedio); costos/márgenes.
- Combos, variantes, lotes/vencimiento + alertas de caducidad.
- Carga masiva (Excel), unidades/conversión, imágenes.
- Compras: proveedores, órdenes, registro de compras, recepción (actualiza stock), **import XML para RCE**.
- **Guía de Remisión Electrónica Remitente (GRE-R)** y Transportista (GRE-T) ligadas a traslados/despacho.
- **Cubre:** INV-001..021; COM-001..006; FE-005, FE-006; REP-003.

### Fase 4 — Reportes + SIRE/PLE + Contabilidad · ~3–4 sem 🔵
- Reportes de ventas/compras/caja, ganancias y pérdidas, productos más vendidos.
- **SIRE — RVIE y RCE**; **export PLE** (TXT); resumen/liquidación de IGV.
- Dashboard de KPIs; exportación Excel/PDF; reporte para el contador.
- Comprobantes de **Retención / Percepción / Detracción / Liquidación de compra** (para clientes que son agentes).
- **Cubre:** REP-001,002,004,005,006,007,008,009,010,011,013; INV-014,015; FE-007,008,009,010.

### Fase 5 — Pagos integrados + WhatsApp + Fidelización · ~3–4 sem 🔵⭐
- **Pasarelas per-tenant**: `PaymentConfig` cifrado por org; integrar **Niubiz QR** (webhook + polling), **Izipay/Culqi** (tokenizado). Routing de webhook que **resuelve el tenant**, fail-closed, lock optimista, match de monto desde BD.
- **Envío de comprobantes por WhatsApp**.
- Fidelización/puntos, gift cards, promociones/combos.
- Multi-empresa / multi-sucursal / multi-PV (UI completa).
- API REST pública + webhooks salientes.
- **Cubre:** INT-003,004,009; POS-011,012,014; CLI-006; ORG-001,002,003,005; INT-001.

### Fase 6 — Tienda Online · ~4–6 sem ⭐
- Catálogo, carrito, checkout con emisión de comprobante, sincronización con POS/inventario en tiempo real.
- Seguimiento de pedidos, chat (Messenger/WhatsApp), dominio propio + correos, pagos online, delivery (zonas/costos), panel administrable, SEO + responsive.
- **Cubre:** TO-001..013; INT-008,010.

### Transversal (todas las fases)
SEG-002 (auditoría), SEG-005 (2FA), SEG-007 (sesiones), RNF-003 (rendimiento), RNF-004 (escalabilidad), RNF-008 (actualización normativa), RNF-009 (soporte), RNF-011 (migración), RNF-012 (usabilidad), RNF-013 (Ley 29733), RNF-015 (sync nube), RNF-016 (onboarding), RNF-017 (suscripción del SaaS, billing plataforma-global).

---

## 7. Línea de tiempo indicativa

| Hito | Fases | Acumulado (equipo 2–3 devs) |
|------|-------|------------------------------|
| **MVP facturable** (emite y cobra en mostrador, offline) | 0 + 1 + 2 | **~3–3.5 meses** |
| **Producto de gestión** (inventario, compras, reportes/SIRE) | + 3 + 4 | ~5–6 meses |
| **Producto competitivo full** (pagos, fidelización, multi-sucursal) | + 5 | ~6.5–7 meses |
| **Plataforma completa** (tienda online) | + 6 | ~7.5–9 meses |

> Rangos indicativos; dependen del tamaño del equipo y de cuánto código de RestHUB se reusa sin fricción. La Fase 1 es la de mayor riesgo y la más comprimible por reúso.

---

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Cambios normativos SUNAT (SIRE, GRE, validaciones) | Alto | APISUNAT absorbe gran parte; capa de catálogos/validación aislada; RNF-008 |
| Pagos per-tenant (delta vs playbook) más complejos | Medio | Tabla `payment_configs` espejo de `sunat_configs`; routing de webhook por tenant probado con tests de concurrencia |
| Offline/contingencia POS (sync, conflictos) | Medio-Alto | Outbox-lite + idempotencia (P4/P6); IDs cliente para dedupe; pruebas de reconexión |
| Correlativos con huecos/duplicados | Alto (rechazo SUNAT) | `upsert+increment` atómico + retry P2002 (patrón probado) |
| Descuadre caja vs comprobante por redondeo | Alto | `round2` desde el total cobrado (gotcha documentado) |
| Dependencia de APISUNAT (caída del proveedor) | Medio | Cola con reintentos (P6); estado PENDING + reconciliación; monitoreo |
| Multi-tenant data leakage | Crítico | `organizationId` del JWT en todo query; tests de aislamiento; revisión de seguridad |
| Fuga de secretos/certificado | Crítico | AES-256-GCM at-rest (P1); masking en UI; solo `getDecrypted()` en el service |

---

## 9. Calidad y Definición de Hecho (DoD)

- Builders UBL con **tests unitarios puros** (sin red) por tipo de documento.
- Tests de **idempotencia y concurrencia** para correlativos y webhooks (lock optimista).
- Tests de **aislamiento multi-tenant** (un tenant no ve datos de otro).
- Validación contra **APISUNAT en modo dev** antes de cada release de Fase 1.
- Secretos nunca en texto plano ni en logs; secretos enmascarados en UI.
- Migraciones Prisma versionadas y reversibles; backups automáticos verificados.
- Cada requerimiento con **criterio de aceptación** trazable a su ID.

---

## 10. Próximos pasos inmediatos

1. **Confirmar el plan** y el alcance exacto del MVP (Fases 0–2).
2. **Fase 0**: crear monorepo, scaffolding Nest+Prisma+Next, copiar `encrypt.ts` y `lima-time.ts`, modelo `Organization/User` + auth.
3. **Desglosar Fase 0 y 1A** en backlog de historias de usuario con criterios de aceptación.
4. Conseguir/validar credenciales: APISUNAT dev (ya disponibles), `SECRETS_ENCRYPTION_KEY`, `PERU_API_TOKEN`.
5. Definir diseño UX del POS (flujo de venta + cobro) — el componente de mayor uso diario.
