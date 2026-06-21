# Playbook de integraciones SaaS — extraído de RestHUB

> Patrones reales, probados en producción, para replicar en los próximos SaaS.
> Fuente: `restaurante-backend` (NestJS 11 + Prisma + PostgreSQL).
> Cubre: **facturación electrónica SUNAT (APISUNAT)**, **pasarelas de pago
> (Niubiz QR, Izipay, Culqi)**, y los **patrones transversales** que hacen que
> estas integraciones sean seguras, multi-tenant e idempotentes.

El valor de este documento no son las APIs específicas (esas cambian por país y
proveedor), sino los **patrones reutilizables**. Cada sección marca qué es
"específico de Perú/proveedor" y qué es "copiar tal cual a cualquier SaaS".

---

## 0. Principios transversales (copiar a cualquier SaaS)

Estos 7 principios aparecen en TODAS las integraciones de RestHUB. Son la base.

### P1 — Secrets de terceros encriptados at-rest (AES-256-GCM)
Nunca guardes un token/API-key de un proveedor en texto plano en la BD. Se
encripta con una clave maestra en env var, y solo se desencripta en el último
momento, justo antes de la llamada saliente.

### P2 — Credenciales por organización (multi-tenant) vs. globales
Dos modelos según el negocio:
- **Por-tenant** (ej. SUNAT): cada cliente tiene su propio RUC/token → vive en
  una tabla `*_config` con `organizationId @unique`.
- **Global de plataforma** (ej. Niubiz/Izipay donde tú eres el merchant): vive
  en env vars del backend. Más simple, pero todos los tenants comparten cuenta.

Decidir esto temprano: ¿el cliente trae su propia cuenta del proveedor, o cobras
tú y repartes? Cambia toda la arquitectura de config.

### P3 — Webhooks fail-closed con secreto compartido + timing-safe compare
Todo webhook entrante se valida ANTES de procesar el payload. Si el proveedor no
firma con HMAC, exiges un secreto compartido en un header custom. Sin secreto
configurado → se rechaza TODO (fail-closed, no fail-open).

### P4 — Idempotencia por ID externo + guard condicional contra concurrencia
Los proveedores reintentan webhooks ante timeouts. Cada efecto (marcar pagado,
emitir comprobante) debe ser idempotente: clave única por ID externo +
`updateMany` condicional que actúa como lock optimista en una transacción.

### P5 — Nunca confíes en montos/estados del payload externo
El monto a cobrar y el estado final SIEMPRE se recalculan desde tu BD. El
webhook solo dispara la verificación; no decide cuánto se cobró.

### P6 — Persistir "PENDING" antes de la llamada saliente, reconciliar después
Patrón outbox-lite: graba el intento como PENDING en tu BD → haz la llamada →
actualiza con el resultado. Si la llamada se cae a mitad, tienes rastro y puedes
reconciliar (polling de status).

### P7 — Fail-fast en config faltante, sin fallbacks dummy
Si falta una credencial, lanza error explícito al primer uso. Nunca sustituyas
con valores dummy ("12345678") que dejan pasar llamadas con credenciales falsas.

---

## 1. Patrón: encriptación de secrets at-rest (AES-256-GCM)

**Reutilizable 100%.** Es el helper más copiable de todo el repo.
`src/common/crypto/encrypt.ts`.

### Diseño
- Algoritmo: `aes-256-gcm` (cifra + autentica; detecta manipulación).
- IV aleatorio de 12 bytes por mensaje (recomendado para GCM).
- AuthTag verificado al desencriptar → si alguien tocó el ciphertext, `.final()`
  lanza error.
- Clave maestra: env var `SECRETS_ENCRYPTION_KEY`, 32 bytes en hex (64 chars).
  Generar con `openssl rand -hex 32`.
- **Fail-fast**: si la env var falta o tiene largo incorrecto, throw al primer
  uso. No arrancar con encriptación silenciosamente rota.
- Formato de salida: `iv:authTag:ciphertext`, los tres en base64.
- `isEncrypted()`: detecta idempotentemente si un string ya está cifrado (vital
  para migraciones legacy y para no doble-encriptar).

