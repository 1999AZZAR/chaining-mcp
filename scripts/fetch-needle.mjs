#!/usr/bin/env node
/**
 * Fetch Needle 2 baked engine + weights from Hugging Face.
 * Repo: Cactus-Compute/needle2 (Apache-2.0). No build needed.
 * Layout after fetch: assets/needle/{needle[.exe],needle2.cact[,needle.wasm,needle.js]}
 * Usage: node scripts/fetch-needle.mjs [--platform linux-x86_64] [--wasm] [--all]
 */
import { mkdirSync, existsSync, createWriteStream, chmodSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, platform, arch } from 'node:process';

const HF = 'https://huggingface.co/Cactus-Compute/needle2/resolve/main';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'needle');

const PLATFORM_MAP = { linux: { x64: 'linux-x86_64', arm64: 'linux-arm64', arm: 'linux-armv7' }, darwin: { arm64: 'macos-arm64', x64: null }, win32: { x64: 'windows-x86_64', arm64: 'windows-arm64' } };

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
const exe = tag.startsWith('windows') ? 'needle.exe' : 'needle';
const files = [
  [`${tag}/${exe}`, join(ROOT, exe)],
  ['needle2.cact', join(ROOT, 'needle2.cact')],
];
if (argv.includes('--wasm') || argv.includes('--all')) {
  files.push(['wasm/needle.wasm', join(ROOT, 'needle.wasm')], ['wasm/needle.js', join(ROOT, 'needle.js')]);
}

mkdirSync(ROOT, { recursive: true });
for (const [remote, dest] of files) await fetchTo(`${HF}/${remote}`, dest);
if (!tag.startsWith('windows')) { try { chmodSync(join(ROOT, exe), 0o755); } catch {} }
console.log(`\ndone. engine=${join(ROOT, exe)} weights=${join(ROOT, 'needle2.cact')}`);
console.log('env: NEEDLE_ENGINE_PATH, NEEDLE_MODEL_PATH=assets/needle/needle2.cact');
