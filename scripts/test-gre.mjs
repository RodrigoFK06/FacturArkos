// Valida emisión de GRE (Guía de Remisión Electrónica remitente) contra SUNAT.
const BASE = 'http://localhost:3001/api';
async function j(r) { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } }

(async () => {
  const l = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@facturarkos.pe', password: 'password123' }) })).json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${l.access_token}` };

  const r = await fetch(`${BASE}/gre`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      series: 'T002',
      receiverDocType: 'RUC', receiverDoc: '20100070970', receiverName: 'CLIENTE DESTINO SAC',
      transferReason: '01',
      totalWeight: 15, weightUnit: 'KGM',
      originUbigeo: '150101', originAddress: 'Av. Origen 123, Lima',
      destUbigeo: '150101', destAddress: 'Av. Destino 456, Lima',
      transport: { mode: '01', carrierRuc: '20100070970', carrierName: 'TRANSPORTES DEMO SAC', carrierMtc: '1234567890' },
      items: [{ description: 'Mercadería de prueba', quantity: 5, unitCode: 'NIU' }],
    }),
  });
  const g = await j(r);
  console.log(`=== GRE (HTTP ${r.status}) ===`);
  console.log('COMPROBANTE:', g.series ? `${g.series}-${String(g.number).padStart(8, '0')}` : JSON.stringify(g));
  console.log('ESTADO SUNAT:', g.status ?? '-');
  console.log('OBSERVACIONES:', g.sunatMessage || '(ninguna — aceptación limpia ✅)');
  if (g.pdfUrl) console.log('PDF:', g.pdfUrl);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
