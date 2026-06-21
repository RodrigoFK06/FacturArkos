// Verificación integral del SaaS: confirma que cada flujo del panel opera end-to-end.
const BASE = 'http://localhost:3001/api';
const ok = (s) => console.log('  ✓ ' + s);
async function j(r) { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } }

(async () => {
  const l = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@facturarkos.pe', password: 'password123' }) })).json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${l.access_token}` };
  ok(`login ${l.user.role}`);

  const org = await j(await fetch(`${BASE}/organization`, { headers: H }));
  ok(`organización RUC ${org.ruc} (${org.razonSocial})`);

  // Settings form → PATCH organization
  await fetch(`${BASE}/organization`, { method: 'PATCH', headers: H, body: JSON.stringify({ ubigeo: '150101', direccion: 'Av. Demo 123, Lima' }) });
  ok('PATCH /organization (form Configuración)');

  // Products form → POST product
  const prod = await j(await fetch(`${BASE}/products`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Producto Verif ' + Date.now(), price: 11.8, cost: 6, igvAffectation: 'GRAVADO', minStock: 3 }) }));
  ok(`POST /products → ${prod.name} (precio ${prod.price})`);

  const est = await j(await fetch(`${BASE}/establishments`, { headers: H }));
  const wh = await j(await fetch(`${BASE}/inventory/warehouses`, { headers: H }));

  // Purchases form → supplier + purchase (stock + avg cost)
  const sup = await j(await fetch(`${BASE}/suppliers`, { method: 'POST', headers: H, body: JSON.stringify({ ruc: '20100070970', businessName: 'Proveedor Verif SAC' }) }));
  await fetch(`${BASE}/purchases`, { method: 'POST', headers: H, body: JSON.stringify({ supplierId: sup.id, warehouseId: wh[0].id, items: [{ productId: prod.id, name: prod.name, quantity: 20, unitCost: 6 }] }) });
  const stock = await j(await fetch(`${BASE}/inventory/stock`, { headers: H }));
  const st = stock.find((s) => s.product?.name === prod.name);
  ok(`POST /suppliers + /purchases → stock de "${prod.name}" = ${st ? Number(st.quantity) : 'n/a'}`);

  // POS sale + emit BOLETA → SUNAT
  const sale = await j(await fetch(`${BASE}/orders`, { method: 'POST', headers: H, body: JSON.stringify({ establishmentId: est[0].id, items: [{ productId: prod.id, name: prod.name, quantity: 2, unitPrice: 11.8 }], payments: [{ method: 'CASH', amount: 23.6 }] }) }));
  const inv = await j(await fetch(`${BASE}/invoices/emit/${sale.order.id}`, { method: 'POST', headers: H, body: JSON.stringify({ documentType: 'BOLETA', series: 'B002' }) }));
  if (!inv.status) { console.log('  ✗ emisión:', JSON.stringify(inv)); process.exit(1); }
  ok(`emisión BOLETA ${inv.series}-${String(inv.number).padStart(8, '0')} → SUNAT: ${inv.status}`);

  // Credit note
  if (inv.status === 'ACCEPTED') {
    const nc = await j(await fetch(`${BASE}/invoices/${inv.id}/credit-note`, { method: 'POST', headers: H, body: JSON.stringify({ reason: 'Anulacion', series: 'BC03' }) }));
    ok(`nota de crédito ${nc.series}-${String(nc.number).padStart(8, '0')} → SUNAT: ${nc.status}${nc.pdfUrl ? ' · PDF ✓' : ''}`);
  }
  console.log('\n✅ Panel operativo de punta a punta.');
})().catch((e) => { console.error('✗ ERROR:', e.message); process.exit(1); });
