# Implementación — Retención · Percepción · Detracción (SUNAT)

> Guía de build dedicada. **No necesita ninguna API key nueva** (usa la cuenta APISUNAT
> dev ya configurada para validar, igual que boleta/factura/NC/ND).
> Sigue el patrón ya probado en `InvoicesService.createCreditNote` y el builder UBL existente.
>
> **Regla de oro (de la experiencia previa con SUNAT):** los nodos UBL exactos son lo único
> riesgoso. Antes de codificar cada documento, generar el `documentBody` de referencia con el
> **generador JSON de APISUNAT** (portal de la empresa, ícono `{ }`) para el tipo de documento, y
> calcar esa estructura. No inventar nombres de nodo. Validar en vivo emitiendo a la cuenta dev
> con **serie fresca** (la cuenta `arkosprueba` ya usó varias; usar p.ej. R001/P001 nuevas).

## 0. Contexto: qué es cada uno (y cómo se modela distinto)

| Concepto | Qué es | Forma técnica |
|---|---|---|
| **Retención** | El **agente de retención** (comprador designado por SUNAT) retiene un % (rég. general **3%**) al pagar a su proveedor en operaciones > S/ 700. Emite un **Comprobante de Retención (CRE)**. | **Documento UBL nuevo** `Retention` (cat. 01 → tipo **20**), serie **R###**. Referencia los comprobantes pagados. |
| **Percepción** | El **agente de percepción** (vendedor designado) cobra un % extra al cliente (rég. general **2%**). Emite un **Comprobante de Percepción (PRE)**. | **Documento UBL nuevo** `Perception` (cat. 01 → tipo **40**), serie **P###**. Referencia las facturas/boletas percibidas. |
| **Detracción (SPOT)** | **No es un comprobante aparte.** Es un régimen donde el comprador deposita un % en la cuenta de Banco de la Nación del proveedor. Se declara **dentro de la factura**. | **Modificación al builder de FACTURA**: tipo de operación cat.51 → `1001`, nodos `PaymentMeans`/`PaymentTerms` de detracción + código de bien/servicio cat.54. |

Por eso el build tiene **dos frentes**: (A) Retención + Percepción = documentos nuevos; (B) Detracción = extender factura existente.

---

## FASE 1 — Esquema (Prisma)

Archivo: `apps/api/prisma/schema.prisma`

### 1.1 Enum `DocumentType`
```prisma
enum DocumentType {
  FACTURA        // 01
  BOLETA         // 03
  NOTA_CREDITO   // 07
  NOTA_DEBITO    // 08
  GUIA_REMISION  // 09
  RETENCION      // 20  ← nuevo
  PERCEPCION     // 40  ← nuevo
}
```

### 1.2 Organización — datos del agente y cuenta de detracción
```prisma
model Organization {
  // ...existentes...
  // Régimen de retención/percepción (solo si el negocio es agente designado)
  retentionAgent    Boolean @default(false)
  retentionRegime   String? // cat. 23: "01" tasa 3%
  perceptionAgent   Boolean @default(false)
  perceptionRegime  String? // cat. 22/percepción: "01" 2% general, "02" 1%, "03" venta interna
  // Detracción
  detractionAccount String? // cuenta del Banco de la Nación (para emitir como proveedor)
}
```

