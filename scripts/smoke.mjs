// e2e completo contra la API real + Postgres real.
// Demuestra: auth multi-tenant → venta (IGV+stock+correlativo) → KPIs → emisión SUNAT → persistencia.
const BASE = process.env.BASE || 'http://localhost:3001/api';
const log = (...a) => console.log(...a);

async function j(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}

async function main() {
  // 1. Login
  let r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@facturarkos.pe', password: 'password123' }),
  });
  if (!r.ok) { log('✗ LOGIN FAIL', r.status, await j(r)); process.exit(1); }
  const { access_token, user } = await r.json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` };
  log('① login OK · rol', user.role, '· org', user.organizationId);

  const est = await j(await fetch(`${BASE}/establishments`, { headers: H }));
  const establishmentId = est[0]?.id;
  const products = await j(await fetch(`${BASE}/products`, { headers: H }));
  log('② catálogo:', products.length, 'productos · establecimiento', est[0]?.code);

  const items = products.slice(0, 2).map((p) => ({ productId: p.id, name: p.name, quantity: 2, unitPrice: Number(p.price) }));
  const total = items.reduce((a, i) => a + i.unitPrice * i.quantity, 0);

  // 2. Venta (sin emitir): prueba IGV + descuento de stock + correlativo + caja
  r = await fetch(`${BASE}/orders`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ establishmentId, items, payments: [{ method: 'CASH', amount: Number(total.toFixed(2)) }] }),
  });
  const saleResp = await j(r);
  const order = saleResp.order ?? saleResp;
  log(`③ venta creada (HTTP ${r.status}) · estado ${order.status} · subtotal ${order.subtotal} · IGV ${order.igv} · total ${order.total}`);

  // 3. Dashboard (agregaciones reales)
  const dash = await j(await fetch(`${BASE}/reports/dashboard`, { headers: H }));
  log('④ dashboard · ventasHoy', JSON.stringify(dash.ventasHoy), '· top', (dash.topProductos || []).map((t) => t.name).join(', '));

  // 4. Emisión SUNAT del comprobante de esa venta
  r = await fetch(`${BASE}/invoices/emit/${order.id}`, {
    method: 'POST', headers: H, body: JSON.stringify({ documentType: 'BOLETA' }),
  });
  const emit = await j(r);
  log(`⑤ emisión (HTTP ${r.status}):`);
  log('   ', typeof emit === 'string' ? emit : JSON.stringify(emit));

  // 5. Stock tras la venta + comprobante persistido
  const stock = await j(await fetch(`${BASE}/inventory/stock`, { headers: H }));
  log('⑥ stock:', stock.map((s) => `${s.product.name}=${Number(s.quantity)}`).join(', ') || '(sin tracking)');
  const invoices = await j(await fetch(`${BASE}/invoices`, { headers: H }));
  log('⑦ comprobantes en BD:', invoices.length, invoices[0] ? `· último ${invoices[0].series}-${invoices[0].number} (${invoices[0].status})` : '');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
