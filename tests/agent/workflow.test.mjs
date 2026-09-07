import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowOrchestrator } from './.dist/managers/workflow-orchestrator.js';
import { planToWorkflow, runAgentWorkflow } from './.dist/agent/workflow.js';

const okTransport = (impl) => async (server, tool, params, signal) => impl(tool, params, { server, signal });
const scriptProvider = (texts) => {
  let i = 0;
  return {
    metadata: () => ({ name: 's', kind: 'local', model: 's', capabilities: [] }),
    health: async () => ({ ok: true }),
    generate: async () => ({ text: texts[Math.min(i++, texts.length - 1)], modelUsed: 's', latencyMs: 1 }),
  };
};
const call = (tool, args = {}) => JSON.stringify({ action: 'call_tool', tool, args });
const done = (result = 'ok') => JSON.stringify({ action: 'complete', result });

describe('WorkflowOrchestrator transport seam', () => {
  test('placeholder default unchanged (no transport)', async () => {
    const o = new WorkflowOrchestrator();
    const r = await o.executeWorkflow({ workflowId: 'w1', name: 'w', steps: [{ id: 'a', serverName: 's', toolName: 'thing', parameters: {} }] });
    assert.equal(r.status, 'completed');
    assert.ok(r.overallResult.a.message.includes('thing'));
  });

  test('bound transport receives calls with resolved params', async () => {
    const seen = [];
    const o = new WorkflowOrchestrator();
    o.setTransport(okTransport((tool, params) => { seen.push([tool, params]); return { echo: params }; }));
    const r = await o.executeWorkflow({
      workflowId: 'w2', name: 'w', variables: { city: 'Jakarta' },
      steps: [{ id: 'a', serverName: 's', toolName: 'weather', parameters: { city: '$city' } }],
    });
    assert.equal(r.status, 'completed');
    assert.deepEqual(seen, [['weather', { city: 'Jakarta' }]]);
  });

  test('retries actually re-execute (flaky then ok)', async () => {
    let n = 0;
    const o = new WorkflowOrchestrator();
    o.setTransport(okTransport(() => { if (++n < 3) throw new Error('flaky'); return { n }; }));
    const r = await o.executeWorkflow({
      workflowId: 'w3', name: 'w',
      steps: [{ id: 'a', serverName: 's', toolName: 't', parameters: {}, retryOnFailure: true, maxRetries: 3 }],
    });
    assert.equal(r.status, 'completed');
    assert.equal(n, 3);
    assert.equal(r.steps[0].retryCount, 2);
  });

  test('retries exhausted marks step failed (no failFast)', async () => {
    let n = 0;
    const o = new WorkflowOrchestrator();
    o.setTransport(okTransport(() => { n++; throw new Error('always'); }));
    const r = await o.executeWorkflow({
      workflowId: 'w4', name: 'w',
      steps: [{ id: 'a', serverName: 's', toolName: 't', parameters: {}, retryOnFailure: true, maxRetries: 2 }],
    });
    assert.equal(r.status, 'failed');
    assert.equal(n, 3);
  });

  test('no retry config means single attempt', async () => {
    let n = 0;
    const o = new WorkflowOrchestrator();
    o.setTransport(okTransport(() => { n++; throw new Error('x'); }));
    const r = await o.executeWorkflow({
      workflowId: 'w5', name: 'w', steps: [{ id: 'a', serverName: 's', toolName: 't', parameters: {} }],
    });
    assert.equal(r.status, 'failed');
    assert.equal(n, 1);
  });

  test('cancelled workflow stops between batches', async () => {
    const order = [];
    const o = new WorkflowOrchestrator();
    o.setTransport(okTransport(async (tool) => { order.push(tool); return {}; }));
    const ctl = new AbortController();
    const p = o.executeWorkflow({
      workflowId: 'w6', name: 'w',
      steps: [
        { id: 'a', serverName: 's', toolName: 'first', parameters: {} },
        { id: 'b', serverName: 's', toolName: 'second', parameters: {}, dependsOn: ['a'] },
      ],
    }, ctl.signal);
    ctl.abort();
    const r = await p;
    assert.equal(r.status, 'cancelled');
  });

  test('executeTool registry guard', async () => {
    const o = new WorkflowOrchestrator();
    o.setTransport(okTransport((tool) => ({ tool })));
    o.setAllowedTools(['allowed']);
    assert.deepEqual(await o.executeTool('allowed', {}), { tool: 'allowed' });
    await assert.rejects(() => o.executeTool('evil', {}), /not in the agent tool registry/);
    o.clearAllowedTools();
    assert.deepEqual(await o.executeTool('evil', {}), { tool: 'evil' });
  });

  test('executeTool aborted signal throws before transport', async () => {
    const o = new WorkflowOrchestrator();
    o.setTransport(okTransport(() => { throw new Error('should not reach'); }));
    const ctl = new AbortController();
    ctl.abort();
    await assert.rejects(() => o.executeTool('t', {}, { signal: ctl.signal }), /aborted/);
  });
});