### 1.3 Modelo `TaxDocument` (retención y percepción) — separado de `Invoice`
`Invoice` es 1:1 con `Order`; CRE/PRE no son ventas, referencian varios comprobantes. Crear modelo propio:
```prisma
enum TaxDocKind { RETENCION PERCEPCION }

model TaxDocument {
  id             String        @id @default(cuid())
  organizationId String
  kind           TaxDocKind
  series         String        // R001 / P001
  number         Int
  status         InvoiceStatus @default(PENDING)
  externalId     String?       // documentId APISUNAT
  sunatCode      String?
  sunatMessage   String?
  issueDate      String
  currency       String        @default("PEN")
  regime         String        // 01 (3% ret) / 01 (2% perc)
  percent        Decimal       @db.Decimal(6, 2)
  // Contraparte (proveedor en retención / cliente en percepción)
  partyDocType   DocIdentityType @default(RUC)
  partyDoc       String
  partyName      String
  // Totales
  totalBase      Decimal @db.Decimal(14, 2) // total de los comprobantes referidos
  totalTax       Decimal @db.Decimal(14, 2) // monto retenido/percibido
  totalPaid      Decimal @db.Decimal(14, 2) // neto pagado/cobrado
  pdfUrl         String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  refs         TaxDocumentRef[]

  @@unique([organizationId, kind, series, number])
  @@index([organizationId, kind])
  @@map("tax_documents")
}

model TaxDocumentRef {
  id            String   @id @default(cuid())
  taxDocumentId String
  docType       String   // "01" factura, "03" boleta
  series        String
  number        Int
  issueDate     String
  currency      String   @default("PEN")
  total         Decimal  @db.Decimal(14, 2) // total del comprobante
  taxAmount     Decimal  @db.Decimal(14, 2) // retenido/percibido de ESTE comprobante
  netPaid       Decimal  @db.Decimal(14, 2)
  exchangeRate  Decimal? @db.Decimal(10, 3) // si el comprobante referido es en USD
  taxDocument   TaxDocument @relation(fields: [taxDocumentId], references: [id], onDelete: Cascade)
  @@index([taxDocumentId])
  @@map("tax_document_refs")
}
```
Agregar `taxDocuments TaxDocument[]` a `Organization`.

### 1.4 Detracción en la venta
```prisma
model Order {
  // ...existentes...
  detraction Boolean @default(false)
}
```
Y en `Invoice` (para reconstruir el documento impreso):
```prisma
model Invoice {
  // ...existentes...
  detractionCode    String?  // cat. 54 del bien/servicio
  detractionPercent Decimal? @db.Decimal(6,2)
  detractionAmount  Decimal? @db.Decimal(14,2)
}
```

> Tras editar: `cd apps/api && npx prisma db push` (parar la API antes para evitar EPERM en el engine — gotcha conocido).

---

## FASE 2 — Builder UBL

### 2.A Detracción (extender `apisunat.builder.ts`)

En `BuildInput` agregar un opcional:
```ts
detraction?: { code: string; percent: number; amount: number; account: string };
```
En `buildDocument`, dentro del bloque `if (FACTURA || BOLETA)` (solo aplica a FACTURA):
1. Cambiar el tipo de operación (cat. 51): de `0101` (venta interna) a **`1001`** (operación sujeta a detracción) cuando `input.detraction` exista.
2. Agregar:
```ts
documentBody['cac:PaymentMeans'] = {
  'cbc:ID': t('Detraccion'),
  'cbc:PaymentMeansCode': t('999'), // depósito en cuenta
  'cac:PayeeFinancialAccount': { 'cbc:ID': t(input.detraction.account) },
};
documentBody['cac:PaymentTerms'] = [
  { 'cbc:ID': t('Detraccion'),
    'cbc:PaymentMeansID': t(input.detraction.code),       // cat. 54
    'cbc:PaymentPercent': t(input.detraction.percent),
    'cbc:Amount': { _attributes: { currencyID: 'PEN' }, ...t(input.detraction.amount.toFixed(2)) } },
  { 'cbc:ID': t('FormaPago'), 'cbc:PaymentMeansID': t('Contado') }, // el existente
];
```
> ⚠️ Hoy `PaymentTerms` es un objeto único (FormaPago). Con detracción pasa a **array**. Verificar el orden y nombres EXACTOS con el generador JSON de APISUNAT para una factura con detracción.

### 2.B Retención y Percepción (builder nuevo)

Crear `apps/api/src/apisunat/tax-doc.builder.ts` con `buildTaxDocument(input)` que devuelva `{ fileName, documentBody }`.

