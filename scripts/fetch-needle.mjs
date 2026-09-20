#!/usr/bin/env node
/**
 * Fetch Needle engine + weights from Hugging Face. No build needed.
 *  Gen 3 (default): repo Cactus-Compute/needle3 (Apache-2.0).
 *    Layout: assets/needle/{needle3[.exe],needle3.cact[,needle.wasm,needle.js]}
 *  Gen 2 (legacy fallback): repo Cactus-Compute/needle2.
 *    Layout: assets/needle/{needle[.exe],needle2.cact[,needle.wasm,needle.js]}
 * Usage: node scripts/fetch-needle.mjs [--gen 2|3] [--platform linux-x86_64] [--wasm] [--all]
 */
import { mkdirSync, existsSync, createWriteStream, chmodSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, platform, arch } from 'node:process';

const HF_ROOT = 'https://huggingface.co';
const REPOS = { 2: 'Cactus-Compute/needle2', 3: 'Cactus-Compute/needle3' };
const genFlag = argv.find(a => a.startsWith('--gen='));
const gen = genFlag ? genFlag.split('=')[1] : (process.env.NEEDLE_GENERATION === '2' ? '2' : '3');
if (gen !== '2' && gen !== '3') throw new Error(`--gen must be 2 or 3, got ${gen}`);
const HF = `${HF_ROOT}/${REPOS[gen]}/resolve/main`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'needle');

// v3 ships windows engines; v2 never did (early error preserved for --gen=2).
const PLATFORM_MAP = { linux: { x64: 'linux-x86_64', arm64: 'linux-arm64', arm: 'linux-armv7' }, darwin: { arm64: 'macos-arm64', x64: null }, win32: gen === '3' ? { x64: 'windows-x86_64', arm64: 'windows-arm64' } : { x64: null } };

function detectTag() {
  const flag = argv.find(a => a.startsWith('--platform='));
  if (flag) return flag.split('=')[1];
  const perOs = PLATFORM_MAP[platform];
  const tag = perOs?.[arch];
  if (!tag) throw new Error(`unsupported platform ${platform}/${arch}; pass --platform=linux-x86_64|linux-arm64|macos-arm64|windows-x86_64|...`);
  return tag;
}

async function fetchTo(url, dest) {
  if (existsSync(dest) && !argv.includes('--force')) { console.log(`skip (exists): ${dest}`); return; }
  console.log(`GET ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status} ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  await pipeline(res.body, createWriteStream(dest));
  console.log(`wrote ${dest}`);
}

const tag = detectTag();
const exe = gen === '3' && !tag.startsWith('windows') ? 'needle3' : (tag.startsWith('windows') ? 'needle.exe' : 'needle');
const cact = gen === '3' ? 'needle3.cact' : 'needle2.cact';
const engineRemote = `${tag}/${tag.startsWith('windows') ? 'needle.exe' : 'needle'}`;
const files = [
  [engineRemote, join(ROOT, exe)],
  [cact, join(ROOT, cact)],
];
if (argv.includes('--wasm') || argv.includes('--all')) {
  files.push(['wasm/needle.wasm', join(ROOT, 'needle.wasm')], ['wasm/needle.js', join(ROOT, 'needle.js')]);
}

mkdirSync(ROOT, { recursive: true });
for (const [remote, dest] of files) await fetchTo(`${HF}/${remote}`, dest);
if (!tag.startsWith('windows')) { try { chmodSync(join(ROOT, exe), 0o755); } catch {} }
console.log(`\ndone. gen=${gen} engine=${join(ROOT, exe)} weights=${join(ROOT, cact)}`);
console.log('env: NEEDLE_GENERATION=2|3, NEEDLE_ENGINE_PATH, NEEDLE_MODEL_PATH, NEEDLE_DEPTH=2..20 (gen 3)');
