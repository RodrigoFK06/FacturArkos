/**
 * Smoke completo paso a paso contra la API local (http://localhost:3001/api).
 * Cubre el ciclo de cada módulo nuevo: catálogo, listas de precios, clientes,
 * proveedores, almacenes, establecimientos, usuarios, venta+anulación, cotización
 * y recurrente. No toca SUNAT en vivo (la venta no emite).
 *
 *   node scripts/smoke-full.mjs
 *
 * Requiere: API arriba y DB con el esquema actual (prisma db push).
 */
const BASE = process.env.API ?? 'http://localhost:3001/api';
const DEMO = { email: 'demo@facturarkos.pe', password: 'password123' };
const tag = `SMK-${Date.now().toString(36)}`;

let token = '';
let pass = 0;
let fail = 0;
let n = 0;

async function api(method, path, body, { expectStatus } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (expectStatus && res.status !== expectStatus) {
    throw new Error(`esperaba ${expectStatus}, recibió ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!expectStatus && !res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

async function step(name, fn) {
  n++;
  try {
    const detail = await fn();
    pass++;
    console.log(`  ✓ PASO ${n}: ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (e) {
    fail++;
    console.log(`  ✗ PASO ${n}: ${name} — ${e.message}`);
  }
}

const sum = (arr) => arr.reduce((a, s) => a + Number(s.quantity ?? 0), 0);

(async () => {
  console.log(`\n=== SMOKE COMPLETO FacturArkos (${tag}) ===\n`);

  await step('Login demo (OWNER)', async () => {
    const r = await api('POST', '/auth/login', DEMO);
    token = r.access_token;
    if (!token) throw new Error('sin token');
    return r.user.email;
  });
  await step('GET /auth/me', async () => (await api('GET', '/auth/me')).email);
  await step('GET /organization', async () => (await api('GET', '/organization')).razonSocial);

  // ── Catálogo: categorías ──
  let catId;
  await step('Crear categoría', async () => { catId = (await api('POST', '/categories', { name: `${tag} Cat` })).id; return catId; });
  await step('Renombrar categoría (PATCH)', async () => api('PATCH', `/categories/${catId}`, { name: `${tag} Cat2` }));
  await step('Ocultar categoría', async () => api('PATCH', `/categories/${catId}`, { active: false }));
  await step('Listar categorías ?all=1 incluye la oculta', async () => {
    const all = await api('GET', '/categories?all=1');
    if (!all.find((c) => c.id === catId)) throw new Error('no aparece la oculta');
    return `${all.length} categorías`;
  });
  await step('Reactivar categoría', async () => api('PATCH', `/categories/${catId}`, { active: true }));

  // ── Catálogo: productos ──
  let prodId;
  await step('Crear producto (con minStock)', async () => {
    const p = await api('POST', '/products', { name: `${tag} Prod`, price: 11.8, cost: 5, minStock: 3, categoryId: catId });
    prodId = p.id;
    if (Number(p.minStock) !== 3) throw new Error('minStock no persistió');
    return `${prodId} minStock=${p.minStock}`;
  });
  await step('Editar producto (precio)', async () => {
    const p = await api('PATCH', `/products/${prodId}`, { price: 23.6 });
    if (Number(p.price) !== 23.6) throw new Error('precio no cambió');
    return `precio=${p.price}`;
  });
  await step('Ocultar y reactivar producto', async () => {
    await api('PATCH', `/products/${prodId}`, { active: false });
    await api('PATCH', `/products/${prodId}`, { active: true });
  });

  // ── Listas de precios ──
  let listId;
  await step('Crear lista de precios (mayorista)', async () => { listId = (await api('POST', '/price-lists', { name: `${tag} Mayorista` })).id; return listId; });
  await step('Fijar precio del producto en la lista', async () => api('PUT', `/price-lists/${listId}/prices`, { prices: [{ productId: prodId, price: 18 }] }));
  await step('GET /products?priceListId usa el precio de la lista', async () => {
    const ps = await api('GET', `/products?priceListId=${listId}`);
    const mine = ps.find((p) => p.id === prodId);
    if (Number(mine.price) !== 18) throw new Error(`esperaba 18, fue ${mine.price}`);
    return `precio lista=${mine.price}`;
  });

  // ── Clientes ──
  let custId;
  await step('Crear cliente', async () => { custId = (await api('POST', '/customers', { identityType: 'DNI', documentNumber: `4${Math.floor(Math.random() * 9e6 + 1e6)}`, name: `${tag} Cliente` })).id; return custId; });
  await step('Editar cliente (PATCH)', async () => api('PATCH', `/customers/${custId}`, { phone: '999888777' }));
  await step('Ocultar cliente y verlo con ?all=1', async () => {
    await api('PATCH', `/customers/${custId}`, { active: false });
    const all = await api('GET', '/customers?all=1');
    if (!all.find((c) => c.id === custId)) throw new Error('no aparece oculto');
    await api('PATCH', `/customers/${custId}`, { active: true });
  });

  // ── Proveedores ──
  await step('Crear y editar proveedor', async () => {
    const ruc = `20${Math.floor(Math.random() * 9e8 + 1e8)}`;
    const s = await api('POST', '/suppliers', { ruc, businessName: `${tag} Proveedor` });
    await api('PATCH', `/suppliers/${s.id}`, { phone: '012345678' });
    await api('PATCH', `/suppliers/${s.id}`, { active: false });
    return s.id;
  });

  // ── Almacenes ──
  await step('Crear y editar almacén; el principal no se desactiva', async () => {
    const w = await api('POST', '/inventory/warehouses', { name: `${tag} Depósito` });
    await api('PATCH', `/inventory/warehouses/${w.id}`, { name: `${tag} Depósito 2` });
    const whs = await api('GET', '/inventory/warehouses?all=1');
    const main = whs.find((x) => x.isMain);
    if (main) await api('PATCH', `/inventory/warehouses/${main.id}`, { active: false }, { expectStatus: 400 });
    return `${whs.length} almacenes`;
  });

  // ── Establecimientos ──
  await step('Crear y editar establecimiento', async () => {
    const code = String(Math.floor(Math.random() * 9000 + 1000));
    const e = await api('POST', '/establishments', { code, name: `${tag} Sucursal` });
    await api('PATCH', `/establishments/${e.id}`, { name: `${tag} Sucursal Centro` });
    return e.code;
  });

  // ── Usuarios ──
  await step('Crear usuario, editar rol y NO poder tocar al OWNER', async () => {
    const email = `${tag.toLowerCase()}@demo.pe`;
    const u = await api('POST', '/users', { name: `${tag} User`, email, password: 'password123', role: 'CASHIER' });
    await api('PATCH', `/users/${u.id}`, { role: 'MANAGER' });
    const users = await api('GET', '/users');
    const owner = users.find((x) => x.role === 'OWNER');
    if (owner) await api('PATCH', `/users/${owner.id}`, { active: false }, { expectStatus: 400 });
    return `${users.length} usuarios`;
  });

  // ── Venta + anulación (repone stock) ──
  await step('Venta en efectivo descuenta stock y anular lo repone', async () => {
    const est = (await api('GET', '/establishments'))[0];
    const before = sum(await api('GET', `/inventory/stock`).then((s) => s.filter((x) => x.product?.name === undefined ? false : true)).catch(() => [])); // no usado; medimos por kardex
    const kardexBefore = (await api('GET', `/inventory/kardex/${prodId}`)).balance;
    const sale = await api('POST', '/orders', {
      establishmentId: est.id,
      items: [{ productId: prodId, name: `${tag} Prod`, quantity: 2, unitPrice: 10 }],
      payments: [{ method: 'CASH', amount: 20 }],
    });
    const orderId = sale.order.id;
    const kardexMid = (await api('GET', `/inventory/kardex/${prodId}`)).balance;
    if (kardexMid !== kardexBefore - 2) throw new Error(`stock no bajó: ${kardexBefore}→${kardexMid}`);
    await api('POST', `/orders/${orderId}/cancel`, { reason: 'smoke' });
    const kardexAfter = (await api('GET', `/inventory/kardex/${prodId}`)).balance;
    if (kardexAfter !== kardexBefore) throw new Error(`stock no se repuso: ${kardexAfter} != ${kardexBefore}`);
    return `stock ${kardexBefore}→${kardexMid}→${kardexAfter} (ok)`;
  });

  // ── Cotización: crear → anular ──
  await step('Cotización: crear y anular', async () => {
    const c = await api('POST', '/commercial', { kind: 'COTIZACION', customerName: `${tag} Cliente`, items: [{ name: 'Servicio', quantity: 1, unitPrice: 100 }] });
    const x = await api('POST', `/commercial/${c.id}/cancel`, {});
    if (x.status !== 'ANULADA') throw new Error('no quedó ANULADA');
    return `${c.series}-${c.number}`;
  });

  // ── Recurrente: crear → editar ──
  await step('Recurrente: crear y editar (reemplaza ítems)', async () => {
    const plan = await api('POST', '/recurring', { name: `${tag} Plan`, customerId: custId, documentType: 'BOLETA', frequency: 'MONTHLY', items: [{ name: 'Mensualidad', quantity: 1, unitPrice: 50 }] });
    const upd = await api('PATCH', `/recurring/${plan.id}`, { name: `${tag} Plan 2`, items: [{ name: 'Mensualidad Pro', quantity: 1, unitPrice: 80 }] });
    if (upd.items.length !== 1 || Number(upd.items[0].unitPrice) !== 80) throw new Error('no reemplazó ítems');
    return upd.name;
  });

  console.log(`\n=== RESULTADO: ${pass}/${n} pasos OK${fail ? `, ${fail} fallaron` : ''} ===\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
