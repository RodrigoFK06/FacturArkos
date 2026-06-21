const BASE = process.env.API_URL ?? 'http://localhost:3001/api';
let token = '';
async function call(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${res.status}: ${data?.message ? (Array.isArray(data.message) ? data.message.join(', ') : data.message) : text}`);
  return data;
}
const base = (mode, series) => ({
  series,
  receiverDocType: 'RUC', receiverDoc: '20512345678', receiverName: 'CLIENTE EMPRESA SAC',
  transferReason: '01', totalWeight: 10, weightUnit: 'KGM',
  originAddress: 'Av. Origen 100, Lima', originUbigeo: '150101',
  destAddress: 'Av. Destino 200, Lima', destUbigeo: '150101',
  transport: mode === '01'
    ? { mode: '01', carrierRuc: '20100070970', carrierName: 'TRANSPORTES SAC', carrierMtc: '1234567', plate: 'ABC123' }
    : { mode: '02', plate: 'XYZ789', driverDocType: 'DNI', driverDoc: '40404040', driverName: 'Carlos', driverFamilyName: 'Conductor Pérez', driverLicense: 'Q40404040' },
  items: [{ description: 'Mercadería', quantity: 5, unitCode: 'NIU' }],
});
async function main() {
  const auth = await call('/auth/login', { method: 'POST', body: { email: 'demo@facturarkos.pe', password: 'password123' }, auth: false });
  token = auth.access_token ?? auth.accessToken ?? auth.token;
  for (const [mode, series] of [['01', 'T971'], ['02', 'T972']]) {
    try {
      const g = await call('/gre', { method: 'POST', body: base(mode, series) });
      console.log(`modo ${mode}:`, g.status, `${g.series}-${g.number}`, g.sunatMessage ? `· ${g.sunatMessage}` : '');
    } catch (e) {
      console.log(`modo ${mode}: ERROR`, e.message);
    }
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