- **fileName**: `{RUC}-{20|40}-{serie}-{numero8}` (igual patrón que el resto).
- **documentBody (Retención)** — estructura SUNAT `Retention` (calcar del generador APISUNAT):
  - `cbc:UBLVersionID` 2.0, `cbc:CustomizationID` 1.0
  - `cbc:ID` (R001-00000001), `cbc:IssueDate`
  - `cbc:Note` (leyenda), `sac:SUNATRetentionSystemCode` (régimen 01), `sac:SUNATRetentionPercent` (3)
  - `cbc:TotalInvoiceAmount` (monto total retenido), `cbc:TotalPaid`
  - `cac:AgentParty` = emisor (RUC + RegistrationName + RegistrationAddress con ubigeo, como en factura → corrige obs. 4093/4198)
  - `cac:ReceiverParty` = proveedor (RUC + nombre)
  - `sac:SUNATRetentionDocumentReference[]` (uno por comprobante):
    - `cbc:ID` con `_attributes.schemeID` del tipo (cat 01: "01"/"03") y valor `serie-numero`
    - `cbc:IssueDate`
    - `cac:Payment`: `cbc:ID` (id pago), `cbc:PaidAmount` (total del comprobante), `cbc:PaidDate`
    - `sac:SUNATRetentionInformation`: `sac:SUNATRetentionAmount`, `sac:SUNATRetentionDate`, `sac:SUNATNetTotalPaid`, y si el comprobante es USD: `sac:SUNATRetentionInformation/cac:ExchangeRate` (`cbc:SourceCurrencyCode` USD, `cbc:TargetCurrencyCode` PEN, `cbc:CalculationRate`, `cbc:Date`).
- **documentBody (Percepción)** — idéntico patrón con prefijos `Perception`/`SUNATPerception*` y montos percibidos.

> Namespaces: Retention `urn:sunat:names:specification:ubl:peru:schema:xsd:Retention-1`,
> Perception `...:Perception-1`. APISUNAT normalmente los maneja por el tipo; confirmar en el generador.

---

## FASE 3 — Backend (servicio + endpoints)

### 3.A Detracción
- `apps/api/src/pos/dto.ts`: en `CreateSaleDto` agregar `detraction?: { code: string; percent: number; account?: string }`.
- `orders.service.ts`: persistir `Order.detraction` y, al emitir, pasar a `invoices.emitForOrder` los datos de detracción. Calcular `amount = round2(total * percent/100)`. Tomar `account` de `dto.detraction.account ?? organization.detractionAccount`.
- `invoices.service.ts` `emitForOrder`: si la orden tiene detracción y es FACTURA, pasar `detraction` al `buildDocument` y guardar `detractionCode/Percent/Amount` en `Invoice`.

### 3.B Retención / Percepción — nuevo módulo `taxdoc`
Crear `apps/api/src/taxdoc/` (módulo, servicio, controller, dto) siguiendo el patrón de `commercial`/`invoices`:

- `TaxDocService.create(orgId, kind, dto)`:
  1. Validar que la org sea agente (`retentionAgent`/`perceptionAgent`).
  2. Resolver `regime`/`percent` (de la org o del dto).
  3. Por cada ref: calcular `taxAmount = round2(total * percent/100)`, `netPaid = total - taxAmount`.
  4. Totales: `totalBase`, `totalTax`, `totalPaid`.
  5. Correlativo atómico con `BillingSeriesService.getNextNumber` (extenderlo para aceptar RETENCION/PERCEPCION, series R001/P001).
  6. Persistir `TaxDocument` + `TaxDocumentRef` en `PENDING` (outbox-lite, igual que `createCreditNote`).
  7. `buildTaxDocument` → `apisunat.sendBill(creds, fileName, documentBody)` → `waitForFinal` → mapear estado, guardar `externalId/status/sunatCode/sunatMessage/pdfUrl`.
  8. Manejo de error idéntico a `createCreditNote` (ApiSunatUnavailableError → queda PENDING; rechazo → REJECTED + mensaje).
- `TaxDocController` (`@Roles('OWNER','ADMIN','MANAGER','ACCOUNTANT')`):
  - `GET /tax-docs?kind=RETENCION|PERCEPCION` (listar)
  - `GET /tax-docs/:id`
  - `POST /tax-docs/retencion` y `POST /tax-docs/percepcion`
  - `POST /tax-docs/:id/refresh` (reconciliar estado, como invoices)
- Registrar `TaxDocModule` en `app.module.ts`.
- `monitor`: incluir `TaxDocument` PENDING en `dailyReconcile` (opcional pero recomendado).

DTO ejemplo:
```ts
export class CreateTaxDocDto {
  @IsOptional() @IsString() regime?: string;
  @IsOptional() @IsNumber() percent?: number;
  @IsEnum(DocIdentityType) partyDocType!: DocIdentityType; // RUC
  @IsString() partyDoc!: string;
  @IsString() partyName!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TaxRefDto) refs!: TaxRefDto[];
}
export class TaxRefDto {
  @IsString() docType!: string;   // "01" | "03"
  @IsString() series!: string;
  @IsNumber() number!: number;
  @IsString() issueDate!: string;
  @IsNumber() total!: number;
  @IsOptional() @IsNumber() exchangeRate?: number;
}
```

