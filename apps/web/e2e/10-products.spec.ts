import { test, expect } from '@playwright/test';
import { loginAs, uniq } from './helpers';

test.describe('Productos — catálogo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
  });

  test('la lista carga y muestra al menos un producto', async ({ page }) => {
    // Esperar a que la tabla se renderice (no el estado vacío ni el skeleton).
    await expect(page.locator('table.table tbody tr').first()).toBeVisible({ timeout: 15_000 });
  });

  test('crear un producto nuevo y verlo en la tabla', async ({ page }) => {
    const name = uniq('Prod E2E');

    await page.getByRole('button', { name: /nuevo producto/i }).click();
    await page.getByLabel('Nombre *').fill(name);
    await page.getByLabel(/precio \(con igv\)/i).fill('19.90');
    await page.getByLabel('Stock mínimo').fill('5');
    await page.getByRole('button', { name: /crear producto/i }).click();

    await expect(page.getByRole('cell', { name })).toBeVisible({ timeout: 15_000 });
  });

  test('editar un producto cambia su precio en la tabla', async ({ page }) => {
    // Primero creamos un producto propio para editarlo sin tocar datos ajenos.
    const name = uniq('Prod Edit');
    await page.getByRole('button', { name: /nuevo producto/i }).click();
    await page.getByLabel('Nombre *').fill(name);
    await page.getByLabel(/precio \(con igv\)/i).fill('10.00');
    await page.getByRole('button', { name: /crear producto/i }).click();

    const row = page.getByRole('row', { name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Editar el precio de esa fila.
    await row.getByRole('button', { name: 'Editar' }).click();
    const priceInput = page.getByLabel(/precio \(con igv\)/i);
    await priceInput.fill('33.30');
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    // El nuevo precio aparece en la fila (la lista se recarga).
    await expect(page.getByRole('row', { name }).getByText('33.30')).toBeVisible({ timeout: 15_000 });
  });

  test('ocultar y reactivar un producto', async ({ page }) => {
    const name = uniq('Prod Hide');
    await page.getByRole('button', { name: /nuevo producto/i }).click();
    await page.getByLabel('Nombre *').fill(name);
    await page.getByLabel(/precio \(con igv\)/i).fill('15.00');
    await page.getByRole('button', { name: /crear producto/i }).click();

    const row = page.getByRole('row', { name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Ocultar: la fila desaparece de la vista por defecto.
    await row.getByRole('button', { name: 'Ocultar' }).click();
    await expect(page.getByRole('row', { name })).toHaveCount(0, { timeout: 15_000 });

    // Mostrar ocultos: vuelve a aparecer con el badge "Oculto".
    await page.getByLabel('Mostrar ocultos').check();
    const hiddenRow = page.getByRole('row', { name });
    await expect(hiddenRow).toBeVisible({ timeout: 15_000 });
    await expect(hiddenRow.getByText('Oculto')).toBeVisible();

    // Reactivar.
    await hiddenRow.getByRole('button', { name: 'Activar' }).click();
    await expect(page.getByRole('row', { name }).getByText('Activo')).toBeVisible({ timeout: 15_000 });
  });

  test('mini-gestor de categorías crea una categoría', async ({ page }) => {
    const catName = uniq('Cat E2E');

    await page.getByRole('button', { name: /categorías/i }).click();
    await page.getByLabel('Nueva categoría').fill(catName);
    await page.getByRole('button', { name: /agregar/i }).click();

    // Aparece como un input editable con el nombre en la lista del gestor.
    await expect(page.locator(`input[value="${catName}"]`)).toBeVisible({ timeout: 15_000 });
  });
});
