// Smoke de las 4 features "aplastar competencia": cobranzas, recurrente, yape/plin, portal.
const BASE = 'http://localhost:3001/api';
async function j(p, o = {}, t) {
  const r = await fetch(BASE + p, { ...o, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(o.headers || {}) } });
  const x = await r.text(); let b; try { b = JSON.parse(x); } catch { b = x; }
  if (!r.ok) throw new Error(`${p} → ${r.status}: ${typeof b === 'string' ? b : JSON.stringify(b)}`);
  return b;
}
const post = (p, b, t) => j(p, { method: 'POST', body: JSON.stringify(b) }, t);
const get = (p, t) => j(p, {}, t);

(async () => {
  const login = await post('/auth/login', { email: 'demo@facturarkos.pe', password: 'password123' });
  const t = login.access_token;
  const orgId = login.user.organizationId;
  console.log('1. login OK, org', orgId);

  // Yape/Plin config
  await j('/organization', { method: 'PATCH', body: JSON.stringify({ yapeNumber: '999888777', plinNumber: '999111222' }) }, t);
  const info = await get(`/store/${orgId}/info`);
  console.log('2. store info yape:', JSON.stringify(info.yape), 'plin:', JSON.stringify(info.plin));

  // Establecimiento + cliente para venta a crédito
  const ests = await get('/establishments', t);
  const cust = await post('/customers', { identityType: 'DNI', documentNumber: '40404040', name: 'Cliente Crédito' }, t);

  // Venta al crédito (sin pago, con dueDate) → queda por cobrar
  const due = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // venció ayer
  const sale = await post('/orders', {
    establishmentId: ests[0].id, customerId: cust.id, dueDate: due,
    items: [{ name: 'Servicio a crédito', quantity: 1, unitPrice: 118 }],
  }, t);
  console.log('3. venta a crédito:', sale.order.status, 'total', sale.order.total);

  const rec = await get('/receivables', t);
  console.log('4. cobranzas → totalPorCobrar', rec.totalPorCobrar, 'vencido', rec.vencido, 'cuentas', rec.cuentas.length);

  // Registrar un abono parcial
  const pay = await post(`/receivables/${sale.order.id}/payment`, { method: 'YAPE', amount: 50 }, t);
  console.log('5. abono YAPE 50 → saldo', pay.saldo);

  // Facturación recurrente (boleta para no requerir RUC), emitir ahora
  const plan = await post('/recurring', {
    name: 'Mensualidad demo', customerId: cust.id, documentType: 'BOLETA', frequency: 'MONTHLY',
    series: 'B0' + (10 + Math.floor((Date.now() / 1000) % 80)),
    items: [{ name: 'Plan mensual', quantity: 1, unitPrice: 59 }],
  }, t);
  console.log('6. plan recurrente creado:', plan.name, 'próxima', plan.nextRunAt?.slice(0, 10));
  const run = await post(`/recurring/${plan.id}/run`, {}, t);
  console.log('   run → orden', run.order?.status, 'comprobante', run.invoice ? run.invoice.series + '-' + run.invoice.number + ' (' + run.invoice.status + ')' : 'sin emitir');

  // Portal del cliente (público): comprobantes del cliente por documento
  const portal = await get(`/store/${orgId}/comprobantes?doc=40404040`);
  console.log('7. portal cliente → negocio', portal.negocio, 'comprobantes', portal.comprobantes.length);

  console.log('\n✅ smoke-crush completado');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
