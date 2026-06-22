import { test, expect } from '@playwright/test';
import { loginAs, uniq } from './helpers';

test.describe('Inventario — almacenes', () => {
  test('la página carga con su encabezado', async ({ page }) => {
    await loginAs(page);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
  });

  test('crear y editar un almacén desde el panel "Almacenes"', async ({ page }) => {
    await loginAs(page);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();

    // Abrir el panel de gestión de almacenes (botón del encabezado).
    await page.getByRole('button', { name: 'Almacenes' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo almacén' })).toBeVisible();

    // Crear un almacén con nombre único.
    const name = uniq('Almacén E2E');
    await page.getByLabel('Nombre').fill(name);
    await page.getByRole('button', { name: 'Crear almacén' }).click();

    // Aparece en la tabla del panel.
    const row = page.getByRole('row', { name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Editarlo: renombrar y guardar.
    await row.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar almacén' })).toBeVisible();

    const renamed = uniq('Almacén E2E ed');
    await page.getByLabel('Nombre').fill(renamed);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByRole('row', { name: renamed })).toBeVisible({ timeout: 15_000 });
  });

  test('el almacén principal muestra badge "Principal" y no ofrece ocultar', async ({ page }) => {
    await loginAs(page);
    await page.goto('/inventory');
    await page.getByRole('button', { name: 'Almacenes' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo almacén' })).toBeVisible();

    // La fila de gestión del almacén principal: contiene "Principal" y el botón
    // "Editar" (filtramos por Editar para no agarrar filas de la tabla de stock).
    const mainRow = page
      .getByRole('row')
      .filter({ hasText: 'Principal' })
      .filter({ has: page.getByRole('button', { name: 'Editar' }) })
      .first();
    await expect(mainRow).toBeVisible({ timeout: 15_000 });
    // El principal NO se puede ocultar (regla del backend).
    await expect(mainRow.getByRole('button', { name: 'Ocultar' })).toHaveCount(0);
  });
});
