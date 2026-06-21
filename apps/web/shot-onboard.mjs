import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@facturarkos.pe');
await page.fill('input[type=password]', 'password123');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });
await page.waitForTimeout(2400); // el tour auto-inicia en contexto nuevo
await page.screenshot({ path: 'C:/Trabajo/Clientes/FacturArkos/shots/tour.png' });

await page.goto('http://localhost:3000/bienvenida', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'C:/Trabajo/Clientes/FacturArkos/shots/wizard.png' });
const emp = page.locator('button:has-text("Empecemos")');
if (await emp.count()) { await emp.click(); await page.waitForTimeout(900); await page.screenshot({ path: 'C:/Trabajo/Clientes/FacturArkos/shots/wizard2.png' }); }

await browser.close();
console.log('OK');
