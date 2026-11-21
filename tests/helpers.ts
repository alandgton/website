import type { Page } from '@playwright/test';

/**
 * Collects console errors (ignoring missing favicon.ico) and uncaught page errors
 * for assertion at the end of each Playwright test.
 */
export function trackRuntimeErrors(page: Page): string[] {
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
