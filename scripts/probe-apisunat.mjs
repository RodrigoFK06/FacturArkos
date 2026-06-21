// Descubre el RUC de la cuenta dev probando endpoints de listado de APISUNAT.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(__dirname, '../apps/api/.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"\n]*)"?/);
  if (m) env[m[1]] = m[2];
}
const BASE = env.APISUNAT_BASE_URL || 'https://back.apisunat.com';
const personaId = env.APISUNAT_PERSONA_ID;
const personaToken = env.APISUNAT_TOKEN;

async function txt(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}

const probes = [
  { m: 'POST', url: `${BASE}/personas/v1/getLastDocument`, body: { personaId, personaToken } },
  { m: 'POST', url: `${BASE}/personas/v1/lastDocument`, body: { personaId, personaToken } },
  { m: 'POST', url: `${BASE}/personas/v1/listDocuments`, body: { personaId, personaToken } },
  { m: 'POST', url: `${BASE}/personas/v1/getDocuments`, body: { personaId, personaToken } },
  { m: 'GET', url: `${BASE}/personas/${personaId}`, headers: { 'x-api-key': personaToken } },
  { m: 'GET', url: `${BASE}/personas/${personaId}/info?token=${personaToken}` },
];

for (const p of probes) {
  try {
    const res = await fetch(p.url, {
      method: p.m,
      headers: { 'Content-Type': 'application/json', ...(p.headers || {}) },
      body: p.m === 'POST' ? JSON.stringify(p.body) : undefined,
    });
    const body = await txt(res);
    const s = typeof body === 'string' ? body : JSON.stringify(body);
    console.log(`\n[${p.m} ${p.url.replace(BASE, '')}] → ${res.status}`);
    console.log(s.slice(0, 300));
  } catch (e) {
    console.log(`\n[${p.m} ${p.url.replace(BASE, '')}] → ERROR ${e.message}`);
  }
}
