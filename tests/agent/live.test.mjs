import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// Live-engine tests. Run only with NEEDLE_LIVE=1 and a fetched engine.
// `npm run test:agent:live` sets this up. Otherwise the suite skips.
const LIVE = process.env.NEEDLE_LIVE === '1';
const ENGINE = process.env.NEEDLE_ENGINE_PATH || './assets/needle/needle';

describe('needle live', { skip: !LIVE || !existsSync(ENGINE) ? 'needs NEEDLE_LIVE=1 and fetched engine' : false }, () => {
  let agent, providerMod;
  test('setup', async () => {
    process.env.MITOSIS_AGENT_ENABLED = 'true';
    process.env.NEEDLE_ENGINE_PATH = ENGINE;
    agent = await import('./.dist/agent/agent.js');
    providerMod = await import('./.dist/agent/needle-provider.js');
    assert.ok(agent.agentRun);
  });

  test('health ok', async () => {
    const n = new providerMod.NeedleProvider();
    const h = await n.health();
    assert.equal(h.ok, true);
    n.stopServer();
  });

  test('one-shot call shape: tool + confidence', async () => {
    // Stochastic 45M model: retry a few turns before calling it a failure.
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const n = new providerMod.NeedleProvider();
      try {
        const r = await n.generate({ prompt: 'what is the weather in Jakarta', tools: [{ name: 'get_weather', description: 'Get weather for a city' }] });
        const p = JSON.parse(r.text);
        assert.equal(p.type, 'call');
        assert.ok(Array.isArray(p.function_calls) && p.function_calls.length > 0);
        assert.equal(typeof p.confidence, 'number');
        assert.ok(p.confidence >= 0 && p.confidence <= 1);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      } finally {
        n.stopServer();
      }
    }
    assert.equal(lastErr, null);
  });

  test('planTask returns validated plan', async () => {
    const plan = await agent.planTask('check disk usage and list large files', 'filesystem tools, shell execution');
    assert.ok(plan.steps.length >= 1);
    assert.ok(plan.steps.every(s => typeof s.step === 'number' && typeof s.task === 'string'));
  });

  test('serve mode survives consecutive turns', async () => {
    const n = new providerMod.NeedleProvider();
    const tools = [{ name: 'ping', description: 'ping test' }];
    const a = await n.generate({ prompt: 'ping please', tools });
    const b = await n.generate({ prompt: 'ping again', tools });
    assert.ok(JSON.parse(a.text).type);
    assert.ok(JSON.parse(b.text).type);
    n.stopServer();
  });
});
