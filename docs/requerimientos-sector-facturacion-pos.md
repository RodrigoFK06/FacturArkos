# FacturArkos — Catálogo de Requerimientos del Sector

**Facturación Electrónica + Punto de Venta + Inventario + Tienda Online (Perú)**

> Base: análisis del aviso comercial de *Facel POS* (competidor) + ampliación con los requisitos reales del sector y la normativa SUNAT vigente.
> Fecha: 2026-06-19 · Versión: 1.0 · Total: **162 requerimientos**

---

## Leyenda de prioridad

| Marca | Significado |
|-------|-------------|
| ⚖️ | **Obligatorio por normativa SUNAT** (regulatorio, no negociable) |
| 🟢 | **MVP / Imprescindible** (núcleo para vender el producto) |
| 🔵 | **Importante** (segunda ola, alta demanda del mercado) |
| ⭐ | **Diferenciador** (valor agregado / ventaja competitiva) |

> Origen: las filas marcadas con **(Facel)** aparecen explícita o implícitamente en el aviso analizado; el resto son requerimientos del sector que un sistema competitivo debe cubrir.

---

## 1. Facturación Electrónica y Cumplimiento SUNAT (FE)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-FE-001 | Emisión de **Factura** electrónica **(Facel)** | ⚖️🟢 |
| RF-FE-002 | Emisión de **Boleta de Venta** electrónica **(Facel)** | ⚖️🟢 |
| RF-FE-003 | Emisión de **Nota de Crédito** electrónica **(Facel)** | ⚖️🟢 |
| RF-FE-004 | Emisión de **Nota de Débito** electrónica **(Facel)** | ⚖️🟢 |
| RF-FE-005 | **Guía de Remisión Electrónica – Remitente (GRE-R)** **(Facel)** | ⚖️🟢 |
| RF-FE-006 | **Guía de Remisión Electrónica – Transportista (GRE-T)** | ⚖️🔵 |
| RF-FE-007 | **Comprobante de Retención** electrónico **(Facel)** | ⚖️🔵 |
| RF-FE-008 | **Comprobante de Percepción** electrónico **(Facel)** | ⚖️🔵 |
| RF-FE-009 | Manejo de **Detracciones (SPOT)**: % automático por bien/servicio y constancia de depósito **(Facel)** | ⚖️🔵 |
| RF-FE-010 | **Liquidación de compra** electrónica | ⚖️🔵 |
| RF-FE-011 | Generación de **XML en formato UBL 2.1** | ⚖️🟢 |
| RF-FE-012 | **Firma digital** del comprobante con certificado (PFX/PEM) | ⚖️🟢 |
| RF-FE-013 | Gestión y resguardo del **certificado digital** (vencimiento, alertas, renovación) | ⚖️🟢 |
| RF-FE-014 | Envío automático a **SUNAT / OSE** y obtención del **CDR** (Constancia de Recepción) | ⚖️🟢 |
| RF-FE-015 | **Cola de envío con reintentos** ante caída de SUNAT/internet | ⚖️🟢 |
| RF-FE-016 | **Resumen diario de boletas** y notas asociadas | ⚖️🟢 |
| RF-FE-017 | **Comunicación de baja / anulación** de comprobantes | ⚖️🟢 |
| RF-FE-018 | **Emisión en contingencia** (offline) y posterior regularización | ⚖️🟢 |
| RF-FE-019 | **Reversiones** de retenciones/percepciones **(Facel)** | ⚖️🔵 |
| RF-FE-020 | **Representación impresa A4** (PDF) | ⚖️🟢 |
| RF-FE-021 | **Representación impresa en ticket** 80 mm / 58 mm | ⚖️🟢 |
| RF-FE-022 | **Código QR + hash** en la representación impresa | ⚖️🟢 |
| RF-FE-023 | Manejo de **series y correlativos** por tipo de documento y establecimiento | ⚖️🟢 |
| RF-FE-024 | Tipos de operación: **gravada, exonerada, inafecta, exportación, gratuita** **(Facel)** | ⚖️🟢 |
| RF-FE-025 | Cálculo de **IGV (18%)** configurable | ⚖️🟢 |
| RF-FE-026 | **ICBPER** (impuesto a las bolsas plásticas) | ⚖️🔵 |
| RF-FE-027 | **ISC** (impuesto selectivo al consumo) cuando aplique | ⚖️🔵 |
| RF-FE-028 | Operaciones en **moneda extranjera** y **tipo de cambio** (manual y automático SUNAT/SBS) | ⚖️🟢 |
| RF-FE-029 | **Facturas a crédito y por cuotas** con cronograma de pagos **(Facel)** | ⚖️🟢 |
| RF-FE-030 | **Catálogos SUNAT** integrados (tipo de doc, unidad de medida, moneda, tributo, etc.) | ⚖️🟢 |
| RF-FE-031 | **Código de producto SUNAT / GS1 / UNSPSC** por ítem | ⚖️🔵 |
| RF-FE-032 | **Validación de RUC** y estado/condición del contribuyente | ⚖️🟢 |
| RF-FE-033 | **Consulta de validez del CPE** emitido en SUNAT | ⚖️🔵 |
| RF-FE-034 | **Reenvío y descarga** de XML y CDR (al cliente y a SUNAT) | ⚖️🟢 |
| RF-FE-035 | Soporte de modos de emisión: **SEE Del Contribuyente** y vía **OSE/PSE** | ⚖️🔵 |
| RF-FE-036 | Detección y bloqueo de emisión a **RUC no habido / de baja** | ⚖️🔵 |

