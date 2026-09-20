#!/usr/bin/env node
/**
 * Ensure the Needle engine + weights for the active generation are present.
 * Runs automatically on `npm install` (prepare) and before `npm run build`
 * (prebuild), so existing users only need to `git pull` + `npm install` /
 * `npm run build`. Gen 3 is the default (NEEDLE_GENERATION=2 selects legacy).
 * Non-fatal: if the fetch fails (offline, HF down) it prints a warning and
 * exits 0 so install/build still complete; `npm run needle:fetch` remains the
 * manual retry.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gen = process.env.NEEDLE_GENERATION === '2' ? '2' : '3';
const exe = process.platform === 'win32' ? 'needle.exe' : (gen === '3' ? 'needle3' : 'needle');
const cact = gen === '3' ? 'needle3.cact' : 'needle2.cact';
const engine = process.env.NEEDLE_ENGINE_PATH || join(root, 'assets', 'needle', exe);
const model = process.env.NEEDLE_MODEL_PATH || join(root, 'assets', 'needle', cact);

if (existsSync(engine) && existsSync(model)) {
  process.exit(0);
}
console.log(`Needle ${gen} engine or weights missing — fetching once (this can take a moment)…`);
const res = spawnSync('node', [join(root, 'scripts', 'fetch-needle.mjs'), `--gen=${gen}`], { cwd: root, stdio: 'inherit' });
if (res.status !== 0) {
  console.warn('[warn] Needle fetch failed (offline?): run `npm run needle:fetch` later to retry.');
}
process.exit(0);
