import { test, expect } from '@playwright/test';
import { loginAs, uniq } from './helpers';

test.describe('Núcleo — auth, panel y catálogo', () => {
  test('la landing pública carga y ofrece registrarse/ingresar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/registro"], a[href="/login"]').first()).toBeVisible();
  });

  test('el login por UI lleva al panel', async ({ page }) => {
    await page.goto('/login');
    // El formulario viene precargado con las credenciales demo.
    await page.getByRole('button', { name: /ingresar/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|bienvenida)/, { timeout: 15_000 });
  });

  test('el dashboard muestra la navegación del panel', async ({ page }) => {
    await loginAs(page);
    await page.goto('/dashboard');
    const sidebar = page.getByRole('complementary');
    await expect(sidebar.getByRole('link', { name: 'Productos' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Comprobantes' })).toBeVisible();
  });

  test('productos: lista y alta de un producto nuevo', async ({ page }) => {
    await loginAs(page);
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();

    const name = uniq('Prod E2E');
    await page.getByRole('button', { name: /nuevo producto/i }).click();
    await page.getByLabel('Nombre *').fill(name);
    await page.getByLabel(/precio \(con igv\)/i).fill('12.50');
    await page.getByRole('button', { name: /crear producto/i }).click();

    // Aparece en la tabla tras recargar la lista.
    await expect(page.getByRole('cell', { name })).toBeVisible({ timeout: 15_000 });
  });
});
