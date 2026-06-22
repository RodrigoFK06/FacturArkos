import { test, expect } from '@playwright/test';
import { loginAs, uniq } from './helpers';

/** Código de 4 dígitos aleatorio para el anexo SUNAT. */
function randomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

test.describe('Configuración — establecimientos (sucursales)', () => {
  test('la página carga con su encabezado', async ({ page }) => {
    await loginAs(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
  });

  test('crear y editar una sucursal', async ({ page }) => {
    await loginAs(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

    // Localizar el panel "Establecimientos (sucursales)".
    const panel = page
      .locator('.panel')
      .filter({ has: page.getByRole('heading', { name: 'Establecimientos (sucursales)' }) })
      .first();
    await expect(panel).toBeVisible();

    // Abrir el formulario de alta.
    await panel.getByRole('button', { name: 'Nueva sucursal' }).click();

    const code = randomCode();
    const name = uniq('Sucursal E2E');
    await page.getByLabel('Código (4 dígitos)').fill(code);
    await page.getByLabel('Nombre').fill(name);
    await page.getByRole('button', { name: 'Crear sucursal' }).click();

    // Aparece en la tabla del panel.
    const row = panel.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('cell', { name: new RegExp(code) })).toBeVisible();

    // Editarla: renombrar y guardar.
    await row.getByRole('button', { name: 'Editar' }).click();
    const renamed = uniq('Sucursal E2E ed');
    await page.getByLabel('Nombre').fill(renamed);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(panel.getByRole('row', { name: new RegExp(renamed) })).toBeVisible({ timeout: 15_000 });
  });
});
