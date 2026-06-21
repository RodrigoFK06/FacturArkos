// Valida emisión de FACTURA contra SUNAT (dev). Factura requiere cliente con RUC.
const BASE = 'http://localhost:3001/api';
async function j(r){ const t=await r.text(); try{return JSON.parse(t);}catch{return t;} }

(async () => {
  const l = await (await fetch(`${BASE}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:'demo@facturarkos.pe', password:'password123' }) })).json();
  const H = { 'Content-Type':'application/json', Authorization:`Bearer ${l.access_token}` };

  // Cliente con RUC (receptor de factura) — RUC real registrado.
  const customer = await (await fetch(`${BASE}/customers`, { method:'POST', headers:H, body: JSON.stringify({ identityType:'RUC', documentNumber:'20100070970', name:'EMPRESA CLIENTE SAC', address:'Av. Cliente 456' }) })).json();
  console.log('cliente:', customer.name, customer.documentNumber);

  const est = await (await fetch(`${BASE}/establishments`, { headers:H })).json();
  const prods = await (await fetch(`${BASE}/products`, { headers:H })).json();
  const items = [{ productId: prods[0].id, name: prods[0].name, quantity: 3, unitPrice: Number(prods[0].price) }];
  const total = items[0].unitPrice * 3;

  const sale = await (await fetch(`${BASE}/orders`, { method:'POST', headers:H, body: JSON.stringify({ establishmentId: est[0].id, customerId: customer.id, items, payments:[{ method:'CASH', amount: Number(total.toFixed(2)) }] }) })).json();
  console.log('venta:', sale.order.id, '· total', sale.order.total);

  // Emitir FACTURA en serie F002 (F001-1 ya existe en la cuenta dev)
  const r = await fetch(`${BASE}/invoices/emit/${sale.order.id}`, { method:'POST', headers:H, body: JSON.stringify({ documentType:'FACTURA', series:'F002' }) });
  const inv = await j(r);
  console.log(`\n=== FACTURA (HTTP ${r.status}) ===`);
  console.log('COMPROBANTE:', inv.series ? `${inv.series}-${String(inv.number).padStart(8,'0')}` : '(error)');
  console.log('ESTADO SUNAT:', inv.status ?? JSON.stringify(inv));
  console.log('OBSERVACIONES:', inv.sunatMessage || '(ninguna — aceptación limpia ✅)');
  if (inv.pdfUrl) console.log('PDF:', inv.pdfUrl);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
