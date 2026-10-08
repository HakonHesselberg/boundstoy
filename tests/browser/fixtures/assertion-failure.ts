import assert from 'node:assert/strict';
import { main } from '../../../scripts/browser-check.ts';

// A disposable browser/profile, not a production-code mutation or a success fallback.
await main(process.argv.slice(2), async ({ page }) => {
  const title = await page.evaluate<string>('document.title');
  assert.equal(title, 'INTENTIONAL FAILURE: prove nonzero exit and cleanup');
});
