import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { agentRun } from './.dist/agent/agent.js';
import { planToWorkflow } from './.dist/agent/workflow.js';
import { parallelize } from './.dist/agent/agent.js';
import { WorkflowOrchestrator } from './.dist/managers/workflow-orchestrator.js';

const call = (tool, args = {}) => JSON.stringify({ action: 'call_tool', tool, args });
const done = (result = 'ok') => JSON.stringify({ action: 'complete', result });
const revise = (note) => JSON.stringify({ action: 'revise', note });
const scriptProvider = (texts) => {
  let i = 0;
  return {
    metadata: () => ({ name: 's', kind: 'local', model: 's', capabilities: [] }),
    health: async () => ({ ok: true }),
    generate: async () => ({ text: texts[Math.min(i++, texts.length - 1)], modelUsed: 's', latencyMs: 1 }),
  };
};
const TOOLS = [{ name: 'search' }, { name: 'fetch' }];
const execOk = { executeTool: async () => ({}) };
const limits = { maxIterations: 8, maxToolCalls: 8, maxExecutionMs: 5000 };

describe('replanning and multi-observation', () => {
  test('revise updates state and loop continues to a decision', async () => {
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS, executor: execOk,
      providers: { primary: scriptProvider([revise('search too broad, narrow it'), call('search', { q: 'needle' }), done('found')]) },
      limits,
    });
    assert.equal(run.decision.action, 'complete');
    assert.equal(run.toolCalls, 1);
    assert.equal(run.iterations, 3);
  });

  test('saturation across three turns completes with last result', async () => {
    let n = 0;
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS,
      executor: { executeTool: async () => ({ page: ++n }) },
      providers: { primary: scriptProvider([call('fetch', { p: 1 }), call('fetch', { p: 1 }), call('fetch', { p: 1 })]) },
      limits,
    });
    assert.equal(n, 1);
    assert.deepEqual(run.decision.result, { page: 1 });
  });

  test('parallel plan steps share no dependencies and run together', async () => {
    const seen = [];
    const o = new WorkflowOrchestrator();
    o.setTransport(async (s, t) => { seen.push(t); return { t }; });
    const wf = planToWorkflow({ task: 't', steps: [
      { step: 1, task: 'a', tool: 'ta', dependsOn: [] },
      { step: 2, task: 'b', tool: 'tb', dependsOn: [] },
      { step: 3, task: 'c', tool: 'tc', dependsOn: [1, 2] },
    ] }, { workflowId: 'par' });
    assert.deepEqual(wf.steps[2].dependsOn, ['step-1', 'step-2']);
    const r = await o.executeWorkflow(wf);
    assert.equal(r.status, 'completed');
    assert.deepEqual([...seen].sort(), ['ta', 'tb', 'tc']);
  });

  test('circular plan dependencies fail with a clear error', async () => {
    const o = new WorkflowOrchestrator();
    o.setTransport(async () => ({}));
    const r = await o.executeWorkflow({
      workflowId: 'cyc', name: 'c',
      steps: [
        { id: 'a', serverName: 's', toolName: 'ta', parameters: {}, dependsOn: ['b'] },
        { id: 'b', serverName: 's', toolName: 'tb', parameters: {}, dependsOn: ['a'] },
      ],
    });
    assert.equal(r.status, 'failed');
    assert.match(r.error, /Circular dependency/);
  });

  test('failFast aborts the workflow on first step failure', async () => {
    const seen = [];
    const o = new WorkflowOrchestrator();
    o.setTransport(async (s, t) => { seen.push(t); if (t === 'bad') throw new Error('nope'); return {}; });
    const r = await o.executeWorkflow({
      workflowId: 'ff', name: 'f', failFast: true,
      steps: [
        { id: 'a', serverName: 's', toolName: 'bad', parameters: {} },
        { id: 'b', serverName: 's', toolName: 'good', parameters: {}, dependsOn: ['a'] },
      ],
    });
    assert.equal(r.status, 'failed');
  });
});

describe('parallelize (evidence-based dependencies)', () => {
  test('task-grounded literals run parallel', () => {
    const out = parallelize([
      { step: 1, task: 'a', tool: 'weather', args: { city: 'Jakarta' } },
      { step: 2, task: 'b', tool: 'lights', args: { room: 'living room', on: true } },
    ], 'get weather in Jakarta and turn on living room lights');
    assert.deepEqual(out.map(s => s.dependsOn), [[], []]);
  });

  test('output references chain to prior step', () => {
    const out = parallelize([
      { step: 1, task: 'a', tool: 'search', args: { q: 'Zhang Wei' } },
      { step: 2, task: 'b', tool: 'send', args: { to: 'uid-4821', text: 'hi' } },
    ], 'findZhang Wei and text her hi');
    assert.deepEqual(out.map(s => s.dependsOn), [[], [1]]);
  });

  test('numbers and booleans never force serialization', () => {
    const out = parallelize([
      { step: 1, task: 'a', tool: 'lights', args: { brightness: 30 } },
      { step: 2, task: 'b', tool: 'thermo', args: { temp: 21, mode: 'cool' } },
    ], 'dim lights and cool the room');
    assert.deepEqual(out.map(s => s.dependsOn), [[], []]);
  });

  test('nested arg references detected', () => {
    const out = parallelize([
      { step: 1, task: 'a', tool: 'fetch', args: { url: 'http://x' } },
      { step: 2, task: 'b', tool: 'write', args: { files: [{ path: '/tmp/out', content: '$step-1.body' }] } },
    ], 'fetch a page and save it');
    assert.deepEqual(out.map(s => s.dependsOn), [[], [1]]);
  });
});
