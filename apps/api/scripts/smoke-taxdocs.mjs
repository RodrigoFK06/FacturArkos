// Smoke end-to-end de Retención / Percepción / Detracción contra la cuenta dev APISUNAT.
// Uso: node scripts/smoke-taxdocs.mjs   (con la API corriendo en :3001)

const BASE = process.env.API_URL ?? 'http://localhost:3001/api';
const EMAIL = process.env.SMOKE_EMAIL ?? 'demo@facturarkos.pe';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'password123';

let token = '';
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data && data.message ? (Array.isArray(data.message) ? data.message.join(', ') : data.message) : text;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

const log = (...a) => console.log(...a);
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;

async function main() {
  // 1. Login
  const auth = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  token = auth.accessToken ?? auth.token ?? auth.access_token;
  if (!token) throw new Error('No se obtuvo token de /auth/login: ' + JSON.stringify(auth));
  log(ok('✓ login'), auth.user?.email ?? '');

  // 2. Marcar la organización como agente + cuenta de detracción
  await call('/organization', {
    method: 'PATCH',
    body: { retentionAgent: true, perceptionAgent: true, detractionAccount: '00-099-001234' },
  });
  log(ok('✓ organización marcada como agente de retención/percepción + cuenta de detracción'));

  // 3. Establecimiento + cliente con RUC
  const ests = await call('/establishments');
  const establishmentId = ests[0]?.id;
  if (!establishmentId) throw new Error('No hay establecimientos');

  const customer = await call('/customers', {
    method: 'POST',
    body: { identityType: 'RUC', documentNumber: '20512345678', name: 'CLIENTE EMPRESA SAC', address: 'Av. Test 123' },
  }).catch(async (e) => {
    // ya existe → buscarlo
    if (String(e).includes('409') || String(e).toLowerCase().includes('exist')) {
      const list = await call('/customers?q=20512345678');
      return list[0];
    }
    throw e;
  });
  log(ok('✓ cliente RUC'), customer.documentNumber);

  // 4. Factura CON detracción (12%)
  const saleRes = await call('/orders', {
    method: 'POST',
    body: {
      establishmentId,
      customerId: customer.id,
      items: [{ name: 'Servicio de consultoría', quantity: 1, unitPrice: 1180 }],
      payments: [{ method: 'CREDIT', amount: 1180 }],
      emit: { documentType: 'FACTURA', series: 'F961' },
      detraction: { code: '037', percent: 12 },
    },
  });
  const inv = saleRes.invoice;
  log(
    inv?.status === 'ACCEPTED' ? ok('✓ FACTURA con detracción') : bad('✗ FACTURA con detracción'),
    `${inv?.series}-${inv?.number} · ${inv?.status}`,
    inv?.detractionAmount != null ? `· detracción S/ ${inv.detractionAmount}` : '',
    inv?.status === 'REJECTED' ? `\n   motivo: ${inv?.sunatMessage}` : '',
  );

  const refBase = inv && (inv.status === 'ACCEPTED' || inv.status === 'PENDING')
    ? { docType: '01', series: inv.series, number: inv.number, issueDate: inv.issueDate, total: Number(inv.total) }
    : { docType: '01', series: 'F001', number: 1, issueDate: new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10), total: 1180 };

  // 5. Retención (3%) — tolerante: si APISUNAT rechaza, el registro queda REJECTED.
  let ret = null;
  try {
    ret = await call('/tax-docs/retencion', {
      method: 'POST',
      body: { partyDocType: 'RUC', partyDoc: '20512345678', partyName: 'PROVEEDOR EMPRESA SAC', percent: 3, series: 'R961', refs: [refBase] },
    });
    log(ret.status === 'ACCEPTED' ? ok('✓ RETENCIÓN') : bad(`✗ RETENCIÓN (${ret.status})`), `${ret.series}-${ret.number} · retenido S/ ${ret.totalTax}`, ret.status === 'REJECTED' ? `\n   motivo: ${ret.sunatMessage}` : '');
  } catch (e) {
    log(bad('✗ RETENCIÓN'), e.message);
  }

  // 6. Percepción (2%)
  let per = null;
  try {
    per = await call('/tax-docs/percepcion', {
      method: 'POST',
      body: { partyDocType: 'RUC', partyDoc: '20512345678', partyName: 'CLIENTE EMPRESA SAC', percent: 2, series: 'P961', refs: [refBase] },
    });
    log(per.status === 'ACCEPTED' ? ok('✓ PERCEPCIÓN') : bad(`✗ PERCEPCIÓN (${per.status})`), `${per.series}-${per.number} · percibido S/ ${per.totalTax}`, per.status === 'REJECTED' ? `\n   motivo: ${per.sunatMessage}` : '');
  } catch (e) {
    log(bad('✗ PERCEPCIÓN'), e.message);
  }

  // 7. Listados
  const listRet = await call('/tax-docs?kind=RETENCION');
  const listPer = await call('/tax-docs?kind=PERCEPCION');
  log(ok('✓ GET /tax-docs'), `retención=${listRet.length} · percepción=${listPer.length}`);

  log('\nResumen:');
  log(`  FACTURA detracción: ${inv?.status}`);
  log(`  RETENCIÓN:          ${ret?.status ?? 'error'} (persistidas: ${listRet.length})`);
  log(`  PERCEPCIÓN:         ${per?.status ?? 'error'} (persistidas: ${listPer.length})`);
}

main().catch((e) => { console.error(bad('ERROR'), e.message); process.exit(1); });
