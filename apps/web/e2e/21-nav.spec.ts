import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Navegación — sidebar y command palette', () => {
  test('el sidebar muestra los enlaces clave', async ({ page }) => {
    await loginAs(page);
    await page.goto('/dashboard');

    const sidebar = page.getByRole('complementary');
    const links = [
      'Dashboard',
      'Punto de venta',
      'Ventas',
      'Comprobantes',
      'Productos',
      'Listas de precios',
      'Inventario',
      'Clientes',
      'Configuración',
    ];
    for (const name of links) {
      await expect(sidebar.getByRole('link', { name, exact: true })).toBeVisible();
    }
  });

  test('el command palette busca pantallas', async ({ page }) => {
    await loginAs(page);
    await page.goto('/dashboard');

    // Abre el palette por el botón "Buscar… ⌘K".
    await page.getByRole('button', { name: /buscar/i }).first().click();

    const input = page.getByPlaceholder('Buscar pantallas y acciones…');
    await expect(input).toBeVisible();

    await input.fill('Productos');
    await expect(page.locator('.cmdk-item').filter({ hasText: 'Productos' }).first()).toBeVisible();

    // Cierra con Escape.
    await input.press('Escape');
    await expect(input).toBeHidden();

    // El atajo de teclado también lo abre.
    await page.keyboard.press('Meta+K');
    await expect(page.getByPlaceholder('Buscar pantallas y acciones…')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
