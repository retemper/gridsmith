import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const GRID_SELECTOR = '.gs-grid';

async function scanGrid(page: Parameters<typeof AxeBuilder>[0]['page']) {
  // `color-contrast` is scoped to the playground's palette, which is a demo
  // theme — not shipped in the published packages. Regressing the grid
  // markup should not fail on demo colors, so we disable only that rule.
  return new AxeBuilder({ page }).include(GRID_SELECTOR).disableRules(['color-contrast']).analyze();
}

test.describe('Grid accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(GRID_SELECTOR).first().waitFor();
  });

  test('no serious/critical axe violations on default render', async ({ page }) => {
    const results = await scanGrid(page);
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('grid exposes role=grid with row/col counts', async ({ page }) => {
    const grid = page.locator(GRID_SELECTOR).first();
    await expect(grid).toHaveAttribute('role', 'grid');
    await expect(grid).toHaveAttribute('aria-rowcount', /^\d+$/);
    await expect(grid).toHaveAttribute('aria-colcount', /^\d+$/);
  });

  test('cells expose role=gridcell with aria-colindex', async ({ page }) => {
    const firstCell = page.locator(`${GRID_SELECTOR} .gs-cell`).first();
    await expect(firstCell).toHaveAttribute('role', 'gridcell');
    await expect(firstCell).toHaveAttribute('aria-colindex', /^\d+$/);
  });

  test('clicking a sortable header updates the polite live region', async ({ page }) => {
    const grid = page.locator(GRID_SELECTOR).first();
    const politeRegion = page.locator('[aria-live="polite"]').first();
    await expect(politeRegion).toBeAttached();

    const sortableHeader = grid.locator('.gs-header-cell--sortable').first();
    await sortableHeader.click();

    await expect(politeRegion).toHaveText(/Sorted by/i, { timeout: 2000 });
  });

  test('no serious/critical axe violations after a sort is applied', async ({ page }) => {
    const grid = page.locator(GRID_SELECTOR).first();
    await grid.locator('.gs-header-cell--sortable').first().click();
    await expect(grid.locator('[aria-sort="ascending"], [aria-sort="descending"]')).toHaveCount(1, {
      timeout: 2000,
    });

    const results = await scanGrid(page);
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
