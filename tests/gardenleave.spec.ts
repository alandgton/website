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
    await expect(page.getByRole('button', { name: 'Itinerary' })).toBeVisible();

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

  test('Itinerary modal pins Close button to top-right across Calendar and List views', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/gardenleave/');

    await page.getByRole('button', { name: 'Itinerary' }).tap();

    const dialog = page.getByRole('dialog', { name: 'Itinerary' });
    await expect(dialog).toBeVisible();

    const modalCard = dialog.locator('> div');
    const closeBtn = dialog.getByRole('button', { name: 'Close Itinerary' });
    const tablistEl = dialog.getByRole('tablist', { name: 'Itinerary View' });

    const cardCal = await modalCard.boundingBox();
    const closeCal = await closeBtn.boundingBox();
    const tablistCal = await tablistEl.boundingBox();
    expect(cardCal).not.toBeNull();
    expect(closeCal).not.toBeNull();
    expect(tablistCal).not.toBeNull();

    // Close button stays aligned on Row 1 at the top-right corner of the modal card
    expect(Math.abs(closeCal!.y - tablistCal!.y)).toBeLessThan(12);
    expect(closeCal!.x + closeCal!.width).toBeGreaterThan(cardCal!.x + cardCal!.width - 24);

    const relXCal = Math.round(closeCal!.x - cardCal!.x);
    const relYCal = Math.round(closeCal!.y - cardCal!.y);

    // Toggle to List view and confirm the Close button stays at the exact same top-right spot
    await dialog.getByRole('tab', { name: 'List' }).tap();
    const cardList = await modalCard.boundingBox();
    const closeList = await closeBtn.boundingBox();
    expect(cardList).not.toBeNull();
    expect(closeList).not.toBeNull();

    expect(Math.round(closeList!.x - cardList!.x)).toBe(relXCal);
    expect(Math.round(closeList!.y - cardList!.y)).toBe(relYCal);

    await closeBtn.tap();
    await expect(dialog).toHaveCount(0);
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
    await expect(page.getByRole('button', { name: 'Itinerary' })).toBeVisible();

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

  test('Centered Itinerary modal opens on current month Calendar, switches to List with Weekday M/D dates, and stays read-only', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);

    await page.goto('/gardenleave/');

    const itineraryBtn = page.getByRole('button', { name: 'Itinerary' });
    await itineraryBtn.click();

    const dialog = page.getByRole('dialog', { name: 'Itinerary' });
    await expect(dialog).toBeVisible();

    const calendarTab = dialog.getByRole('tab', { name: 'Calendar' });
    const listTab = dialog.getByRole('tab', { name: 'List' });
    await expect(calendarTab).toHaveAttribute('aria-selected', 'true');
    await expect(listTab).toHaveAttribute('aria-selected', 'false');

    // Compute expected default month name matching getInitialMonthIndex logic
    const tripMonths = [
      { ym: '2026-08', month: 7, name: 'August' },
      { ym: '2026-09', month: 8, name: 'September' },
      { ym: '2026-10', month: 9, name: 'October' },
      { ym: '2026-11', month: 10, name: 'November' },
      { ym: '2026-12', month: 11, name: 'December' },
      { ym: '2027-01', month: 0, name: 'January' },
    ];
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const expectedMonth =
      tripMonths.find((m) => m.ym === currentYm) ??
      tripMonths.find((m) => m.month === now.getMonth()) ??
      tripMonths[0];

    await expect(dialog.getByText(expectedMonth.name, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`${expectedMonth.name} ${expectedMonth.ym.slice(0, 4)}`)).toHaveCount(0);

    // Step months via Next/Previous controls
    const nextBtn = dialog.getByRole('button', { name: 'Next month' });
    const prevBtn = dialog.getByRole('button', { name: 'Previous month' });
    if (expectedMonth.ym !== '2027-01') {
      await nextBtn.click();
      await prevBtn.click();
      await expect(dialog.getByText(expectedMonth.name, { exact: true })).toBeVisible();
    }

    // Switch to List view (Monthly Agenda Timeline) and verify it centers on the current city row
    await listTab.click();
    await expect(listTab).toHaveAttribute('aria-selected', 'true');
    const currentRow = dialog.locator('[aria-current="date"]');
    await expect(currentRow).toBeVisible();
    await expect(dialog.getByText(expectedMonth.name, { exact: true })).toBeVisible();

    // Clicking the centered current row keeps the modal open (read-only)
    await currentRow.click();
    await expect(dialog).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Reopen and close via Close button
    await itineraryBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close Itinerary' }).click();
    await expect(dialog).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
