import { expect, Page, test } from '@playwright/test';

function trackRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const url = msg.location()?.url ?? '';
      if (url.endsWith('/favicon.ico')) return;
      errors.push(`console.error: ${msg.text()}${url ? ` [${url}]` : ''}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

test.describe('Alan Ton @ Work — Mobile (390x844, touch)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('renders mobile-first vertical timeline ordered Present -> 2017 without durations, overlap flags, filters, or header dates', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/work/');

    await expect(page.getByRole('heading', { name: 'Alan Ton @ Work' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Main' })).toHaveAttribute('href', '/');

    // Removed header date span and top region filter buttons stay absent
    await expect(page.locator('header').getByText(/2017/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New York', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'West Coast', exact: true })).toHaveCount(0);

    const items = page.locator('ol[aria-label="Work experience timeline"] > li');
    await expect(items).toHaveCount(6);

    // Ordered Present -> 2017
    const companies = await items.locator('h2').allTextContents();
    expect(companies).toEqual([
      'Citadel',
      'Meta',
      'UC Berkeley College of Engineering',
      'Facebook',
      'Amazon Web Services',
      'NASA Jet Propulsion Laboratory',
    ]);

    // No durations or overlap flags
    const bodyText = await page.locator('main').innerText();
    expect(bodyText).not.toMatch(/3 yrs 2 mos|2 yrs 5 mos|4 mos/i);
    expect(bodyText).not.toMatch(/\boverlap\b|\bconcurrent\b/i);

    // Employment types: 2 Full-time, 1 Part-time, 3 Internship
    await expect(page.getByText(/· Full-time/)).toHaveCount(2);
    await expect(page.getByText(/· Part-time/)).toHaveCount(1);
    await expect(page.getByText(/· Internship/)).toHaveCount(3);

    // Citadel expanded by default; Berkeley expands on tap to reveal courses
    await expect(page.getByText('Fixed Income & Macro')).toBeVisible();

    const berkeleyToggle = page.getByRole('button', { name: /UC Berkeley College of Engineering/i });
    await expect(berkeleyToggle).toHaveAttribute('aria-expanded', 'false');
    await berkeleyToggle.tap();
    await expect(berkeleyToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Operating Systems & Systems Programming')).toBeVisible();
    await expect(page.getByText('Data Structures & Algorithms')).toBeVisible();
    await expect(page.getByText('Linear Algebra & RC Circuits')).toBeVisible();

    // No horizontal overflow
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
    expect(errors).toEqual([]);
  });

  test('expand/collapse all works on narrow 360px viewport without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const errors = trackRuntimeErrors(page);

    await page.goto('/work/');

    await page.getByRole('button', { name: 'Expand all' }).tap();
    await expect(page.getByRole('button', { name: 'Collapse all' })).toBeVisible();
    await expect(page.getByText('Component Engineering & Assurance Office')).toBeVisible();

    // All locations use uniform "City, ST" formatting
    await expect(page.getByText('New York, NY')).toHaveCount(2);
    await expect(page.getByText('Berkeley, CA')).toBeVisible();
    await expect(page.getByText('Menlo Park, CA')).toBeVisible();
    await expect(page.getByText('Seattle, WA')).toBeVisible();
    await expect(page.getByText('Pasadena, CA')).toBeVisible();

    await page.getByRole('button', { name: 'Collapse all' }).tap();
    await expect(page.getByRole('button', { name: 'Expand all' })).toBeVisible();
    await expect(page.getByText('Fixed Income & Macro')).toHaveCount(0);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
    expect(errors).toEqual([]);
  });
});

test.describe('Alan Ton @ Work — Desktop (1280x800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('renders cleanly with interactive accordions and zero runtime errors', async ({ page }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/work/');

    await expect(page.getByRole('heading', { name: 'Alan Ton @ Work' })).toBeVisible();
    const metaBtn = page.getByRole('button', { name: /^Sep 2020 – Oct 2023.*Meta/i });
    await expect(metaBtn).toHaveAttribute('aria-expanded', 'false');
    await metaBtn.click();
    await expect(metaBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Messaging Infrastructure')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
