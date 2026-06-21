// Smoke test de las features nuevas: emisión masiva, print (logo/pie), WhatsApp store.
const BASE = 'http://localhost:3001/api';

async function j(path, opts = {}, token) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

const post = (p, b, t) => j(p, { method: 'POST', body: JSON.stringify(b) }, t);
const patch = (p, b, t) => j(p, { method: 'PATCH', body: JSON.stringify(b) }, t);
const get = (p, t) => j(p, {}, t);

(async () => {
  // 1. Login
  const login = await post('/auth/login', { email: 'demo@facturarkos.pe', password: 'password123' });
  const token = login.accessToken ?? login.access_token ?? login.token;
  console.log('1. login OK, token?', !!token);

  const me = await get('/auth/me', token);
  const orgId = me.organizationId ?? me.organization?.id;
  console.log('   orgId:', orgId);

  // 2. PATCH organization (whatsapp + logo + pie)
  const org = await patch('/organization', {
    whatsapp: '51999111222',
    logoUrl: 'https://dummyimage.com/200x80/0071e3/fff&text=MiNegocio',
    pdfFooter: 'Gracias por su compra · Tel. 999 111 222 · ventas@minegocio.pe',
  }, token);
  console.log('2. org actualizada → whatsapp:', org.whatsapp, '| pdfFooter set?', !!org.pdfFooter);

  // 3. Establecimientos
  const ests = await get('/establishments', token);
  const establishmentId = ests[0].id;
  console.log('3. establecimiento:', ests[0].code, ests[0].name);

  // 4. Emisión masiva (1 boleta DNI + 1 boleta clientes varios), serie fresca para evitar reuse
  const serie = 'B0' + (50 + Math.floor((Date.now() / 1000) % 40)); // B050..B089 pseudo-fresca
  const bulk = await post('/orders/bulk', {
    establishmentId,
    documents: [
      {
        documentType: 'BOLETA',
        series: serie,
        customerDocType: 'DNI',
        customerDoc: '44556677',
        customerName: 'María López',
        items: [
          { name: 'Producto masivo A', quantity: 2, unitPrice: 15 },
          { name: 'Producto masivo B', quantity: 1, unitPrice: 30 },
        ],
      },
      {
        documentType: 'BOLETA',
        series: serie,
        items: [{ name: 'Venta rápida', quantity: 1, unitPrice: 10 }],
      },
    ],
  }, token);
  console.log('4. emisión masiva → total:', bulk.total, '| ok:', bulk.ok, '| failed:', bulk.failed);
  for (const r of bulk.results) {
    console.log(`   fila ${r.row}: ${r.series ?? '-'}-${r.number ?? '-'} estado=${r.status ?? 'ERROR'} ${r.error ? '· ' + r.error : ''}`);
  }

  // 5. Buscar un comprobante reciente y probar /print
  const invoices = await get('/invoices', token);
  const inv = invoices[0];
  if (inv) {
    const printData = await get(`/invoices/${inv.id}/print`, token);
    console.log('5. print', inv.series + '-' + inv.number,
      '→ org.logo?', !!printData.org.logoUrl,
      '| org.pie?', !!printData.org.pdfFooter,
      '| items:', printData.items.length,
      '| total:', printData.invoice.total);
  } else {
    console.log('5. print: no hay comprobantes para probar');
  }

  // 6. Store info público con whatsapp
  const info = await get(`/store/${orgId}/info`);
  console.log('6. store info → name:', info.name, '| whatsapp:', info.whatsapp);

  console.log('\\n✅ smoke-features completado');
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