```ts
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV
const KEY_BYTES = 32;

function loadKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) throw new Error('SECRETS_ENCRYPTION_KEY required (openssl rand -hex 32)');
  const key = Buffer.from(raw, 'hex');
  if (key.length !== KEY_BYTES) throw new Error('must decode to 32 bytes');
  return key;
}

export function encrypt(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  // ...split, setAuthTag(tag), decipher.final() throwea si el tag no matchea
}
```

### Cómo se usa en la práctica (capa de servicio)
- Al **guardar** config (`upsert`): `isEncrypted(input) ? input : encrypt(input)`
  — evita doble-cifrado cuando el cliente reenvía un valor ya cifrado o el campo
  enmascarado.
- Al **mostrar** en el admin: nunca devuelves el plaintext. Devuelves
  `passwordMasked: "••••••1234"` (solo el sufijo) + `hasPassword: true`.
- Al **usar** (la única ruta que desencripta): un método dedicado `getDecrypted()`
  que SOLO el servicio de integración llama, justo antes de armar las creds.
- Migración legacy: script idempotente (`encrypt-sunat-passwords.js`) que recorre
  filas, y por cada una `if (!isEncrypted(row.password)) encrypt(...)`. Como
  `getDecrypted()` tiene fallback a plaintext, el rollout no genera downtime.

**Checklist nuevo SaaS:** ① genera la key y métela en el secret manager del host
(Render/Vercel env). ② copia `encrypt.ts` tal cual. ③ todo campo sensible de
config pasa por `toStoredPassword()` al escribir y `maskToken()` al leer.

---

## 2. Patrón: config de integración multi-tenant

`src/sunat-config/sunat-config.service.ts` — CRUD de credenciales por org.

Reglas que se repiten en cualquier integración por-tenant:
- Tabla con `organizationId @unique` (un config por tenant, a lo más).
- `provider` como enum string (`APISUNAT | NUBEFACT | ...`) → permite cambiar de
  proveedor sin tocar el schema. **Patrón clave para SaaS**: nunca acoples tu BD
  a un solo proveedor. El service que llama valida `if (cfg.provider !== 'X')`.
- **PATCH preserva el secreto** si no viene uno nuevo: el frontend nunca maneja
  el plaintext, así que un PATCH sin `password` mantiene el existente
  (`...(dto.password && { password: toStored(dto.password) })`).
- Validación de identificadores fiscales en el DTO (ej. RUC:
  `/^(10|15|17|20)\d{9}$/`). Adaptar al país.
- `testMode` boolean por tenant → sandbox vs producción sin redeploy.
- Tres métodos de lectura con distinto nivel de exposición:
  - `get()` → serializado, secreto enmascarado (para el admin UI).
  - `getDecrypted()` → con plaintext, **uso restringido** al service de integración.
  - el resto del código jamás toca el plaintext.

---

## 3. SUNAT — facturación electrónica (vía APISUNAT)

> **Específico de Perú.** Pero la *forma* de integrar un proveedor de facturación
> electrónica (intermediario que firma y envía a la autoridad tributaria) se
> replica en Chile (SII), México (CFDI/PAC), Colombia (DIAN), etc. Cambia el
> formato del documento y la autoridad; la arquitectura es idéntica.

### 3.1 Arquitectura general
RestHUB **no** habla directo con SUNAT. Usa **APISUNAT** (`back.apisunat.com`)
como intermediario que firma el XML UBL 2.1, lo envía a SUNAT y devuelve el CDR.
Esto es lo correcto: implementar firma digital XML + protocolo SUNAT directo es
meses de trabajo y certificación. **Para cualquier SaaS fiscal: usa un PAC/OSE
intermediario, no hables directo con la autoridad.**

Capas:
1. `apisunat.service.ts` — cliente HTTP puro hacia APISUNAT (sendBill, getById,
   voidBill, fetchPdf, lastDocument, listDocuments). Sin lógica de negocio.
