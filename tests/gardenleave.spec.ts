import { expect, test } from '@playwright/test';
import { ITINERARY } from '../src/sites/gardenleave/config/itinerary.config';
import { trackRuntimeErrors } from './helpers';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function deriveTripMonths() {
  const seen = new Set<string>();
  const months: Array<{ ym: string; month: number; name: string }> = [];
  for (const leg of ITINERARY) {
    const ym = leg.startDate.slice(0, 7);
    if (seen.has(ym)) continue;
    seen.add(ym);
    const month = Number(ym.slice(5, 7)) - 1;
    months.push({ ym, month, name: MONTH_NAMES[month] });
  }
  return months;
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

    // Compute expected default month name dynamically from ITINERARY (matching getInitialMonthIndex)
    const tripMonths = deriveTripMonths();
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const expectedMonth =
      tripMonths.find((m) => m.ym === currentYm) ??
      tripMonths.find((m) => m.month === now.getMonth()) ??
      tripMonths[0];

    await expect(dialog.getByText(expectedMonth.name, { exact: true })).toBeVisible();
    await expect(dialog.getByText(`${expectedMonth.name} ${expectedMonth.ym.slice(0, 4)}`)).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /Previous month|Next month/i })).toHaveCount(0);

    // Scroll vertically to the top of the Calendar view to reveal August
    const calScroll = dialog.getByTestId('itinerary-calendar-scroll');
    await calScroll.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(dialog.getByText('August', { exact: true })).toBeVisible();

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

  test('loads self-hosted Admin-1 TopoJSON without flashing whole-country highlights while pending', async ({
    page,
  }) => {
    const errors = trackRuntimeErrors(page);
    const githubRequests: string[] = [];
    let sawLocalAdmin1Request = false;
    let releaseAdmin1!: () => void;
    const admin1Gate = new Promise<void>((resolve) => {
      releaseAdmin1 = resolve;
    });

    page.on('request', (req) => {
      if (req.url().includes('raw.githubusercontent.com')) {
        githubRequests.push(req.url());
      }
    });

    await page.route('**/gardenleave/admin1-50m.topo.json', async (route) => {
      sawLocalAdmin1Request = true;
      await admin1Gate;
      await route.continue();
    });

    await page.goto('/gardenleave/');

    // Wait for base 50m country polygons to mount while Admin-1 is still held
    await expect(page.locator('.countries-layer path').first()).toBeVisible();
    expect(sawLocalAdmin1Request).toBe(true);

    // No whole-country highlight flash while Admin-1 is still loading in Subregion mode
    await expect(page.locator('.countries-layer path[fill="#183052"]')).toHaveCount(0);
    await expect(page.locator('.admin1-layer')).toHaveCount(0);

    // Release Admin-1 TopoJSON and verify subregion + non-subdivided country highlights appear together
    releaseAdmin1();

    await expect(page.locator('.admin1-layer path[fill="#183052"]').first()).toBeVisible();
    await expect(page.locator('.countries-layer path[fill="#183052"]').first()).toBeVisible();

    expect(githubRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
});
