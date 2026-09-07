#!/usr/bin/env node
/**
 * Full end-to-end test against the REAL built server (dist/index.js) over
 * MCP stdio: initialize → list → call agent tools → read resources.
 * Exercises the shipped artifact: bundled engine, real registry, real
 * orchestrator transport, honest failures. Keyed runs (OPENROUTER_API_KEY)
 * additionally prove escalation; keyless runs accept escalation-shaped
 * outcomes wherever the stochastic model refuses.
 */
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYED = Boolean(process.env.OPENROUTER_API_KEY);
let failures = 0;

const server = spawn('node', [join(root, 'dist', 'index.js')], {
  cwd: root,
  // CHAINING_LLM_ENABLED=true unlocks the OpenRouter-backed paths (brainstorming,
  // escalation) whenever a key is present; keyless runs exercise honest failures.
  env: { ...process.env, NEEDLE_ENGINE_PATH: './assets/needle/needle', CHAINING_LLM_ENABLED: 'true' },
  stdio: ['pipe', 'pipe', 'inherit'],
});

let buf = '';
let nextId = 1;
const pending = new Map();
server.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`timeout on ${method}`)); }, 120000);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
const notify = (method) => server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
const textOf = (res) => res.result?.content?.[0]?.text || '';
const parse = (res) => { try { return JSON.parse(textOf(res)); } catch { return { _raw: textOf(res).slice(0, 200) }; } };

function check(name, cond, detail = '') {
  console.log(`${cond ? '✔' : '✖'} ${name}${cond ? '' : ' — ' + String(detail).slice(0, 300)}`);
  if (!cond) failures++;
}

try {
  const init = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
  check('initialize', !!init.result?.serverInfo, JSON.stringify(init).slice(0, 200));
  notify('notifications/initialized');

  const list = await request('tools/list');
  const names = (list.result?.tools || []).map(t => t.name);
  for (const t of ['agent_run', 'sequentialthinking', 'analyze_with_sequential_thinking', 'workflow_orchestrator', 'workflow_status', 'workflow_cancel']) {
    check(`tool listed: ${t}`, names.includes(t), names.length + ' tools');
  }

  // 1. sequentialthinking → one Needle-backed step over the real registry.
  const st = parse(await request('tools/call', { name: 'sequentialthinking', arguments: { thought: 'need the Jakarta weather first', task: 'get weather in Jakarta', thoughtNumber: 1, totalThoughts: 3, nextThoughtNeeded: true } }));
  check('sequentialthinking agent-shaped', st.source === 'needle-agent' && !!st.sessionId && !!st.decision?.action, JSON.stringify(st).slice(0, 300));
  check('sequentialthinking legacy fields', typeof st.thoughtNumber === 'number' && typeof st.nextThoughtNeeded === 'boolean', JSON.stringify(st).slice(0, 200));
  if (st.sessionId) {
    const st2 = parse(await request('tools/call', { name: 'sequentialthinking', arguments: { thought: 'wrap up', task: 'get weather in Jakarta', sessionId: st.sessionId, thoughtNumber: 2, totalThoughts: 3, nextThoughtNeeded: false } }));
    check('sequentialthinking session continuity', st2.sessionId === st.sessionId, JSON.stringify(st2).slice(0, 200));
  }

  // 2. agent_run → full loop (accept escalation-shaped outcomes keyless).
  const run = parse(await request('tools/call', { name: 'agent_run', arguments: { task: 'get weather in Jakarta', maxExecutionMs: 90000 } }));
  if (run.ok) {
    check('agent_run plan + decision', Array.isArray(run.plan) && !!run.decision?.action, JSON.stringify(run).slice(0, 300));
  } else {
    check('agent_run honest failure', /escalation|escalated|budget spent|disabled/i.test(run.error || ''), JSON.stringify(run).slice(0, 300));
  }

  // 3. analyze_with_sequential_thinking → Needle plan, no templates.
  const an = parse(await request('tools/call', { name: 'analyze_with_sequential_thinking', arguments: { problem: 'get weather in Jakarta' } }));
  const noTemplates = !JSON.stringify(an).match(/REVERSE ENGINEERING|COOKING ANALOGY|SERENDIPITY|RANDOM STIMULATION/);
  check('analysis needle-backed, no templates', an.source === 'needle-agent' && noTemplates && (an.thoughts?.length >= 1 || an.error), JSON.stringify(an).slice(0, 300));

  // 4. workflow_status unknown → honest error; brainstorming keyless → honest failure.
  const ws = parse(await request('tools/call', { name: 'workflow_status', arguments: { workflowId: 'nope-missing' } }));
  check('workflow_status honest miss', ws.ok === false, JSON.stringify(ws).slice(0, 200));
  if (!KEYED) {
    const bs = parse(await request('tools/call', { name: 'brainstorming', arguments: { topic: 'onboarding', thoughtNumber: 1, totalThoughts: 1, nextThoughtNeeded: false } }));
    check('brainstorming keyless honest failure', bs.ok === false && /generative model/.test(bs.error || ''), JSON.stringify(bs).slice(0, 300));
  } else {
    const bs = parse(await request('tools/call', { name: 'brainstorming', arguments: { topic: 'onboarding rituals', ideaCount: 3, thoughtNumber: 1, totalThoughts: 1, nextThoughtNeeded: false } }));
    check('brainstorming keyed real ideas', bs.ok === true && bs.source === 'openrouter' && bs.ideas?.length >= 1, JSON.stringify(bs).slice(0, 400));
  }

  // 5. resources: agent status + sequential state.
  const agentStatus = await request('resources/read', { uri: 'chaining://agent/status' });
  const asJson = JSON.parse(agentStatus.result?.contents?.[0]?.text || '{}');
  check('agent/status enabled, no keys', asJson.enabled === true && !JSON.stringify(asJson).includes('sk-or'), JSON.stringify(asJson).slice(0, 300));
  const seqState = await request('resources/read', { uri: 'chaining://sequential/state' });
  const ssJson = JSON.parse(seqState.result?.contents?.[0]?.text || '{}');
  check('sequential/state lists sessions', typeof ssJson.totalSessions === 'number' && ssJson.totalSessions >= 1, JSON.stringify(ssJson).slice(0, 300));
} catch (e) {
  check('no harness exception', false, e.message);
} finally {
  server.kill('SIGTERM');
  setTimeout(() => server.kill('SIGKILL'), 3000);
}

console.log(failures === 0 ? '\nE2E GREEN' : `\nE2E ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
