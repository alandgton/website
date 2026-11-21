import { expect, test } from '@playwright/test';
import { trackRuntimeErrors } from './helpers';

test.describe('alanton.at — Landing, Home & Document Titles', () => {
  test('landing page renders NeuralMeshBackground and toggles animation cleanly', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);
    await page.goto('/');

    await expect(page).toHaveTitle('Alan Ton at');
    await expect(page.getByRole('heading', { name: 'Alan Ton at' })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();

    const animBtn = page.getByRole('button', { name: /Animation:/ });
    await expect(animBtn).toHaveAttribute('aria-pressed', 'false');
    await animBtn.click();
    await expect(animBtn).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(200);
    await animBtn.click();
    await expect(animBtn).toHaveAttribute('aria-pressed', 'false');

    await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home/');
    await expect(page.getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/work/');
    await expect(page.getByRole('link', { name: 'Garden Leave' })).toHaveAttribute(
      'href',
      '/gardenleave/'
    );

    expect(errors).toEqual([]);
  });

  test('home placeholder uses centered floating header on narrow mobile without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const errors = trackRuntimeErrors(page);
    await page.goto('/home/');

    await expect(page).toHaveTitle('Alan Ton @ Home');
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'Main' })).toHaveAttribute('href', '/');
    await expect(header.getByRole('heading', { name: 'Alan Ton @ Home' })).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
    expect(errors).toEqual([]);
  });

  test('gardenleave page aligns document title with Alan Ton @ Garden Leave', async ({ page }) => {
    const errors = trackRuntimeErrors(page);
    await page.goto('/gardenleave/');

    await expect(page).toHaveTitle('Alan Ton @ Garden Leave');
    expect(errors).toEqual([]);
  });
});
