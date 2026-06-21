import { chromium } from 'playwright';
const ORG = process.argv[2] || 'cmqlwd7sw0000iaacgfc86vgy';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/tienda/' + ORG, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const btns = page.locator('button:has-text("Agregar")');
const n = await btns.count();
if (n > 0) { await btns.nth(0).click(); await btns.nth(0).click(); }
if (n > 1) await btns.nth(1).click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'C:/Trabajo/Clientes/FacturArkos/shots/tienda.png' });
await browser.close();
console.log('OK');
