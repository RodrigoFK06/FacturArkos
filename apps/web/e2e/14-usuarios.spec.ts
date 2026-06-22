import { test, expect } from '@playwright/test';
import { loginAs, uniq } from './helpers';

test.describe('Usuarios', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
  });

  test('la lista de usuarios carga', async ({ page }) => {
    await expect(page.getByRole('button', { name: /nuevo usuario/i })).toBeVisible();
  });

  test('crear un usuario nuevo aparece en la lista', async ({ page }) => {
    const name = uniq('Usuario E2E');
    const email = `${uniq('user')}@e2e.test`.toLowerCase();

    await page.getByRole('button', { name: /nuevo usuario/i }).click();
    await page.getByLabel(/nombre completo/i).fill(name);
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByLabel('Rol').selectOption({ label: 'Cajero' });
    await page.getByRole('button', { name: /crear usuario/i }).click();

    await expect(page.getByRole('cell', { name: email })).toBeVisible({ timeout: 15_000 });
  });

  test('editar el rol de un usuario a Gerente', async ({ page }) => {
    const name = uniq('Usuario Rol');
    const email = `${uniq('rol')}@e2e.test`.toLowerCase();

    await page.getByRole('button', { name: /nuevo usuario/i }).click();
    await page.getByLabel(/nombre completo/i).fill(name);
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill('password123');
    await page.getByLabel('Rol').selectOption({ label: 'Cajero' });
    await page.getByRole('button', { name: /crear usuario/i }).click();

    const row = page.getByRole('row', { name: email });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByRole('button', { name: /editar/i }).click();
    await page.getByLabel('Rol').selectOption({ label: 'Gerente' });
    await page.getByRole('button', { name: /guardar cambios/i }).click();

    await expect(page.getByRole('row', { name: email }).getByText('Gerente')).toBeVisible({ timeout: 15_000 });
  });

  test('la fila del Propietario (OWNER) no ofrece Editar/Desactivar', async ({ page }) => {
    // El propietario se muestra con la etiqueta "Propietario" en lugar de acciones.
    const ownerCell = page.getByRole('cell', { name: 'Propietario', exact: true }).first();
    await expect(ownerCell).toBeVisible({ timeout: 15_000 });

    const ownerRow = page.getByRole('row').filter({ has: ownerCell }).first();
    await expect(ownerRow.getByRole('button', { name: /editar/i })).toHaveCount(0);
    await expect(ownerRow.getByRole('button', { name: /desactivar/i })).toHaveCount(0);
  });
});
