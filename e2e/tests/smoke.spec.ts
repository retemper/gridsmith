import { expect, test } from '@playwright/test';

test('playground loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Gridsmith');
});
