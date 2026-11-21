import { expect, test } from '@playwright/test';
import { trackRuntimeErrors } from './helpers';

test.describe('alanton.at — Landing, Home & Document Titles', () => {
  test('landing page renders NeuralMeshBackground, thumb-wheel picker, and toggles animation cleanly', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);
    await page.goto('/');

    await expect(page).toHaveTitle('Alan Ton @ _____');
    await expect(page.getByRole('heading', { name: 'Alan Ton @' })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();

    const animBtn = page.getByRole('button', { name: /Animation:/ });
    await expect(animBtn).toHaveAttribute('aria-pressed', 'false');
    await animBtn.click();
    await expect(animBtn).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(200);
    await animBtn.click();
    await expect(animBtn).toHaveAttribute('aria-pressed', 'false');

    const homeLink = page.getByRole('link', { name: 'Home' });
    const workLink = page.getByRole('link', { name: 'Work' });
    const gardenLeaveLink = page.getByRole('link', { name: 'Garden Leave' });
    const goLink = page.getByRole('link', { name: 'Go', exact: true });

    // All three options visible on load with Work selected by default
    await expect(homeLink).toBeVisible();
    await expect(workLink).toBeVisible();
    await expect(gardenLeaveLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/home/');
    await expect(workLink).toHaveAttribute('href', '/work/');
    await expect(gardenLeaveLink).toHaveAttribute('href', '/gardenleave/');
    await expect(workLink).toHaveAttribute('aria-current', 'true');
    await expect(goLink).toHaveAttribute('href', '/work/');
    await expect(page.getByText('alanton.at/work')).toBeVisible();

    // Go button is positioned directly below the scroll wheel
    const wheelNavBox = await page.getByRole('navigation', { name: 'Choose destination' }).boundingBox();
    const goBox = await goLink.boundingBox();
    expect(wheelNavBox).not.toBeNull();
    expect(goBox).not.toBeNull();
    expect(goBox!.y).toBeGreaterThan(wheelNavBox!.y + wheelNavBox!.height);
    expect(Math.abs((goBox!.x + goBox!.width / 2) - (wheelNavBox!.x + wheelNavBox!.width / 2))).toBeLessThan(2);

    // Clicking an adjacent option selects it without immediately navigating away
    await homeLink.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(homeLink).toHaveAttribute('aria-current', 'true');
    await expect(goLink).toHaveAttribute('href', '/home/');
    await expect(page.getByText('alanton.at/home')).toBeVisible();

    // Next chevron steps cleanly to Work then Garden Leave
    const nextBtn = page.getByRole('button', { name: 'Next destination' });
    await nextBtn.click();
    await expect(workLink).toHaveAttribute('aria-current', 'true');
    await nextBtn.click();
    await expect(gardenLeaveLink).toHaveAttribute('aria-current', 'true');
    await expect(goLink).toHaveAttribute('href', '/gardenleave/');
    await expect(page.getByText('alanton.at/gardenleave')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('landing page keeps thumb-wheel and Go button centered on narrow mobile without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const errors = trackRuntimeErrors(page);
    await page.goto('/');

    const homeLink = page.getByRole('link', { name: 'Home' });
    const workLink = page.getByRole('link', { name: 'Work' });
    const gardenLeaveLink = page.getByRole('link', { name: 'Garden Leave' });
    const goLink = page.getByRole('link', { name: 'Go', exact: true });

    await expect(homeLink).toBeVisible();
    await expect(workLink).toBeVisible();
    await expect(gardenLeaveLink).toBeVisible();
    await expect(workLink).toHaveAttribute('aria-current', 'true');
    await expect(goLink).toHaveAttribute('href', '/work/');

    const wheelNavBox = await page.getByRole('navigation', { name: 'Choose destination' }).boundingBox();
    const goBox = await goLink.boundingBox();
    expect(wheelNavBox).not.toBeNull();
    expect(goBox).not.toBeNull();
    expect(goBox!.y).toBeGreaterThan(wheelNavBox!.y + wheelNavBox!.height);
    expect(Math.abs((goBox!.x + goBox!.width / 2) - 180)).toBeLessThan(4);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
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
