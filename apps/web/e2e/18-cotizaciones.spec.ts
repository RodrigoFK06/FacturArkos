import { test, expect } from '@playwright/test';
import { loginAs, uniq, apiLogin, API } from './helpers';

test.describe('Cotizaciones', () => {
  test('la página de cotizaciones carga', async ({ page }) => {
    await loginAs(page);
    await page.goto('/cotizaciones');
    await expect(page.getByRole('heading', { name: 'Cotizaciones y notas de venta' })).toBeVisible();
    await expect(page.getByRole('button', { name: /cotizaciones/i }).first()).toBeVisible();
  });

  test('crear una cotización y luego anularla', async ({ page }) => {
    const { token } = await loginAs(page);

    // Garantiza que exista al menos un producto para elegir en el ítem.
    const prodName = uniq('Prod Cot');
    const ctx = await page.request;
    await ctx.post(`${API}/products`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: prodName, price: 25 },
    });

    const cliente = uniq('Cliente Cot');
    await page.goto('/cotizaciones');
    await expect(page.getByRole('heading', { name: 'Cotizaciones y notas de venta' })).toBeVisible();

    // Abre el panel de creación.
    await page.getByRole('button', { name: /nueva cotización/i }).click();

    const form = page.locator('form.panel');
    await expect(form).toBeVisible();

    // Cliente (input dentro de <label><span>Cliente</span><input/></label>).
    await form.getByLabel('Cliente').fill(cliente);

    // Primer ítem: elegir el producto recién creado en el <select>.
    const itemRow = form.locator('select').first();
    await itemRow.selectOption({ label: prodName });

    // Cantidad y precio.
    await form.getByPlaceholder('Cant.').first().fill('2');
    await form.getByPlaceholder('Precio').first().fill('25');

    await form.getByRole('button', { name: /crear cotización/i }).click();

    // Aparece en la tabla con estado "Abierta".
    const row = page.getByRole('row', { name: cliente });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Abierta')).toBeVisible();

    // Anular en esa fila — confirma el window.confirm.
    page.on('dialog', (d) => d.accept(''));
    await row.getByRole('button', { name: /anular/i }).click();

    // El estado cambia a "Anulada".
    const anuladaRow = page.getByRole('row', { name: cliente });
    await expect(anuladaRow.getByText('Anulada')).toBeVisible({ timeout: 15_000 });
  });
});