## 2. Punto de Venta (POS)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-POS-001 | Lectura de **código de barras** **(Facel)** | 🟢 |
| RF-POS-002 | **Búsqueda rápida** de productos (código, nombre, categoría) | 🟢 |
| RF-POS-003 | **Múltiples precios** por producto **(Facel)** | 🟢 |
| RF-POS-004 | Productos **por peso** (integración con balanza) | 🔵 |
| RF-POS-005 | **Múltiples tipos de pago**: efectivo, tarjeta, depósito, Yape, Plin, transferencia **(Facel)** | 🟢 |
| RF-POS-006 | **Pago mixto** (varios medios en una misma venta) | 🟢 |
| RF-POS-007 | **Cálculo de vuelto** | 🟢 |
| RF-POS-008 | **Tipos de venta**: en local, tienda online, delivery **(Facel)** | 🟢 |
| RF-POS-009 | **Ventas suspendidas / en espera** **(Facel)** | 🟢 |
| RF-POS-010 | **Devoluciones** y cambios **(Facel)** | 🟢 |
| RF-POS-011 | **Vales de regalo / gift cards** **(Facel)** | ⭐ |
| RF-POS-012 | **Acumulación y canje de puntos** (fidelización) **(Facel)** | ⭐ |
| RF-POS-013 | **Descuentos** por ítem y global (monto y %) | 🟢 |
| RF-POS-014 | **Promociones**: 2x1, combos, por volumen **(Facel)** | 🔵 |
| RF-POS-015 | **Cotizaciones / proformas** **(Facel)** | 🟢 |
| RF-POS-016 | **Órdenes de compra / pedidos** del cliente **(Facel)** | 🔵 |
| RF-POS-017 | **Notas de venta** (documento interno no tributario) **(Facel)** | 🟢 |
| RF-POS-018 | **Registro de cliente desde el POS** digitando DNI / RUC / CE con consulta automática **(Facel)** | 🟢 |
| RF-POS-019 | Interfaz **táctil (touch)** optimizada | 🔵 |
| RF-POS-020 | **Atajos de teclado** para venta ágil | 🔵 |
| RF-POS-021 | **Conversión** de cotización/pedido a comprobante | 🟢 |
| RF-POS-022 | **Comandas / pedidos a cocina** (rubro restaurante) | ⭐ |
| RF-POS-023 | Gestión de **mesas / salones** (rubro restaurante) | ⭐ |
| RF-POS-024 | **Venta delivery** con datos de entrega y repartidor **(Facel)** | 🔵 |

