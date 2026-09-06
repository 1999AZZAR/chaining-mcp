import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planTask } from './.dist/agent/agent.js';

const needlePlan = (steps) => ({
  health: async () => ({ ok: true }),
  generate: async () => ({
    text: JSON.stringify({ type: 'call', function_calls: steps.map(s => ({ name: 'define_step', arguments: s })), confidence: 0.9 }),
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

describe('planTask', () => {
  test('needle plan validated into AgentPlan', async () => {
    const plan = await planTask('do things', 'alpha, beta', undefined, {
      primary: needlePlan([{ step: 1, task: 'first', tool: 'alpha' }, { step: 2, task: 'second', tool: 'beta', dependsOn: [1] }]),
    });
    assert.equal(plan.task, 'do things');
    assert.equal(plan.steps.length, 2);
    assert.equal(plan.steps[1].dependsOn[0], 1);
  });

  test('needle failure falls to openrouter', async () => {
    const plan = await planTask('do things', 'alpha', undefined, {
      primary: failingNeedle(),
      escalation: openrouter([{ step: 1, task: 'solo', recommendedCategory: 'utility' }]),
    });
    assert.equal(plan.steps[0].task, 'solo');
  });

  test('all providers down falls to legacy heuristic', async () => {
    const plan = await planTask('do things', 'alpha', undefined, {
      primary: failingNeedle(),
      escalation: { health: async () => ({ ok: false }), generate: async () => { throw new Error('nope'); } },
    });
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.steps[0].recommendedCategory, 'analysis');
  });

  test('needle garbage falls through, not crash', async () => {
    const plan = await planTask('do things', 'alpha', undefined, {
      primary: { ...needlePlan([]), generate: async () => ({ text: '}{{{', modelUsed: 'x', latencyMs: 1 }) },
      escalation: { health: async () => ({ ok: false }), generate: async () => { throw new Error('nope'); } },
    });
    assert.equal(plan.steps.length, 3);
  });
});