2. `apisunat.builder.ts` — construye el `documentBody` (JSON que representa el
   XML UBL 2.1). Funciones puras, 100% testeables sin red.
3. `invoices.service.ts` — orquestación: correlativos, idempotencia, persistencia,
   polling, manejo de rechazos.
4. `sunat-config.service.ts` — credenciales por org (sección 2).

### 3.2 El builder UBL (lo más específico, pero el patrón es general)
`back.apisunat.com` acepta el documento como JSON estilo `xml-js`
(`{ 'cbc:ID': { _text: '...' }, _attributes: {...} }`). El builder arma ese árbol.

Detalles fiscales que costó sangre descubrir (anótalos para el próximo país):
- **IGV 18%** hardcodeado como `IGV_RATE = 0.18`. Cada línea calcula
  `taxable = qty × unitValue`, `igv = taxable × 0.18`.
- **Trabajar "hacia adelante" desde lo cobrado**: el POS cobra un total CON IGV.
  Para emitir, se descompone: `lineIgv = round2(total × 18/118)`,
  `base = total − igv`. Si haces el redondeo al revés (base→total) un S/10.00
  cobrado se emite como S/9.99 y la boleta no cuadra con la caja.
- **Distribución de descuento proporcional** entre líneas, con el residuo de
  redondeo a la última línea para que la suma cierre exacta.
- **Fecha en zona horaria del negocio, no del servidor**: SUNAT valida
  `IssueDate` contra el día calendario de Lima (UTC-5). Con el servidor en UTC,
  todo comprobante emitido después de las 19:00 Lima salía fechado al día
  siguiente → rechazo. Helper `limaDateString()`/`limaTimeString()`.
  **Regla general: fecha fiscal = timezone del cliente, calculada explícitamente,
  jamás `new Date()` del servidor.**
- **Tipos de documento** (catálogo SUNAT 01): Factura `01`, Boleta `03`, Nota de
  crédito `07`, Nota de débito `08`. La boleta sin DNI usa `schemeID="0"` y
  docNumber `"00000000"`.
- **Notas de crédito/débito**: mismo árbol pero root `CreditNote`/`DebitNote`,
  `cac:InvoiceLine`→`cac:CreditNoteLine`, y obligatorio `cac:BillingReference` +
  `cac:DiscrepancyResponse` apuntando al documento original.
- **Factura al crédito**: SUNAT exige (validaciones 3244-3247) declarar el monto
  pendiente + una entrada `CuotaNNN` por cuota con su `PaymentDueDate`. La suma de
  cuotas debe coincidir con el total o rechaza.

### 3.3 Orquestación de emisión (PATRÓN REUTILIZABLE)
`invoices.service.ts::emitInvoice` es el mejor ejemplo de los principios P4/P6.

**Correlativos atómicos** (`getNextNumber`): los números de serie fiscal NO
pueden tener huecos ni repetirse entre cajas concurrentes. Se usa `upsert`
atómico (`INSERT ... ON CONFLICT` de Postgres) sobre una tabla `BillingSeries`
con `@@unique([organizationId, type, series])`:
```ts
prisma.billingSeries.upsert({
  where: { organizationId_type_series: {...} },
  create: { ...,  currentNumber: 1 },
  update: { currentNumber: { increment: 1 } },
});
// + retry una vez ante P2002 (carrera en la creación de la fila).
```
El patrón `findUnique + create` dentro de una transacción NO lockea → dos cajas
chocaban. **Para cualquier secuencia monótona en un SaaS: upsert con increment,
no read-then-write.**

**Idempotencia de emisión**: `Order.invoice` es relación 1:1 (`orderId @unique`).
- Si la orden ya tiene comprobante y no está REJECTED → devolver el existente
  (no 409). Cubre doble-click / doble-render.
- Si está REJECTED → reutilizar la fila con correlativo fresco (un RUC mal
  tipeado no debe dejar la venta sin comprobante para siempre).
- Doble-submit que choca con el `UNIQUE(orderId)` (P2002) → devolver el ganador.