## 3. Caja y Finanzas (CAJ)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-CAJ-001 | **Apertura de caja** con monto inicial | 🟢 |
| RF-CAJ-002 | **Cierre de caja y arqueo** (cuadre) | 🟢 |
| RF-CAJ-003 | **Control y supervisión de cajas y/o cajeros** **(Facel)** | 🟢 |
| RF-CAJ-004 | Registro de **gastos / egresos** **(Facel)** | 🟢 |
| RF-CAJ-005 | Registro de **ingresos** extraordinarios **(Facel)** | 🟢 |
| RF-CAJ-006 | **Cuentas por cobrar** (créditos a clientes) | 🔵 |
| RF-CAJ-007 | **Cuentas por pagar** (a proveedores) | 🔵 |
| RF-CAJ-008 | Registro de **cobros / abonos** de créditos | 🔵 |
| RF-CAJ-009 | **Flujo de caja** y movimientos por periodo | 🔵 |
| RF-CAJ-010 | **Cierre Z / reporte de cierre** de turno | 🟢 |
| RF-CAJ-011 | Manejo de **propinas y redondeos** | ⭐ |

## 4. Control de Inventario y Almacén (INV)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-INV-001 | **Control de stock** en tiempo real **(Facel)** | 🟢 |
| RF-INV-002 | **Multi-almacén** | 🔵 |
| RF-INV-003 | **Ingresos** de almacén **(Facel)** | 🟢 |
| RF-INV-004 | **Salidas** de almacén **(Facel)** | 🟢 |
| RF-INV-005 | **Traslados** entre almacenes **(Facel)** | 🔵 |
| RF-INV-006 | **Ajustes** de almacén **(Facel)** | 🟢 |
| RF-INV-007 | **Toma de inventario físico** | 🔵 |
| RF-INV-008 | **Kardex valorizado** (PEPS / promedio) **(Facel)** | ⚖️🔵 |
| RF-INV-009 | **Combos / paquetes (kits)** **(Facel)** | 🔵 |
| RF-INV-010 | **Variantes** (talla, color, etc.) **(Facel)** | 🔵 |
| RF-INV-011 | **Lotes y fechas de vencimiento** | 🔵 |
| RF-INV-012 | **Alertas de stock mínimo** **(Facel)** | 🟢 |
| RF-INV-013 | **Alertas de caducidad / vencimiento** de producto **(Facel)** | 🔵 |
| RF-INV-014 | Reporte de **productos más vendidos** **(Facel)** | 🟢 |
| RF-INV-015 | Reporte de **ganancias y pérdidas** por producto **(Facel)** | 🔵 |
| RF-INV-016 | Gestión de **categorías, marcas y unidades** | 🟢 |
| RF-INV-017 | **Costos** (último/promedio) y **márgenes** | 🔵 |
| RF-INV-018 | **Múltiples unidades de medida** y factores de conversión | 🔵 |
| RF-INV-019 | **Series / IMEI** por producto (rubro electrónica) | ⭐ |
| RF-INV-020 | **Carga masiva de productos** por Excel/CSV | 🔵 |
| RF-INV-021 | Gestión de **imágenes** y fichas de producto | 🔵 |

## 5. Compras y Proveedores (COM)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-COM-001 | **Registro de proveedores** | 🟢 |
| RF-COM-002 | **Órdenes de compra** | 🔵 |
| RF-COM-003 | **Registro de compras** (facturas de proveedor) **(Facel)** | 🟢 |
| RF-COM-004 | **Recepción de mercadería** (actualiza stock automáticamente) | 🔵 |
| RF-COM-005 | **Importación de XML** de compras para el RCE | ⚖️🔵 |
| RF-COM-006 | Manejo de **detracciones/retenciones en compras** | 🔵 |
| RF-COM-007 | Comparativo de **precios por proveedor** | ⭐ |

## 6. Clientes (CLI / CRM)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-CLI-001 | **Registro y ficha** de clientes **(Facel)** | 🟢 |
| RF-CLI-002 | **Consulta automática** DNI (RENIEC) y RUC (SUNAT) al digitar **(Facel)** | 🟢 |
| RF-CLI-003 | **Historial de compras** por cliente | 🔵 |
| RF-CLI-004 | **Segmentación / categorías** de cliente | 🔵 |
| RF-CLI-005 | **Estado de cuenta** del cliente (deuda/crédito) | 🔵 |
| RF-CLI-006 | **Programa de fidelización / puntos** por cliente **(Facel)** | ⭐ |
| RF-CLI-007 | **Lista negra / bloqueo** de clientes morosos | ⭐ |

