import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await p.fill('input[type=email]', 'demo@facturarkos.pe');
await p.fill('input[type=password]', 'password123');
await p.click('button[type=submit]');
await p.waitForURL('**/dashboard', { timeout: 20000 });

await p.goto('http://localhost:3000/clientes', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.screenshot({ path: 'C:/Trabajo/Clientes/FacturArkos/shots/clientes.png' });

await p.goto('http://localhost:3000/caja', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
// abrir caja si está cerrada
const abrir = p.locator('button:has-text("Abrir caja")');
if (await abrir.count()) {
  const inp = p.locator('input[type=number]').first();
  await inp.fill('100');
  await abrir.click();
  await p.waitForTimeout(1500);
}
await p.screenshot({ path: 'C:/Trabajo/Clientes/FacturArkos/shots/caja.png' });
await b.close();
console.log('OK');
