import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { main } from '../../scripts/browser-check.ts';
import type { BrowserContext } from './scenarios.ts';

/** Retired campaign regressions run against the same app, never the public selector. */
export async function runLegacyChecks(args: string[], checks: readonly ((context: BrowserContext) => Promise<void>)[]) {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  await mkdir(join(root, 'artifacts/legacy-regression'), { recursive: true });
  const out = await mkdtemp(join(root, 'artifacts/legacy-regression/run-'));
  const bundle = join(out, 'bundle');
  await build({
    root, configFile: false, logLevel: 'warn',
    plugins: [{
      name: 'legacy-regression-registry',
      load(id) {
        if (id === join(root, 'data/levels.ts')) return `
          export { AFTERSHOCK_LEVELS as LEVELS, AFTERSHOCK_LESSONS as COURSE_LESSONS,
            AFTERSHOCK_TARGETS as MASTERY_TARGETS } from ${JSON.stringify(join(root, 'data/aftershock.ts'))};
        `;
      },
    }],
    build: { outDir: bundle },
  });
  console.log(`Retired V1 regression fixture: ${out}`);
  for (const check of checks) {
    await main(args, check, bundle);
    if (process.exitCode) break;
  }
}
