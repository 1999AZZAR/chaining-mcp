import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planTask } from './.dist/agent/agent.js';
import { LLMManager } from './.dist/managers/llm-manager.js';

// M7 evidence harness: heuristic baseline vs Needle contender on identical
// inputs. OpenRouter arm runs only when OPENROUTER_API_KEY is present.
// Live-gated (NEEDLE_LIVE=1); keyless here the heuristic always takes its
// hardcoded fallback, which is exactly the behavior M7 proposes to remove.
const CASES = [
  { task: 'get the weather in Jakarta', expect: ['get_weather'] },
  { task: 'set the living room lights to 30 percent', expect: ['set_lights'] },
  { task: 'findZhang Wei and text her the meeting time', expect: ['search_contact', 'send_message'] },
];

const CATALOG = [
  { name: 'get_weather', description: 'Get weather for a city' },
  { name: 'set_lights', description: 'Control room lights and brightness' },
  { name: 'search_contact', description: 'Look up a contact by name' },
  { name: 'send_message', description: 'Text a contact a message' },
  { name: 'play_music', description: 'Play music by mood or artist' },
];
const summary = CATALOG.map(t => `${t.name}: ${t.description}`).join('\n');

describe('heuristic vs needle comparison', { skip: process.env.NEEDLE_LIVE === '1' ? false : 'needs NEEDLE_LIVE=1 and fetched engine' }, () => {
  test('baseline: heuristic removed — keyless decompose fails honestly', async () => {
    const saved = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const llm = new LLMManager();
      for (const c of CASES.slice(0, 1)) {
        const r = await llm.decomposeTask(c.task, summary);
        assert.equal(r.ok, false);
        assert.ok(r.error);
        assert.equal(r.subtasks, undefined);
      }
    } finally {
      if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved;
    }
  });

  test('contender: needle names expected tools (retry-tolerant)', async () => {
    let hits = 0;
    const laps = [];
    for (const c of CASES) {
      let ok = false;
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        const t0 = Date.now();
        const plan = await planTask(c.task, summary, undefined, undefined, CATALOG);
        const names = plan.steps.map(s => s.tool).filter(Boolean);
        ok = c.expect.every(e => names.includes(e));
        if (attempt === 1) laps.push(Date.now() - t0);
      }
      if (ok) hits++;
    }
    console.log(`    needle tool-hit: ${hits}/${CASES.length}, first-try latency ms: ${laps.join(',')}`);
    assert.ok(hits >= 2, `needle hit ${hits}/${CASES.length}, need >= 2 for M7 evidence`);
  });

  test('openrouter arm', { skip: process.env.OPENROUTER_API_KEY ? false : 'no OPENROUTER_API_KEY — arm skipped' }, async () => {
    // Genuine escalation-backend proof: one tiny free-tier call.
    process.env.CHAINING_LLM_ENABLED = 'true';
    try {
      const { OpenRouterProvider } = await import('./.dist/agent/openrouter-provider.js');
      const or = new OpenRouterProvider();
      const h = await or.health();
      assert.equal(h.ok, true);
      const r = await or.generate({ prompt: 'Reply with exactly: OPENROUTER_OK', systemPrompt: 'You are a test probe.' });
      assert.match(r.text, /OPENROUTER_OK/);
    } finally {
      delete process.env.CHAINING_LLM_ENABLED;
    }
  });
});