**Secuencia outbox-lite (P6):**
1. Persistir `Invoice` como `PENDING` (antes de tocar APISUNAT).
2. `sendBill` → si falla, marcar `REJECTED` con `sunatCode`/`sunatMessage`.
3. Guardar `externalId` (documentId del proveedor).
4. **Polling sincrónico** hasta 30s (`waitForFinal`) por el estado final.
5. Si no responde a tiempo → queda `PENDING`, y `refreshStatus` lo reconcilia
   después (endpoint manual o cron).

**Mapeo de estados externos → internos** (función estática pura):
`ACEPTADO→ACCEPTED`, `RECHAZADO/EXCEPCION/ERROR→REJECTED`,
`BAJA/ANULADO→VOIDED`, `PENDIENTE→PENDING`. Aísla tu dominio del vocabulario del
proveedor.

### 3.4 Polling con backoff exponencial (reutilizable)
`waitForFinal` — patrón para cualquier operación asíncrona de un tercero:
```ts
let wait = intervalMs;                       // 2000ms inicial
while (Date.now() - start < timeoutMs) {     // 30s techo
  const doc = await getById(...);
  if (doc.status !== 'PENDIENTE') return doc; // estado final → salir
  await sleep(wait);
  wait = Math.min(Math.round(wait * 1.4), 8000); // backoff con techo
}
return last; // timeout → último estado conocido, no error
```
Los `getById` fallidos se loguean y NO abortan el loop (resiliencia).

### 3.5 Anulación (baja) asíncrona
`voidBill` dispara una comunicación de baja que SUNAT procesa async. Estados
intermedios importan: mientras la baja está en vuelo, el documento original sigue
ACEPTADO. Se introduce un estado `VOID_PENDING` que `refreshStatus` resuelve sin
retroceder a ACCEPTED. **Lección: modela los estados intermedios de operaciones
async de terceros explícitamente, no asumas éxito inmediato.**

---

## 4. Pasarelas de pago

Tres integraciones, tres modelos distintos. Útil tener las tres como referencia.

### 4.1 Niubiz QR Simple — `src/niubiz/` (la más completa y segura)

> **Específico de Perú** (QR EMV interoperable BCRP: lo escanea Yape, Plin, BCP,
> etc.). Pero el **flujo QR dinámico + webhook** es idéntico a Mercado Pago,
> PIX (Brasil), etc.

**Modelo de credenciales:** GLOBAL de plataforma (env vars
`NIUBIZ_USER/PASSWORD/MERCHANT_ID`). Tú eres el merchant.

**Flujo completo:**
1. Backend POST a `api.security` con **Basic Auth** → recibe un JWT.
2. JWT **cacheado en memoria** con margen de 60s antes de `exp` (se parsea el
   `exp` del JWT sin validar firma — confías en TLS). Re-autentica al expirar.
3. Backend POST a `api.qr.manager/v1/qr/ascii` con el JWT + monto + merchantId →
   recibe `tagImg` (ya viene como `data:image/png;base64,...`, listo para `<img>`).
4. El **monto del QR se calcula desde la BD** (`computeRemaining`): subtotal de
   ítems+modificadores − descuento + propina − ya pagado. Nunca del cliente.
5. Frontend muestra el QR. Cliente escanea y paga con cualquier app.
6. Niubiz notifica al **webhook** → marca Payment + Order PAID.
7. Frontend hace **polling cada 3s** al status como fallback si el webhook tarda.

**Cache de token JWT (reutilizable):**
```ts
private cachedToken: { token: string; expiresAt: number } | null = null;
if (this.cachedToken && this.cachedToken.expiresAt - 60000 > Date.now())
  return this.cachedToken.token;     // 60s de margen
// ...autenticar, parsear exp del JWT, cachear
```

**Validación de fecha futura:** Niubiz exige `validityDate` futuro (formato
`ddMMyyyy`). Se usa MAÑANA en zona Lima — antes era +7 días, lo que dejaba un QR
de pre-pago pagable una semana aunque la orden se auto-cancelara a los 30 min.
**Lección: acota la validez real del QR en el proveedor, no solo en tu UI.**

