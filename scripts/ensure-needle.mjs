#!/usr/bin/env node
/**
 * Ensure the bundled Needle 2 engine + weights are present. Runs automatically
 * on `npm install` (prepare) and before `npm run build` (prebuild), so existing
 * users only need to `git pull` + `npm install` / `npm run build`.
 * Non-fatal: if the fetch fails (offline, HF down) it prints a warning and
 * exits 0 so install/build still complete; `npm run needle:fetch` remains the
 * manual retry.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.platform === 'win32' ? 'needle.exe' : 'needle';
const engine = process.env.NEEDLE_ENGINE_PATH || join(root, 'assets', 'needle', exe);
const model = process.env.NEEDLE_MODEL_PATH || join(root, 'assets', 'needle', 'needle2.cact');

if (existsSync(engine) && existsSync(model)) {
  process.exit(0);
}
console.log('Needle 2 engine or weights missing — fetching once (this can take a moment)…');
const res = spawnSync('node', [join(root, 'scripts', 'fetch-needle.mjs')], { cwd: root, stdio: 'inherit' });
if (res.status !== 0) {
  console.warn('[warn] Needle fetch failed (offline?): run `npm run needle:fetch` later to retry.');
}
process.exit(0);
