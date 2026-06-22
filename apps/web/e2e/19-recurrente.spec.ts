import { test, expect } from '@playwright/test';
import { loginAs, uniq, API } from './helpers';

test.describe('Facturación recurrente', () => {
  test('la página de recurrente carga', async ({ page }) => {
    await loginAs(page);
    await page.goto('/recurrente');
    await expect(page.getByRole('heading', { name: 'Facturación recurrente' })).toBeVisible();
    await expect(page.getByRole('button', { name: /nuevo plan/i }).first()).toBeVisible();
  });

  test('crear un plan y luego editar su nombre', async ({ page }) => {
    const { token } = await loginAs(page);

    // Asegura que exista un cliente para el <select> (se llena de /customers).
    const ctx = page.request;
    const auth = { Authorization: `Bearer ${token}` };
    const list = await ctx.get(`${API}/customers`, { headers: auth });
    const customers = list.ok() ? await list.json() : [];
    if (!Array.isArray(customers) || customers.length === 0) {
      await ctx.post(`${API}/customers`, {
        headers: auth,
        data: {
          name: uniq('Cliente Rec'),
          identityType: 'DNI',
          documentNumber: String(Math.floor(10_000_000 + Math.random() * 89_999_999)),
        },
      });
    }

    const planName = uniq('Plan Rec');
    const planRenamed = uniq('Plan Editado');

    await page.goto('/recurrente');
    await expect(page.getByRole('heading', { name: 'Facturación recurrente' })).toBeVisible();

    // Abre el panel de creación.
    await page.getByRole('button', { name: /nuevo plan/i }).first().click();

    const panel = page.locator('.panel').filter({ hasText: 'Nuevo plan recurrente' });
    await expect(panel).toBeVisible();

    await panel.getByLabel('Nombre del plan').fill(planName);

    // Selecciona el primer cliente disponible del select (índice 1; el 0 es "Selecciona…").
    const customerSelect = panel.getByLabel('Cliente');
    await customerSelect.selectOption({ index: 1 });

    // Un ítem.
    await panel.getByPlaceholder('Descripción').first().fill('Servicio mensual');
    await panel.getByPlaceholder('Cant.').first().fill('1');
    await panel.getByPlaceholder('P. unit.').first().fill('50');

    await panel.getByRole('button', { name: /crear plan/i }).click();

    // Aparece en la tabla.
    const row = page.getByRole('row', { name: planName });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Editar esa fila.
    await row.getByRole('button', { name: /editar/i }).click();

    const editPanel = page.locator('.panel').filter({ hasText: 'Editar plan recurrente' });
    await expect(editPanel).toBeVisible();

    const nameInput = editPanel.getByLabel('Nombre del plan');
    await nameInput.fill(planRenamed);
    await editPanel.getByRole('button', { name: /guardar cambios/i }).click();

    // El nuevo nombre aparece en la tabla.
    await expect(page.getByRole('row', { name: planRenamed })).toBeVisible({ timeout: 15_000 });
  });
});
