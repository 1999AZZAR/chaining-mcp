import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planTask } from './.dist/agent/agent.js';

const nativeCalls = (calls) => ({
  health: async () => ({ ok: true }),
  generate: async () => ({
    text: JSON.stringify({ type: 'call', function_calls: calls, confidence: 0.9 }),
    modelUsed: 'mock-needle', latencyMs: 1,
  }),
  confidenceOf: () => 0.9,
  isConfident: () => true,
  resetConversation: async () => undefined,
  stopServer: () => undefined,
});
const failingNeedle = () => ({
  health: async () => ({ ok: true }),
  generate: async () => { throw new Error('engine down'); },
  confidenceOf: () => null,
  isConfident: () => true,
  resetConversation: async () => undefined,
  stopServer: () => undefined,
});
const openrouter = (steps) => ({
  metadata: () => ({ name: 'or', kind: 'remote', model: 'or', capabilities: [] }),
  health: async () => ({ ok: true }),
  generate: async () => ({ text: JSON.stringify(steps), modelUsed: 'or', latencyMs: 1 }),
});
const failingEscalation = () => ({
  health: async () => ({ ok: false }),
  generate: async () => { throw new Error('nope'); },
});
const DECLS = [
  { name: 'alpha', description: 'a' },
  { name: 'beta', description: 'b' },
];

describe('planTask (M7: no heuristic fallback)', () => {
  test('needle chain validated into AgentPlan', async () => {
    const plan = await planTask('do things', 'alpha, beta', undefined, {
      primary: nativeCalls([
        { name: 'alpha', arguments: { x: 1 } },
        { name: 'beta', arguments: {} },
      ]),
    }, DECLS);
    assert.equal(plan.task, 'do things');
    assert.deepEqual(plan.steps.map(s => s.tool), ['alpha', 'beta']);
    assert.deepEqual(plan.steps[1].dependsOn, [1]);
  });

  test('needle failure falls to openrouter', async () => {
    const plan = await planTask('do things', 'alpha', undefined, {
      primary: failingNeedle(),
      escalation: openrouter([{ step: 1, task: 'solo', recommendedCategory: 'utility' }]),
    }, DECLS);
    assert.equal(plan.steps[0].task, 'solo');
  });

  test('all providers down throws honest error (no fake plan)', async () => {
    await assert.rejects(() => planTask('do things', 'alpha', undefined, {
      primary: failingNeedle(),
      escalation: failingEscalation(),
    }, DECLS), /nope/);
  });

  test('needle garbage with dead escalation throws, not fake plan', async () => {
    await assert.rejects(() => planTask('do things', 'alpha', undefined, {
      primary: { ...nativeCalls([]), generate: async () => ({ text: '}{{{', modelUsed: 'x', latencyMs: 1 }) },
      escalation: failingEscalation(),
    }, DECLS), /./);
  });

  test('unknown tools filtered; empty chain throws', async () => {
    await assert.rejects(() => planTask('do things', 'alpha', undefined, {
      primary: nativeCalls([{ name: 'ghost', arguments: {} }]),
    }, DECLS), /no plan steps|disabled|not set/);
  });
});
