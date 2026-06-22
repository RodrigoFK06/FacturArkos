import { test, expect, request } from '@playwright/test';
import { apiLogin, loginAs, API } from './helpers';

/** Formatea un importe igual que el helper `money` de la UI (es-PE, 2 decimales). */
function money(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

test.describe('Ventas — listado y anulación', () => {
  test('la página carga con su encabezado y muestra tabla o estado vacío', async ({ page }) => {
    await loginAs(page);
    await page.goto('/ventas');
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible();

    // O bien hay una tabla de ventas, o bien el EmptyState "Aún no hay ventas".
    const table = page.locator('table.table');
    const empty = page.getByText('Aún no hay ventas');
    await expect(table.or(empty).first()).toBeVisible({ timeout: 15_000 });
  });

  test('anular una venta creada vía API', async ({ page }) => {
    const { token } = await apiLogin();
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    // Datos reales necesarios para crear una orden.
    const estRes = await ctx.get(`${API}/establishments`);
    expect(estRes.ok(), `GET establishments (${estRes.status()})`).toBeTruthy();
    const establishments = (await estRes.json()) as Array<{ id: string }>;
    expect(establishments.length, 'debe existir al menos un establecimiento').toBeGreaterThan(0);
    const establishmentId = establishments[0].id;

    const prodRes = await ctx.get(`${API}/products`);
    expect(prodRes.ok(), `GET products (${prodRes.status()})`).toBeTruthy();
    const products = (await prodRes.json()) as Array<{ id: string; name: string; price: string | number }>;
    expect(products.length, 'debe existir al menos un producto').toBeGreaterThan(0);
    const product = products[0];
    const unitPrice = Number(product.price);

    // Cantidad "única" para obtener un total distintivo y poder ubicar la fila.
    const quantity = 1 + Math.floor(Math.random() * 7);

    const orderRes = await ctx.post(`${API}/orders`, {
      data: {
        establishmentId,
        items: [{ productId: product.id, name: product.name, quantity, unitPrice }],
        payments: [{ method: 'CASH', amount: Number((unitPrice * quantity).toFixed(2)) }],
      },
    });
    expect(orderRes.ok(), `POST orders (${orderRes.status()}): ${await orderRes.text()}`).toBeTruthy();
    // createSale responde { order, invoice? } — el total vive en .order.
    const order = ((await orderRes.json()) as { order: { id: string; total: number | string } }).order;
    await ctx.dispose();

    const totalText = money(Number(order.total));

    // Cargar la UI de ventas y ubicar la fila por su total.
    await loginAs(page);
    await page.goto('/ventas');
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible();

    // La fila de nuestra venta: contiene el total formateado y el botón "Anular".
    const row = page
      .getByRole('row')
      .filter({ hasText: totalText })
      .filter({ has: page.getByRole('button', { name: 'Anular' }) })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Aceptar el window.prompt ANTES del click.
    page.on('dialog', (d) => d.accept(''));
    await row.getByRole('button', { name: 'Anular' }).click();

    // El estado pasa a "Anulada".
    const anuladaRow = page
      .getByRole('row')
      .filter({ hasText: totalText })
      .filter({ hasText: 'Anulada' })
      .first();
    await expect(anuladaRow).toBeVisible({ timeout: 15_000 });
  });
});