#### Seguridad del webhook (esto es oro — copiar el patrón completo)
Niubiz QR Simple **no firma sus webhooks con HMAC**. La defensa es un secreto
compartido (P3). El webhook pasa por **5 validaciones en orden** antes de mover
plata:

```ts
// 0. Secreto compartido en header, ANTES de mirar el payload. Fail-closed.
assertValidWebhookSecret(provided) {
  const expected = process.env.NIUBIZ_WEBHOOK_SECRET;
  if (!expected) throw Unauthorized;   // sin secreto configurado → rechaza todo
  // timingSafeEqual sobre hashes SHA-256 (longitud constante) → anti-timing-attack
  if (!timingSafeEqual(sha256(provided), sha256(expected))) throw Unauthorized;
}
```
Luego, en `handleWebhook`:
1. `tagId` presente.
2. `status` **requerido** y en lista blanca (`/approved|success|paid|aprobado/i`).
3. `externalReference` debe ser **UUID válido** (regex) → no un string arbitrario
   que dispare lógica de pago.
4. `amount` **obligatorio**, finito y > 0 → un atacante con status+ref válidos no
   puede cerrar una orden sin pagar.
5. En `applyApprovedPayment`:
   - **Idempotencia** por `externalId` (tagId): si ya existe ese Payment, return
     `duplicated`.
   - **Guard de estado**: jamás registrar pago sobre orden cancelada/cerrada → si
     llega, loguear `requiresRefund: true` para reembolso manual.
   - **Match de monto** contra el pendiente recalculado desde BD
     (`Math.abs(amount − remaining) > 0.009` → rechazar). El pagador no puede
     alterar el monto en EMV, pero nunca confías en el payload (P5).

**Concurrencia (P4) — el patrón estrella:**
```ts
const result = await prisma.$transaction(async (tx) => {
  const updated = await tx.order.updateMany({
    where: { id: orderId, status: { in: ['OPEN', 'PENDING_PAYMENT'] } }, // guard
    data: { status: 'PAID', paymentMethod: 'NIUBIZ_QR', paidAt: new Date() },
  });
  if (updated.count === 0) return { won: false };   // otra entrega ya ganó
  await tx.payment.create({ data: { orderId, amount, externalId: tagId } });
  return { won: true };
});
```
El flip condicional de status actúa como **lock optimista**: Niubiz reintenta
ante timeouts, pero solo UNA entrega gana el `updateMany`; las demás ven
`count=0` y no insertan Payment. El Payment se crea en la MISMA transacción: si
falla, el flip se revierte. **Este patrón resuelve el 90% de los problemas de
webhooks duplicados en cualquier SaaS de pagos.**

**Routing del webhook**: controller público separado (`/api/webhooks/niubiz`),
sin `JwtAuthGuard`, con healthcheck GET y manejo de body vacío (los proveedores
mandan pings al configurar).

### 4.2 Izipay — `src/izipay/` (tokenización, modelo más simple)

> **Específico de Perú**, modelo de pago con formulario tokenizado (como Stripe
> Elements / Culqi checkout).

**Modelo:** global (env `IZIPAY_MERCHANT_CODE/PUBLIC_KEY`). El backend solo
**genera un token** de transacción; el formulario JS de Izipay en el frontend
hace el cobro real con ese token.

Patrones reutilizables:
- **Sandbox por defecto, producción explícita**: `IZIPAY_API_BASE_QA` como
  default, pero en prod DEBES setear `IZIPAY_API_BASE=https://api-pw.izipay.pe`.
  Documentado en `.env.example`. (Decisión consciente: que un olvido caiga a QA,
  no que cobre en prod con config a medias.)
- **Sin fallbacks dummy (P7)**: antes el service sustituía `'12345678'` cuando
  faltaban env vars → llamadas con creds falsas que "funcionaban" en dev y
  fallaban raro en prod. Ahora: faltan creds → `BadRequestException` inmediato.
- **Monto recalculado desde BD** (mismo `computeRemaining` que Niubiz, P5).
- **Guard de estado**: no emite token para órdenes no abiertas.
- Usa `fetch` nativo (no axios) → otra dependencia menos.

