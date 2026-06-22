import { test, expect } from '@playwright/test';
import { loginAs, uniq } from './helpers';

test.describe('Listas de precios', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/listas-precios');
    await expect(page.getByRole('heading', { name: 'Listas de precios' })).toBeVisible();
  });

  test('la página carga', async ({ page }) => {
    await expect(page.getByRole('button', { name: /nueva lista/i })).toBeVisible();
  });

  test('crear una lista la muestra en el listado', async ({ page }) => {
    const name = uniq('Lista E2E');

    await page.getByRole('button', { name: /nueva lista/i }).click();
    await page.getByLabel('Nombre *').fill(name);
    await page.getByRole('button', { name: /crear lista/i }).click();

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test('asignar un precio a un producto muestra el toast de éxito', async ({ page }) => {
    const name = uniq('Lista Precio');

    // Crear la lista; al crearse se selecciona y abre el editor de precios.
    await page.getByRole('button', { name: /nueva lista/i }).click();
    await page.getByLabel('Nombre *').fill(name);
    await page.getByRole('button', { name: /crear lista/i }).click();

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 15_000 });

    // Asegurar que la lista esté seleccionada (el editor de precios aparece).
    await page.getByText(name, { exact: true }).click();
    await expect(page.getByRole('button', { name: /guardar precios/i })).toBeVisible({ timeout: 15_000 });

    // Poner un precio en el primer producto del editor.
    const firstPriceInput = page.locator('table.table tbody tr input[type="number"]').first();
    await expect(firstPriceInput).toBeVisible({ timeout: 15_000 });
    await firstPriceInput.fill('25.00');

    await page.getByRole('button', { name: /guardar precios/i }).click();

    // Toast de éxito.
    await expect(page.getByText('Precios guardados.')).toBeVisible({ timeout: 15_000 });
  });
});
