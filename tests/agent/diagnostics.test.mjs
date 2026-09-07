import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isAgentEnabled, agentStatus, bundledEnginePath } from './.dist/agent/diagnostics.js';

describe('agent enablement (bundled-first)', () => {
  test('explicit opt-out always wins', () => {
    process.env.MITOSIS_AGENT_ENABLED = 'false';
    assert.equal(isAgentEnabled(), false);
    delete process.env.MITOSIS_AGENT_ENABLED;
  });

  test('explicit opt-in wins even without engine', () => {
    process.env.MITOSIS_AGENT_ENABLED = 'true';
    process.env.NEEDLE_ENGINE_PATH = '/nonexistent/needle';
    assert.equal(isAgentEnabled(), true);
    delete process.env.MITOSIS_AGENT_ENABLED;
    delete process.env.NEEDLE_ENGINE_PATH;
  });

  test('default follows bundled engine presence', async () => {
    const { existsSync } = await import('node:fs');
    assert.equal(isAgentEnabled(), existsSync(bundledEnginePath()));
    process.env.NEEDLE_ENGINE_PATH = '/nonexistent/needle';
    assert.equal(isAgentEnabled(), false);
    delete process.env.NEEDLE_ENGINE_PATH;
  });

  test('agentStatus exposes no keys, reports readiness', () => {
    const s = agentStatus();
    assert.equal(typeof s.enabled, 'boolean');
    assert.equal(typeof s.escalation.hasKey, 'boolean');
    assert.ok(!('OPENROUTER_API_KEY' in s));
    assert.ok(JSON.stringify(s).indexOf('sk-') === -1);
  });
});
