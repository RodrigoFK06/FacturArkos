// Smoke del flujo de pedidos online + fulfillment.
// Uso: node scripts/smoke-pedidos.mjs   (API en :3001)

const BASE = process.env.API_URL ?? 'http://localhost:3001/api';
const EMAIL = process.env.SMOKE_EMAIL ?? 'demo@facturarkos.pe';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'password123';

let token = '';
async function call(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data && data.message ? (Array.isArray(data.message) ? data.message.join(', ') : data.message) : text;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;

async function main() {
  const auth = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD }, auth: false });
  token = auth.accessToken ?? auth.token ?? auth.access_token;
  console.log(ok('✓ login'));

  const org = await call('/organization');
  const products = await call('/store/' + org.id + '/products', { auth: false });
  if (!products.length) throw new Error('No hay productos para pedir');

  // 1. Crear pedido online (público)
  const created = await call('/store/' + org.id + '/orders', {
    method: 'POST', auth: false,
    body: { customerName: 'Juan Pérez', phone: '999111222', address: 'Av. Siempre Viva 742', items: [{ productId: products[0].id, quantity: 2 }] },
  });
  console.log(ok('✓ pedido online creado'), created.orderId, '·', `S/ ${created.total}`);

  // 2. Aparece en el tablero
  let online = await call('/orders/online');
  const mine = online.find((o) => o.id === created.orderId);
  console.log(mine ? ok('✓ aparece en /orders/online') : bad('✗ no aparece'), `fulfillment=${mine?.fulfillmentStatus} contacto=${mine?.contactName}`);

  // 3. Avanzar PENDING → PREPARING → READY → DELIVERED
  for (const st of ['PREPARING', 'READY', 'DELIVERED']) {
    const u = await call(`/orders/${created.orderId}/fulfillment`, { method: 'PATCH', body: { status: st } });
    console.log(ok('  →'), u.fulfillmentStatus);
  }

  // 4. Registrar pago
  const pay = await call(`/receivables/${created.orderId}/payment`, { method: 'POST', body: { method: 'CASH', amount: Number(created.total) } });
  console.log(ok('✓ pago registrado'), `estado orden=${pay.status ?? pay.order?.status ?? '?'}`);

  // 5. Emitir boleta
  const inv = await call(`/invoices/emit/${created.orderId}`, { method: 'POST', body: { documentType: 'BOLETA' } });
  console.log(inv.status === 'ACCEPTED' ? ok('✓ boleta emitida') : bad(`✗ boleta (${inv.status})`), `${inv.series}-${inv.number} · ${inv.status}`, inv.status === 'REJECTED' ? `\n   ${inv.sunatMessage}` : '');

  console.log('\nResumen: pedido', created.orderId, '→ entregado, pagado, comprobante', `${inv.series}-${inv.number} (${inv.status})`);
}
main().catch((e) => { console.error(bad('ERROR'), e.message); process.exit(1); });
