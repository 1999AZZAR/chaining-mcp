#!/usr/bin/env node
/**
 * 20-task planning battery with repeated runs (n=3): validity, expected-tool
 * recall, latency, parallelism share. Needle-only; heuristic baseline is
 * structurally 0 (emits categories, never tools — proven in compare.test).
 * Usage: NEEDLE_LIVE=1 NEEDLE_ENGINE_PATH=./assets/needle/needle node scripts/bench-battery.mjs
 * Output: tests/agent/bench-results.json + console table.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests', 'agent', '.dist');
execFileSync('node', ['node_modules/typescript/bin/tsc',
  'src/agent/agent.ts', '--module', 'nodenext', '--moduleResolution', 'nodenext',
  '--target', 'es2022', '--skipLibCheck', '--outDir', out, '--rootDir', 'src',
], { cwd: root, stdio: 'inherit' });

const { planTask } = await import('../tests/agent/.dist/agent/agent.js');

const CATALOG = [
  { name: 'get_weather', description: 'Get weather for a city' },
  { name: 'set_lights', description: 'Control room lights and brightness' },
  { name: 'search_contact', description: 'Look up a contact by name' },
  { name: 'send_message', description: 'Text a contact a message' },
  { name: 'play_music', description: 'Play music by mood or artist' },
  { name: 'set_thermostat', description: 'Set home temperature and mode' },
  { name: 'read_file', description: 'Read a file from disk' },
  { name: 'write_file', description: 'Write content to a file' },
  { name: 'shell_exec', description: 'Run a shell command' },
  { name: 'web_search', description: 'Search the web' },
  { name: 'summarize', description: 'Summarize long text' },
  { name: 'get_time', description: 'Get current time in a timezone' },
];

const TASKS = [
  ['get the weather in Jakarta', ['get_weather']],
  ['dim the living room lights to 30', ['set_lights']],
  ['find Zhang Wei and text her the meeting time', ['search_contact', 'send_message']],
  ['what time is it in Tokyo right now', ['get_time']],
  ['weather in Jakarta and time in Tokyo', ['get_weather', 'get_time']],
  ['play some jazz music', ['play_music']],
  ['set the thermostat to 21 degrees cooling', ['set_thermostat']],
  ['read the file config.json', ['read_file']],
  ['search the web for Needle 2 benchmarks', ['web_search']],
  ['summarize this build log', ['summarize']],
  ['list the files then read the biggest one', ['shell_exec', 'read_file']],
  ['text Bob happy birthday', ['search_contact', 'send_message']],
  ['weather in Paris and play French music', ['get_weather', 'play_music']],
  ['write the meeting notes to notes.txt', ['write_file']],
  ['check disk usage on this machine', ['shell_exec']],
  ['turn on bedroom lights and set thermostat to 20', ['set_lights', 'set_thermostat']],
  ['look up Alice and text her the address', ['search_contact', 'send_message']],
  ['time in London and New York', ['get_time']],
  ['read package.json and summarize it', ['read_file', 'summarize']],
  ['turn off all the lights', ['set_lights']],
];

const N = parseInt(process.env.BATTERY_N || '3', 10);
const results = [];
for (const [task, expect] of TASKS) {
  const runs = [];
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    try {
      const plan = await planTask(task, '', undefined, undefined, CATALOG);
      const names = plan.steps.map(s => s.tool);
      const hits = expect.filter(e => names.includes(e)).length;
      const parallel = plan.steps.filter(s => !(s.dependsOn?.length)).length;
      runs.push({ ok: true, ms: Date.now() - t0, steps: plan.steps.length, recall: hits / expect.length, parallelShare: parallel / plan.steps.length, tools: names });
    } catch (e) {
      runs.push({ ok: false, ms: Date.now() - t0, error: String(e.message || e).slice(0, 120) });
    }
  }
  const good = runs.filter(r => r.ok);
  results.push({
    task, expect,
    validRate: good.length / N,
    avgRecall: good.length ? good.reduce((s, r) => s + r.recall, 0) / good.length : 0,
    avgMs: good.length ? Math.round(good.reduce((s, r) => s + r.ms, 0) / good.length) : null,
    avgSteps: good.length ? +(good.reduce((s, r) => s + r.steps, 0) / good.length).toFixed(2) : null,
    avgParallel: good.length ? +(good.reduce((s, r) => s + r.parallelShare, 0) / good.length).toFixed(2) : null,
  });
}

const valid = results.filter(r => r.validRate === 1);
const recallAll = results.flatMap(() => []);
const summary = {
  tasks: TASKS.length, runsPerTask: N,
  fullyValid: `${valid.length}/${results.length}`,
  meanRecall: +(results.reduce((s, r) => s + r.avgRecall, 0) / results.length).toFixed(3),
  meanMs: Math.round(results.filter(r => r.avgMs).reduce((s, r) => s + r.avgMs, 0) / results.filter(r => r.avgMs).length),
  meanParallel: +(results.filter(r => r.avgParallel !== null).reduce((s, r) => s + r.avgParallel, 0) / results.filter(r => r.avgParallel !== null).length).toFixed(3),
};
void recallAll;

console.log('\ntask | valid | recall | ms | steps | parallel');
for (const r of results) {
  console.log(`${r.task.slice(0, 42).padEnd(44)} ${r.validRate.toFixed(2)}  ${r.avgRecall.toFixed(2)}   ${String(r.avgMs ?? '-').padStart(5)}  ${String(r.avgSteps ?? '-').padStart(5)}  ${r.avgParallel ?? '-'}`);
}
console.log('\nSUMMARY', JSON.stringify(summary));
writeFileSync(join(root, 'tests', 'agent', 'bench-results.json'), JSON.stringify({ summary, results }, null, 1));
console.log('wrote tests/agent/bench-results.json');
