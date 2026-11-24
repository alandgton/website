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

    // Horizontal scroll is strictly restricted inside the wheel and across the landing viewport
    const scrollLock = await page.evaluate(() => {
      const wheel = document.querySelector<HTMLElement>('.wheel-scroll');
      if (!wheel) return null;
      wheel.scrollTo({ left: 100 });
      const htmlStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      const wheelStyle = getComputedStyle(wheel);
      return {
        wheelHasHorizontalOverflow: wheel.scrollWidth > wheel.clientWidth,
        wheelScrollLeft: wheel.scrollLeft,
        wheelOverflowX: wheelStyle.overflowX,
        wheelTouchAction: wheelStyle.touchAction,
        wheelOverscrollX: wheelStyle.overscrollBehaviorX,
        htmlOverflowX: htmlStyle.overflowX,
        htmlOverscrollX: htmlStyle.overscrollBehaviorX,
        bodyOverflowX: bodyStyle.overflowX,
        bodyOverscrollX: bodyStyle.overscrollBehaviorX,
      };
    });
    expect(scrollLock).toEqual({
      wheelHasHorizontalOverflow: false,
      wheelScrollLeft: 0,
      wheelOverflowX: 'hidden',
      wheelTouchAction: 'pan-y',
      wheelOverscrollX: 'none',
      htmlOverflowX: 'clip',
      htmlOverscrollX: 'none',
      bodyOverflowX: 'clip',
      bodyOverscrollX: 'none',
    });

    expect(errors).toEqual([]);
  });

  test('home page renders minimalist profile card on narrow mobile without overflow, hobbies, or map', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const errors = trackRuntimeErrors(page);
    await page.goto('/home/');

    await expect(page).toHaveTitle('Alan Ton @ Home');
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'Main' })).toHaveAttribute('href', '/');
    await expect(header.getByRole('heading', { name: 'Alan Ton @ Home' })).toBeVisible();

    const profile = page.getByRole('region', { name: 'Profile' });
    await expect(profile.getByRole('img', { name: 'Alan Ton portrait placeholder' })).toBeVisible();
    await expect(profile.getByRole('heading', { name: 'Alan Ton' })).toBeVisible();
    await expect(profile.getByText('Software engineer living in NYC')).toBeVisible();

    const linkedin = profile.getByRole('link', { name: 'LinkedIn' });
    const instagram = profile.getByRole('link', { name: 'Instagram' });
    await expect(linkedin).toHaveAttribute('href', '#linkedin');
    await expect(instagram).toHaveAttribute('href', '#instagram');
    await linkedin.click();
    await instagram.click();
    await expect(page).toHaveURL(/\/home\/$/);

    // No WIP placeholder, hobbies, Garden Leave copy, or map SVG on /home/
    const bodyText = await page.locator('main').innerText();
    expect(bodyText).not.toMatch(/Work in Progress|Garden Leave|guitar|snowboard|scuba/i);
    await expect(page.locator('main svg[role="img"]')).toHaveCount(0);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
    expect(errors).toEqual([]);
  });

  test('home page centers single horizontal profile pill cleanly on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = trackRuntimeErrors(page);
    await page.goto('/home/');

    const profile = page.getByRole('region', { name: 'Profile' });
    const avatarBox = await profile.getByRole('img', { name: 'Alan Ton portrait placeholder' }).boundingBox();
    const linksBox = await profile.getByRole('navigation', { name: 'Social links' }).boundingBox();
    expect(avatarBox).not.toBeNull();
    expect(linksBox).not.toBeNull();
    // On sm+ desktop viewports, social links sit beside the identity block without overlapping
    expect(avatarBox!.x + avatarBox!.width).toBeLessThan(linksBox!.x);
    expect(Math.abs((avatarBox!.y + avatarBox!.height / 2) - (linksBox!.y + linksBox!.height / 2))).toBeLessThan(8);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
    expect(errors).toEqual([]);
  });

  test('gardenleave page aligns document title and keeps horizontal map panning enabled', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);
    await page.goto('/gardenleave/');

    await expect(page).toHaveTitle('Alan Ton @ Garden Leave');

    const svg = page.locator('main svg.touch-none');
    await expect(svg).toBeVisible();
    await expect(svg).toHaveCSS('touch-action', 'none');

    const getTranslateX = () =>
      page.evaluate(() => {
        const g = document.querySelector('main svg.touch-none g[transform]');
        const t = g?.getAttribute('transform') ?? '';
        const match = t.match(/translate\(([-0-9.]+)[,\s]+([-0-9.]+)\)/);
        return match ? Number(match[1]) : 0;
      });

    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    const initialX = await getTranslateX();

    // Drag right to pan map horizontally
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 160, cy, { steps: 8 });
    await page.mouse.up();
    const pannedRightX = await getTranslateX();
    expect(pannedRightX).toBeGreaterThan(initialX + 40);

    // Drag left to pan map back horizontally
    await page.mouse.move(cx + 160, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 80, cy, { steps: 8 });
    await page.mouse.up();
    const pannedLeftX = await getTranslateX();
    expect(pannedLeftX).toBeLessThan(pannedRightX - 40);

    expect(errors).toEqual([]);
  });
});