describe('planToWorkflow + runAgentWorkflow', () => {
  test('plan maps to dependency-ordered workflow', async () => {
    const { planToWorkflow: p2w } = await import('./.dist/agent/workflow.js');
    const wf = p2w({ task: 't', steps: [
      { step: 1, task: 'a', tool: 'ta', dependsOn: [] },
      { step: 2, task: 'b', tool: 'tb', dependsOn: [1] },
    ] }, { workflowId: 'pw' });
    assert.equal(wf.steps[1].dependsOn[0], 'step-1');
    assert.equal(wf.steps[0].toolName, 'ta');
  });

  test('agent drives orchestrator transport end-to-end (mock provider)', async () => {
    const o = new WorkflowOrchestrator();
    const seen = [];
    o.setTransport(okTransport((tool, params) => { seen.push(tool); return { tool, ok: true }; }));
    const native = (name, args) => JSON.stringify({ type: 'call', function_calls: [{ name, arguments: args }], confidence: 0.9 });
    const needleQueue = (texts) => {
      let i = 0;
      return {
        health: async () => ({ ok: true }),
        generate: async () => ({ text: texts[Math.min(i++, texts.length - 1)], modelUsed: 'mock', latencyMs: 1 }),
        confidenceOf: () => 0.9, isConfident: () => true,
        resetConversation: async () => undefined, stopServer: () => undefined,
      };
    };
    const { run, plan, state } = await runAgentWorkflow({
      task: 'do alpha', toolSchemas: [{ name: 'alpha', description: 'a' }],
      orchestrator: o,
      providers: {
        // M7: planner consumes NATIVE calls only — first entry plans, rest drive the loop.
        primary: needleQueue([
          native('alpha', { q: 0 }),
          native('alpha', { q: 1 }),
          native('alpha', { q: 1 }),
        ]),
        escalation: scriptProvider([done('unreached')]),
      },
    });
    assert.ok(plan.steps.length >= 1);
    void run;
    void state;
    assert.deepEqual(seen, ['alpha']);
  });

  test('agent cannot escape registry via orchestrator', async () => {
    const o = new WorkflowOrchestrator();
    o.setTransport(okTransport((tool) => ({ tool })));
    const native = (name, args) => JSON.stringify({ type: 'call', function_calls: [{ name, arguments: args }], confidence: 0.9 });
    let i = 0;
    const queue = [native('alpha', {}), native('ghost', {}), native('alpha', {}), native('alpha', {})];
    const { run } = await runAgentWorkflow({
      task: 't', toolSchemas: [{ name: 'alpha' }],
      orchestrator: o,
      providers: {
        primary: {
          metadata: () => ({ name: 's', kind: 'local', model: 's', capabilities: [] }),
          health: async () => ({ ok: true }),
          generate: async () => ({ text: queue[Math.min(i++, queue.length - 1)], modelUsed: 's', latencyMs: 1 }),
        },
      },
    });
    assert.equal(run.decision.action, 'complete');
  });
});
