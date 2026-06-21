// Test DIRECTO del builder UBL contra APISUNAT dev — sin DB, sin servidor.
// Responde la incógnita crítica: ¿APISUNAT acepta el UBL que generamos?
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Cargar .env de la API
const env = {};
for (const line of readFileSync(join(__dirname, '../apps/api/.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?/);
  if (m) env[m[1]] = m[2];
}
const BASE = env.APISUNAT_BASE_URL || 'https://back.apisunat.com';
const personaId = env.APISUNAT_PERSONA_ID;
const personaToken = env.APISUNAT_TOKEN;

const { buildDocument } = require('../apps/api/dist/apisunat/apisunat.builder.js');

async function txt(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}

// 1) Intentar descubrir el RUC de la cuenta dev (varias variantes de auth)
async function discoverRuc() {
  const tries = [
    { url: `${BASE}/personas/${personaId}`, headers: { Authorization: personaToken } },
    { url: `${BASE}/personas/${personaId}`, headers: { Authorization: `Bearer ${personaToken}` } },
    { url: `${BASE}/personas/${personaId}?personaToken=${personaToken}`, headers: {} },
  ];
  for (const t of tries) {
    try {
      const r = await fetch(t.url, { headers: t.headers });
      const body = await txt(r);
      if (r.ok && body && typeof body === 'object') {
        const ruc = body.ruc || body.RUC || body.numeroDocumento || body?.persona?.ruc;
        console.log('persona OK:', JSON.stringify(body).slice(0, 200));
        if (ruc) return String(ruc);
      }
    } catch { /* siguiente */ }
  }
  return null;
}

async function main() {
  console.log('APISUNAT:', BASE, '· personaId:', personaId?.slice(0, 8) + '…');
  let ruc = await discoverRuc();
  console.log('RUC descubierto:', ruc ?? '(no, uso placeholder 20000000001)');
  ruc = ruc || '20000000001';

  const built = buildDocument({
    documentType: 'BOLETA',
    series: 'B001',
    number: 1,
    issueDate: new Date().toISOString().slice(0, 10),
    issueTime: '10:00:00',
    currency: 'PEN',
    issuer: { ruc, razonSocial: 'EMPRESA DEMO ARKOS', address: 'Av. Demo 123' },
    customer: { identityTypeCode: '0', documentNumber: '00000000', name: 'CLIENTES VARIOS' },
    lines: [
      { description: 'Producto de prueba', quantity: 1, unitPriceWithIgv: 11.8, unitCode: 'NIU', igvAffectation: 'GRAVADO' },
    ],
  });

  console.log('\nfileName:', built.fileName);
  console.log('documentBody (recorte):', JSON.stringify(built.documentBody).slice(0, 500), '…\n');

  const res = await fetch(`${BASE}/personas/v1/sendBill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId, personaToken, fileName: built.fileName, documentBody: built.documentBody }),
  });
  const body = await txt(res);
  console.log(`=== sendBill → HTTP ${res.status} ===`);
  console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
