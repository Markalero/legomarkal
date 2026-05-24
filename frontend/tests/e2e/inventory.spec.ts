import { test, expect } from '@playwright/test';

test.describe('Inventory Page', () => {
  test('should load the inventory table', async ({ page }) => {
    // Assuming the dev server runs on 3000
    await page.goto('http://localhost:3000/inventory');
    
    // Check page title or headings
    await expect(page.getByText('Inventario de Sets')).toBeVisible();
    
    // Check that the table has basic headers
    await expect(page.getByText('ID Set')).toBeVisible();
    await expect(page.getByText('Nombre')).toBeVisible();
    
    // Check that Add Set button exists
    await expect(page.getByRole('button', { name: /Añadir Set/i })).toBeVisible();
  });
});