### 4.3 Culqi
Mencionado en config (`provider`) pero la integración activa principal es
Niubiz/Izipay. El patrón de pasarela tokenizada de Izipay aplica igual a Culqi.

### 4.4 Tabla comparativa de modelos de pago

| Aspecto            | Niubiz QR              | Izipay/Culqi (tokenizado) |
|--------------------|------------------------|---------------------------|
| Quién cobra        | Plataforma (merchant)  | Plataforma (merchant)     |
| Confirmación       | Webhook + polling      | Respuesta del form JS     |
| Auth al proveedor  | Basic→JWT cacheado     | Merchant code + public key|
| Riesgo principal   | Webhook falsificado    | Token replay              |
| Defensa clave      | Secreto + match monto  | Monto server-side         |

---

## 5. Checklist para integrar un proveedor en un SaaS nuevo

Copiar esta lista y tacharla por integración:

**Setup**
- [ ] ¿Credenciales por-tenant o globales? (decide la tabla vs env vars)
- [ ] `SECRETS_ENCRYPTION_KEY` generada y en el secret manager del host
- [ ] Copiar `encrypt.ts`; todo secreto sensible cifrado at-rest
- [ ] `provider` como enum string si hay >1 proveedor posible del mismo servicio
- [ ] `testMode`/sandbox configurable sin redeploy; prod explícito en `.env.example`

**Cliente HTTP (service "tonto")**
- [ ] Timeouts en todas las llamadas (axios `timeout: 30_000`)
- [ ] Errores del proveedor mapeados a errores de dominio tipados
- [ ] Estados del proveedor mapeados a tu enum interno (función pura estática)
- [ ] Cache de token de auth con margen antes de `exp` si el proveedor usa JWT

**Orquestación (service de negocio)**
- [ ] Secuencias monótonas con `upsert + increment` atómico (no read-then-write)
- [ ] Persistir PENDING antes de la llamada saliente (outbox-lite)
- [ ] Idempotencia por ID externo + `UNIQUE` en BD
- [ ] Reconciliación posterior (polling/cron) para los que quedaron PENDING
- [ ] Modelar estados intermedios de operaciones async (ej. VOID_PENDING)

**Webhooks (si aplica)**
- [ ] Controller público separado, sin guard de auth de usuario
- [ ] Verificar firma HMAC del proveedor; si no firma → secreto compartido
- [ ] Fail-closed: sin secreto configurado, rechazar todo
- [ ] `timingSafeEqual` sobre hashes, nunca `===` de strings
- [ ] Validar TODOS los campos del payload (lista blanca de status, UUID, etc.)
- [ ] **Recalcular el monto desde TU BD**, nunca confiar en el payload
- [ ] Guard de estado: no aplicar efectos sobre entidades en estado inválido
- [ ] Transacción con `updateMany` condicional como lock optimista
- [ ] Idempotente por ID externo del proveedor
- [ ] Healthcheck GET + manejo de body vacío
- [ ] Loguear casos `requiresRefund` para intervención manual

**Datos / dominio**
- [ ] Fechas fiscales/de negocio en timezone del cliente, calculadas explícito
- [ ] Montos siempre con `round2` consistente entre cobro y emisión
- [ ] Multi-tenant: todo query filtra por `organizationId` del JWT, nunca de body

**Seguridad / config**
- [ ] Sin fallbacks dummy: falta credencial → fail-fast con error claro
- [ ] Admin UI ve secretos enmascarados (`••••••1234`), nunca plaintext
- [ ] Solo el service de integración llama a `getDecrypted()`

---

## 6. Mapa de archivos de referencia (en `restaurante-backend/src/`)

