import { test, expect } from '@playwright/test';
import { loginAs, uniq } from './helpers';

/** RUC válido de 11 dígitos que empieza en 20 (persona jurídica). */
function ruc20(): string {
  let rest = '';
  for (let i = 0; i < 9; i++) rest += Math.floor(Math.random() * 10);
  return `20${rest}`;
}

test.describe('Proveedores (panel en Compras)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/purchases');
    await expect(page.getByRole('heading', { name: 'Compras' })).toBeVisible();
    // Abrir el panel de proveedores desde el botón del encabezado.
    await page.getByRole('button', { name: /proveedores/i }).click();
    await expect(page.getByText('Mostrar ocultos')).toBeVisible();
  });

  test('crear un proveedor nuevo aparece en la tabla', async ({ page }) => {
    const name = uniq('Proveedor E2E');

    await page.getByLabel('RUC').fill(ruc20());
    await page.getByLabel('Razón social').fill(name);
    await page.getByRole('button', { name: /agregar proveedor/i }).click();

    await expect(page.getByRole('cell', { name, exact: false })).toBeVisible({ timeout: 15_000 });
  });

  test('editar el teléfono de un proveedor', async ({ page }) => {
    const name = uniq('Proveedor Edit');
    const phone = `0${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

    await page.getByLabel('RUC').fill(ruc20());
    await page.getByLabel('Razón social').fill(name);
    await page.getByRole('button', { name: /agregar proveedor/i }).click();

    const row = page.getByRole('row', { name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByRole('button', { name: /editar/i }).click();
    await page.getByLabel('Teléfono').fill(phone);
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    await expect(page.getByText(phone)).toBeVisible({ timeout: 15_000 });
  });

  test('ocultar y volver a activar un proveedor', async ({ page }) => {
    const name = uniq('Proveedor Hide');

    await page.getByLabel('RUC').fill(ruc20());
    await page.getByLabel('Razón social').fill(name);
    await page.getByRole('button', { name: /agregar proveedor/i }).click();

    let row = page.getByRole('row', { name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Ocultar -> sale de la vista por defecto.
    await row.getByRole('button', { name: /ocultar/i }).click();
    await expect(page.getByRole('row', { name })).toHaveCount(0, { timeout: 15_000 });

    // Mostrar ocultos -> reaparece como Oculto y se puede activar de nuevo.
    await page.getByRole('checkbox', { name: /mostrar ocultos/i }).check();
    row = page.getByRole('row', { name });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Oculto')).toBeVisible();

    await row.getByRole('button', { name: /activar/i }).click();
    await expect(page.getByRole('row', { name }).getByText('Activo')).toBeVisible({ timeout: 15_000 });
  });
});
