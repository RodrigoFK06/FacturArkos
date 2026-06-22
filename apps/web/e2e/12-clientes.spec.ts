import { test, expect } from '@playwright/test';
import { loginAs, uniq } from './helpers';

test.describe('Clientes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/clientes');
    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  });

  test('la lista de clientes carga', async ({ page }) => {
    // Tras cargar ya no se ven los skeletons; se ve la tabla o el estado vacío.
    await expect(page.getByPlaceholder(/buscar por nombre o documento/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /nuevo cliente/i })).toBeVisible();
  });

  test('crear un cliente nuevo aparece en la lista', async ({ page }) => {
    const name = uniq('Cliente E2E');
    const dni = `${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

    await page.getByRole('button', { name: /nuevo cliente/i }).click();
    await page.getByLabel('Tipo de documento').selectOption('DNI');
    await page.getByLabel('Número').fill(dni);
    await page.getByLabel(/nombre \/ razón social/i).fill(name);
    await page.getByRole('button', { name: /guardar cliente/i }).click();

    await expect(page.getByRole('cell', { name })).toBeVisible({ timeout: 15_000 });
  });

  test('editar un cliente actualiza su teléfono', async ({ page }) => {
    const name = uniq('Cliente Edit');
    const dni = `${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const phone = `9${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

    // Alta previa para tener una fila propia que editar.
    await page.getByRole('button', { name: /nuevo cliente/i }).click();
    await page.getByLabel('Número').fill(dni);
    await page.getByLabel(/nombre \/ razón social/i).fill(name);
    await page.getByRole('button', { name: /guardar cliente/i }).click();

    const row = page.getByRole('row', { name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByRole('button', { name: /editar/i }).click();
    await page.getByLabel('Teléfono').fill(phone);
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    await expect(page.getByText(phone)).toBeVisible({ timeout: 15_000 });
  });

  test('ocultar un cliente y verlo con "Mostrar ocultos"', async ({ page }) => {
    const name = uniq('Cliente Hide');
    const dni = `${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

    await page.getByRole('button', { name: /nuevo cliente/i }).click();
    await page.getByLabel('Número').fill(dni);
    await page.getByLabel(/nombre \/ razón social/i).fill(name);
    await page.getByRole('button', { name: /guardar cliente/i }).click();

    const row = page.getByRole('row', { name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Ocultar -> desaparece de la vista por defecto.
    await row.getByRole('button', { name: 'Ocultar' }).click();
    await expect(page.getByRole('row', { name })).toHaveCount(0, { timeout: 15_000 });

    // Con el checkbox vuelve a verse, ahora como Oculto.
    await page.getByRole('checkbox', { name: /mostrar ocultos/i }).check();
    const hidden = page.getByRole('row', { name });
    await expect(hidden).toBeVisible({ timeout: 15_000 });
    await expect(hidden.getByText('Oculto')).toBeVisible();
  });
});