---

## FASE 4 — Frontend

### 4.A Detracción (en POS / settings)
- `settings`: campo **Cuenta de detracción (Banco de la Nación)** + toggle "Soy agente / aplico detracción".
- POS (`/pos`): cuando el documento es **FACTURA**, mostrar un toggle "Operación con detracción" + select del **código (cat. 54)** y % (autocompleta el monto). Pasar `detraction` en el payload de `/orders`.
- En `/invoices` y `/imprimir/[id]`: mostrar la leyenda de detracción y el monto cuando el comprobante la tenga.

### 4.B Retención / Percepción (página nueva)
- Nueva página `apps/web/src/app/(admin)/retenciones/page.tsx` (o pestaña con toggle Retención/Percepción, como cotizaciones).
- Roles: visible para OWNER/ADMIN/MANAGER/ACCOUNTANT. Agregar a `lib/nav.ts` sección **Ventas** o **Sistema**, gated también por `org.retentionAgent || org.perceptionAgent` (consultar `/organization`).
- Flujo: seleccionar contraparte (con autocompletar RUC vía `/customers/lookup`), agregar comprobantes referidos (serie/número/fecha/total) — idealmente buscar facturas existentes del cliente/proveedor —, ver el % y monto calculado, emitir.
- Estados con `StatusBadge` (ya en español), `EmptyState`/`SkeletonRows`, etiquetas vía `lib/labels.ts` (añadir RETENCION/PERCEPCION a `DOC_TYPE`).
- Botón de PDF (APISUNAT) e "Imprimir" propio si se quiere.

### 4.C Etiquetas
En `apps/web/src/lib/labels.ts` → `DOC_TYPE`: agregar `RETENCION: 'Retención'`, `PERCEPCION: 'Percepción'`.

---

## FASE 5 — Verificación (obligatoria, en este orden)

1. `pnpm --filter @facturarkos/api build` y `npx prisma db push` OK.
2. **Detracción**: emitir una FACTURA con detracción a la cuenta dev → debe salir **ACEPTADO** con la leyenda y el monto. Si SUNAT observa, comparar el `documentBody` contra el del generador JSON de APISUNAT nodo por nodo.
3. **Retención**: `POST /tax-docs/retencion` referenciando una factura ACEPTADA previa → estado **ACEPTADO** con PDF. Serie fresca R001.
4. **Percepción**: igual con `POST /tax-docs/percepcion`, serie P001.
5. Smoke script en `apps/api/scripts/` (espejo de `smoke-features.mjs`): login → emitir retención y percepción → verificar estado ACEPTADO y que aparezcan en `GET /tax-docs`.
6. Typecheck web + screenshots de la página nueva (desktop + móvil) siguiendo `docs/UX-PRINCIPLES.md` (skeleton/empty/labels/estados).
7. Actualizar `HANDOFF.md` (mover ítems del roadmap a HECHO) y la memoria del proyecto.

## Gotchas SUNAT específicos (de la experiencia con boleta/factura/NC/ND)
- Dirección del emisor en CRE/PRE: incluir `cac:RegistrationAddress/cbc:ID` (ubigeo cat. 13) y `cbc:AddressTypeCode` (local anexo) — corrige obs. 4093/4198, igual que en factura.
- La cuenta dev `arkosprueba` ya usó series; usar **series nuevas** (R001, P001) para no chocar con "Numeración repetida".
- `getById` extrae el motivo del rechazo de `faults[].faultstring._text` — ya implementado en `apisunat.service.ts`, reutilizarlo.
- Montos siempre recalculados desde BD (P del playbook), nunca confiar en el monto del front.
- Fechas fiscales en timezone Lima (`limaDateString`).

## Estimación de esfuerzo
- Detracción (extensión factura): ~0.5 día. Retención+Percepción (modelo+builder+servicio+UI): ~1.5–2 días. Validación SUNAT en vivo: variable (depende de cuántas observaciones de campo surjan; el generador JSON de APISUNAT reduce mucho esto).
