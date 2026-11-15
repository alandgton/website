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

test.describe('Garden Leave Travel Map — Mobile (390x844, touch)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('expanding and compacting photo during Journey Playback does not pause playback', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/gardenleave/');

    const playJourneyBtn = page.locator('button[title="Start Interactive Journey Playback"]');
    await expect(playJourneyBtn).toBeVisible();
    await expect(page.getByRole('button', { name: /Itinerary/i })).toHaveCount(0);

    await playJourneyBtn.tap();

    await page.getByRole('button', { name: '2x', exact: true }).tap();
    await page.locator('button[title="Play Journey"]').tap();

    const pauseBtn = page.locator('button[title="Pause Journey"]');
    await expect(pauseBtn).toBeVisible();

    const expandBtn = page.locator('button[aria-label="Expand photo"]');
    await expect(expandBtn).toBeVisible();
    await expandBtn.tap();

    const compactBtn = page.getByRole('button', { name: 'Compact' });
    await expect(compactBtn).toBeVisible();

    const scrubber = page.locator('input[type="range"]');
    const indexAtExpand = Number(await scrubber.inputValue());

    // At 2x speed (750ms/leg), waiting 1800ms must advance at least 2 legs while expanded.
    await page.waitForTimeout(1800);
    const indexWhileExpanded = Number(await scrubber.inputValue());

    expect(indexWhileExpanded).toBeGreaterThan(indexAtExpand);
    await expect(pauseBtn).toBeVisible();

    await compactBtn.tap();
    await expect(expandBtn).toBeVisible();

    await page.waitForTimeout(1000);
    const indexAfterCompact = Number(await scrubber.inputValue());

    expect(indexAfterCompact).toBeGreaterThan(indexWhileExpanded);
    await expect(pauseBtn).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('Garden Leave Travel Map — Desktop (1280x800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Journey Playback advances smoothly and desktop postcard Hold badge releases on mouse leave', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/gardenleave/');

    const playJourneyBtn = page.locator('button[title="Start Interactive Journey Playback"]');
    await expect(playJourneyBtn).toBeVisible();
    await expect(page.getByRole('button', { name: /Itinerary/i })).toHaveCount(0);

    await playJourneyBtn.click();
    await page.getByRole('button', { name: '2x', exact: true }).click();
    await page.locator('button[title="Play Journey"]').click();

    await expect(page.locator('button[title="Pause Journey"]')).toBeVisible();

    const postcard = page.locator('aside[aria-label^="Photos from"]');
    await expect(postcard).toBeVisible();

    // Hovering desktop postcard pauses playback and displays Hold badge
    await postcard.hover();
    const holdBadge = postcard.locator('span[title="Playback paused while inspecting photo"]');
    await expect(holdBadge).toBeVisible();

    const scrubber = page.locator('input[type="range"]');
    const indexBeforeUnhover = Number(await scrubber.inputValue());

    // Moving cursor off postcard clears Hold badge and resumes auto-advance
    await page.mouse.move(640, 300);
    await expect(holdBadge).toHaveCount(0);

    await page.waitForTimeout(1600);
    const indexAfterUnhover = Number(await scrubber.inputValue());

    expect(indexAfterUnhover).toBeGreaterThan(indexBeforeUnhover);
    expect(errors).toEqual([]);
  });
});