## 7. Tienda Online / E-commerce (TO)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-TO-001 | **Catálogo de productos** en línea **(Facel)** | ⭐ |
| RF-TO-002 | **Carrito de compras** **(Facel)** | ⭐ |
| RF-TO-003 | **Checkout** con emisión de comprobante electrónico | ⭐ |
| RF-TO-004 | **Interacción con el punto de venta** (mismo stock/precios) **(Facel)** | ⭐ |
| RF-TO-005 | **Sincronización con inventario** en tiempo real | ⭐ |
| RF-TO-006 | **Seguimiento de pedidos** **(Facel)** | ⭐ |
| RF-TO-007 | **Chat Messenger y WhatsApp** integrado **(Facel)** | ⭐ |
| RF-TO-008 | **Dominio propio (.com)** **(Facel)** | ⭐ |
| RF-TO-009 | **Correos corporativos** **(Facel)** | ⭐ |
| RF-TO-010 | **Tipos de pago online** (pasarela) **(Facel)** | ⭐ |
| RF-TO-011 | **Panel totalmente administrable** **(Facel)** | ⭐ |
| RF-TO-012 | **Gestión de delivery** (zonas y costos de envío) | ⭐ |
| RF-TO-013 | **SEO básico** y diseño **responsive** | ⭐ |

## 8. Reportes y Contabilidad (REP)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-REP-001 | **Reportes de ventas** (periodo, producto, cliente, vendedor, sucursal) **(Facel)** | 🟢 |
| RF-REP-002 | **Reportes de compras** **(Facel)** | 🟢 |
| RF-REP-003 | **Kardex / reportes de inventario** **(Facel)** | 🔵 |
| RF-REP-004 | **Reportes de caja** | 🟢 |
| RF-REP-005 | Reporte de **ganancias y pérdidas** | 🔵 |
| RF-REP-006 | **SIRE – RVIE** (Registro de Ventas e Ingresos Electrónico) **(Facel)** | ⚖️🔵 |
| RF-REP-007 | **SIRE – RCE** (Registro de Compras Electrónico) **(Facel)** | ⚖️🔵 |
| RF-REP-008 | **Exportación PLE** (libros electrónicos, formato TXT) | ⚖️🔵 |
| RF-REP-009 | **Dashboard / tablero gerencial** con KPIs | 🔵 |
| RF-REP-010 | **Exportación a Excel / PDF** | 🟢 |
| RF-REP-011 | **Resumen tributario / liquidación de IGV** | 🔵 |
| RF-REP-012 | **Reportes programados** / envío por correo | ⭐ |
| RF-REP-013 | **Reporte contable** exportable al contador **(Facel)** | 🔵 |

## 9. Integraciones (INT)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-INT-001 | **API REST** documentada para integraciones externas | 🔵 |
| RF-INT-002 | Integración **RENIEC / SUNAT** (consulta DNI/RUC) | 🟢 |
| RF-INT-003 | **Pasarelas de pago** (Culqi, Izipay, Niubiz, Mercado Pago) | 🔵 |
| RF-INT-004 | **Envío de comprobantes por WhatsApp** **(Facel)** | 🟢 |
| RF-INT-005 | **Envío de comprobantes por correo** **(Facel)** | 🟢 |
| RF-INT-006 | Integración con **software contable** (Concar u otros) | 🔵 |
| RF-INT-007 | Integración con **balanzas, lectores y cajón monedero** | 🔵 |
| RF-INT-008 | Integración con **marketplaces** (opcional) | ⭐ |
| RF-INT-009 | **Webhooks / notificaciones** a sistemas externos | ⭐ |
| RF-INT-010 | Conexión con **apps de delivery** (opcional) | ⭐ |

## 10. Organización: Multi-empresa / Multi-sucursal / Multi-usuario (ORG)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-ORG-001 | **Multi-empresa** (varios RUC en una sola cuenta) | 🔵 |
| RF-ORG-002 | **Multi-sucursal / establecimientos anexos** | 🔵 |
| RF-ORG-003 | **Multi-almacén** por sucursal | 🔵 |
| RF-ORG-004 | **Multi-usuario** con roles y permisos | 🟢 |
| RF-ORG-005 | **Múltiples puntos de venta** por sucursal | 🔵 |
| RF-ORG-006 | **Configuración por empresa** (logo, datos, series, plantillas) | 🟢 |

