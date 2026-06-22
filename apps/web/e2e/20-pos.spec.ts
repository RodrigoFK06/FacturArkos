import { test, expect } from '@playwright/test';
import { loginAs, uniq, API } from './helpers';

test.describe('Punto de venta (POS)', () => {
  test('el POS carga y muestra el buscador de productos', async ({ page }) => {
    await loginAs(page);
    await page.goto('/pos');
    await expect(page.getByText('Punto de venta')).toBeVisible();
    await expect(page.getByPlaceholder(/buscar producto/i)).toBeVisible();
  });

  test('agregar un producto al carrito sube el total', async ({ page }) => {
    const { token } = await loginAs(page);

    // Garantiza que exista al menos un producto en el catálogo.
    const prodName = uniq('Prod POS');
    await page.request.post(`${API}/products`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: prodName, price: 30 },
    });

    await page.goto('/pos');
    await expect(page.getByText('Punto de venta')).toBeVisible();

    // El total arranca en S/ 0.00.
    const totalRow = page.locator('.pos-cart').getByText('Total');
    await expect(totalRow).toBeVisible();

    // Hace click en la primera tarjeta de producto (button.card en la sección de productos).
    const firstCard = page.locator('section .card').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    // El total ya no es S/ 0.00 (aparece en el carrito).
    await expect(page.locator('.pos-cart')).not.toContainText('S/ 0.00');

    // Selector de lista de precios: condicional, solo si existe.
    const priceSelect = page.locator('select').filter({ has: page.getByRole('option', { name: 'Precio: lista base' }) });
    if (await priceSelect.count()) {
      const options = await priceSelect.first().locator('option').count();
      if (options > 1) {
        await priceSelect.first().selectOption({ index: 1 });
      }
      // Cambiar de opción no debe romper la página.
      await expect(page.getByText('Punto de venta')).toBeVisible();
    }
  });
});
