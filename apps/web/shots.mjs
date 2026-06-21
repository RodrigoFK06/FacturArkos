import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const DIR = 'C:/Trabajo/Clientes/FacturArkos/shots';
mkdirSync(DIR, { recursive: true });

const PAGES = [
  ['/dashboard', 'dashboard'],
  ['/products', 'products'],
  ['/invoices', 'invoices'],
  ['/purchases', 'purchases'],
  ['/reports', 'reports'],
  ['/settings', 'settings'],
  ['/pos', 'pos'],
];

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'demo@facturarkos.pe');
await page.fill('input[type=password]', 'password123');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });
await page.waitForTimeout(1800);

for (const [path, name] of PAGES) {
  await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${DIR}/${name}.png` });
  console.log('shot:', name);
}
await browser.close();
console.log('OK');