| Patrón                          | Archivo                                      |
|---------------------------------|----------------------------------------------|
| Encriptación at-rest            | `common/crypto/encrypt.ts`                   |
| Config multi-tenant + masking   | `sunat-config/sunat-config.service.ts`       |
| Cliente HTTP de tercero         | `apisunat/apisunat.service.ts`               |
| Builder de documento (pure)     | `apisunat/apisunat.builder.ts`               |
| Orquestación + correlativos     | `invoices/invoices.service.ts`               |
| Errores de dominio tipados      | `apisunat/apisunat.errors.ts`                |
| Webhook seguro + lock optimista | `niubiz/niubiz.service.ts`                   |
| Routing de webhook público      | `niubiz/niubiz.controller.ts`                |
| Pasarela tokenizada simple      | `izipay/izipay.service.ts`                   |
| Timezone de negocio             | `common/utils/lima-time.ts`                  |

---

## 7. Valores de env reales (sandbox/dev) — los que costó encontrar

> ⚠️ Archivo interno. Estos son los valores **sandbox/dev** que se hallaron con
> dificultad (sobre todo Niubiz: credenciales sandbox públicas pero enterradas en
> el plugin Flutter `niubiz_payment` y repos de GitHub). Guardados acá para no
> redescubrirlos al armar los próximos SaaS. NINGUNO es de producción — esos los
> entrega cada proveedor tras afiliación con RUC real. Origen: `restaurante-backend/.env`.

**APISUNAT (facturación electrónica) — entorno DESARROLLO (cuenta "arkosprueba"):**
```env
APISUNAT_PERSONA_ID="69fb5c4e003caf0029394d5f"
APISUNAT_TOKEN="DEV_evOeUPMtbmiGp0gfCfzW4HF6BwvmKx7IlDcQgD11pIGd8aCUuQCBhNhrhZOi8yfC"
APISUNAT_TEST_MODE="true"
```
- El prefijo `DEV_` del token define el ambiente (DESARROLLO). El token de
  PRODUCCIÓN se genera en el portal apisunat.com con otra cuenta. Misma URL base
  (`back.apisunat.com`) para dev y prod — el ambiente lo decide el token.
- En el flujo per-tenant real las creds salen de la tabla `sunat_configs`
  (cifradas); estas env son el seed/fallback de dev.

**NIUBIZ QR Simple — credenciales SANDBOX públicas (las difíciles de hallar):**
```env
NIUBIZ_ENV="sandbox"
NIUBIZ_USER="integraciones@niubiz.com.pe"
NIUBIZ_PASSWORD="_7z3@8fF"
NIUBIZ_MERCHANT_ID="438933213"
NIUBIZ_WEBHOOK_SECRET=""   # generar propio: openssl rand -hex 32
```
- Endpoints sandbox: `https://apitestenv.vnforapps.com` (security + qr.manager).
  Prod: `https://apiprod.vnforapps.com`.
- Para producción: `NIUBIZ_ENV=production` + credenciales reales tras afiliación
  con RUC. El `NIUBIZ_WEBHOOK_SECRET` se registra como header
  `x-niubiz-webhook-secret` en el portal Niubiz.

**IZIPAY — vacías en dev** (requeridas, sin fallback dummy):
```env
IZIPAY_MERCHANT_CODE=""   # las entrega Izipay tras afiliación
IZIPAY_PUBLIC_KEY=""
IZIPAY_API_BASE=""        # vacío = QA (qa-api-pw.izipay.pe); prod: api-pw.izipay.pe
```

**SECRETS_ENCRYPTION_KEY (dev)** — clave AES-256-GCM para cifrar tokens at-rest:
```env
SECRETS_ENCRYPTION_KEY=efb1bf3af71f29a56e02707b7f982cedc6724633f3d715fd2e99ea8708b17d03
```
- 32 bytes hex. Generar nuevas con `openssl rand -hex 32`. Rotarla invalida TODOS
  los tokens cifrados existentes (hay que desencriptar con la vieja y re-encriptar).

**Auxiliar:** `PERU_API_TOKEN` = apiperu.dev (consultas DNI/RUC), vacío en dev.

---

### Resumen de una línea
**Encripta los secrets, recalcula los montos desde tu BD, haz los webhooks
fail-closed e idempotentes con lock optimista, y persiste PENDING antes de cada
llamada saliente.** Todo lo demás es detalle del proveedor.