## 11. Seguridad y Administración (SEG)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RF-SEG-001 | **Roles y permisos granulares** por módulo/acción | 🟢 |
| RF-SEG-002 | **Auditoría / bitácora** de acciones de usuario | 🔵 |
| RF-SEG-003 | **Respaldo y restauración** de datos (backup) | 🟢 |
| RF-SEG-004 | **Cifrado** de datos sensibles y del certificado digital | 🟢 |
| RF-SEG-005 | **Autenticación segura / 2FA** | 🔵 |
| RF-SEG-006 | Control de acceso por **IP / dispositivo** (opcional) | ⭐ |
| RF-SEG-007 | **Gestión de sesiones** y cierre por inactividad | 🔵 |

## 12. Requerimientos No Funcionales (RNF)

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| RNF-001 | **Alta disponibilidad / uptime** con SLA definido | 🟢 |
| RNF-002 | **Operación offline / contingencia** ante caída de SUNAT o internet | 🟢 |
| RNF-003 | **Rendimiento**: emisión y POS ágiles (respuesta < 2–3 s) | 🟢 |
| RNF-004 | **Escalabilidad** (multi-empresa, alto volumen de comprobantes) | 🔵 |
| RNF-005 | **Multiplataforma**: web, escritorio Windows, móvil/tablet | 🔵 |
| RNF-006 | Compatibilidad con **impresoras térmicas (80/58 mm) y A4** | 🟢 |
| RNF-007 | Compatibilidad con **hardware POS** (cajón, lector, balanza) | 🔵 |
| RNF-008 | **Actualización automática** ante cambios normativos SUNAT | 🟢 |
| RNF-009 | **Soporte 24/7** y canal de atención con profesionales **(Facel)** | 🟢 |
| RNF-010 | **Instalación y activación rápida** (< 1 hora) **(Facel)** | 🔵 |
| RNF-011 | **Migración de datos** desde otros sistemas | 🔵 |
| RNF-012 | **Usabilidad**: interfaz simple, curva de aprendizaje baja **(Facel)** | 🟢 |
| RNF-013 | Cumplimiento de **protección de datos personales (Ley N° 29733)** | 🔵 |
| RNF-014 | **Conservación y trazabilidad** de comprobantes por el plazo legal | ⚖️🟢 |
| RNF-015 | **Sincronización en la nube** y uso multi-dispositivo | 🔵 |
| RNF-016 | **Capacitación / onboarding** al cliente **(Facel)** | 🔵 |
| RNF-017 | **Planes y facturación recurrente** del propio SaaS (suscripciones) | 🔵 |

---

## Resumen por módulo

| # | Módulo | Requerimientos |
|---|--------|----------------|
| 1 | Facturación Electrónica / SUNAT (FE) | 36 |
| 2 | Punto de Venta (POS) | 24 |
| 3 | Caja y Finanzas (CAJ) | 11 |
| 4 | Inventario y Almacén (INV) | 21 |
| 5 | Compras y Proveedores (COM) | 7 |
| 6 | Clientes / CRM (CLI) | 7 |
| 7 | Tienda Online (TO) | 13 |
| 8 | Reportes y Contabilidad (REP) | 13 |
| 9 | Integraciones (INT) | 10 |
| 10 | Organización multi-tenant (ORG) | 6 |
| 11 | Seguridad (SEG) | 7 |
| 12 | No Funcionales (RNF) | 17 |
| | **TOTAL** | **162** |

---

## Notas estratégicas

- **El núcleo regulatorio (⚖️) es la barrera de entrada.** Sin FE-001 a FE-024 conformes a SUNAT, el producto no es vendible. Es el primer hito.
- **SIRE (RVIE/RCE) y PLE** ya son obligación corriente para la mayoría de contribuyentes: priorizar REP-006/007/008 eleva el producto de "facturador" a "sistema de gestión".
- **GRE electrónica** (FE-005/006) es obligatoria para traslados; muchos competidores la tienen débil → oportunidad.
- **Contingencia real (RNF-002)** es el mayor dolor del sector: vender "sigues facturando aunque SUNAT se caiga" es un diferenciador fuerte.
- Frente a Facel, los **diferenciadores ⭐** (tienda online integrada, fidelización, restaurante) definen el segmento objetivo. Conviene decidir vertical(es) prioritario(s): bodega/retail, restaurante, servicios, distribución.
