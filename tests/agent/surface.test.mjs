import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RequestHandlers } from './.dist/handlers/request-handlers.js';
import { WorkflowOrchestrator } from './.dist/managers/workflow-orchestrator.js';

// Milestone 8: exercise the real MCP handler paths with stubbed discovery.
const fakeTools = [
  { name: 'get_weather', description: 'Get weather for a city', inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }, serverName: 'test', category: 'utility' },
  { name: 'get_time', description: 'Get current time', inputSchema: { type: 'object', properties: {}, }, serverName: 'test', category: 'utility' },
];

function handlers(transport) {
  const o = new WorkflowOrchestrator();
  if (transport) o.setTransport(transport);
  const h = new RequestHandlers(
    { getTools: () => fakeTools },
    {}, {}, {}, {}, {}, {}, {},
    o, undefined,
  );
  return { h, o };
}

const localTransport = async (server, tool, params) => {
  if (tool === 'get_weather') return { temp_c: 27, sky: 'clear', city: params.city };
  if (tool === 'get_time') return { time: '12:00' };
  throw new Error(`unknown tool ${tool}`);
};

describe('M8 handler surface', () => {
  test('workflow_status / workflow_cancel round-trip', async () => {
    const { h, o } = handlers(localTransport);
    const wf = await o.executeWorkflow({ workflowId: 'wstat', name: 'w', steps: [{ id: 'a', serverName: 't', toolName: 'get_time', parameters: {} }] });
    assert.equal(wf.status, 'completed');
    const st = await h.handleToolCall('workflow_status', { workflowId: 'wstat' });
    assert.equal(st.ok, true);
    assert.equal(st.status, 'completed');
    const missing = await h.handleToolCall('workflow_status', { workflowId: 'nope' });
    assert.equal(missing.ok, false);
    const cancelIdle = await h.handleToolCall('workflow_cancel', { workflowId: 'wstat' });
    assert.equal(cancelIdle.ok, false); // already completed, not running
  });

  test('workflow steps execute against bound transport (no placeholder)', async () => {
    const { h } = handlers(localTransport);
    const r = await h.handleToolCall('workflow_orchestrator', {
      workflowId: 'wreal', name: 'w',
      steps: [{ id: 'a', serverName: 't', toolName: 'get_weather', parameters: { city: 'Jakarta' } }],
    });
    assert.equal(r.status, 'completed');
    assert.deepEqual(r.steps[0].result, { temp_c: 27, sky: 'clear', city: 'Jakarta' });
  });

  test('agent_run disabled without env flag', async () => {
    const { h } = handlers(localTransport);
    const r = await h.handleToolCall('agent_run', { task: 'hi' });
    assert.equal(r.ok, false);
    assert.match(r.error, /disabled/);
  });
});

describe('M8 agent_run live', { skip: process.env.NEEDLE_LIVE === '1' ? false : 'needs NEEDLE_LIVE=1 and fetched engine' }, () => {
  test('agent_run end-to-end through handler (mock tools, live Needle)', async () => {
    process.env.MITOSIS_AGENT_ENABLED = 'true';
    const { h } = handlers(localTransport);
    const r = await h.handleToolCall('agent_run', { task: 'get weather in Jakarta', maxExecutionMs: 90000 });
    // The 45M model is stochastic: it may complete via tools, or escalate
    // (which fails keyless here). Either way the loop must have run — a
    // crash-shaped error fails this test.
    if (r.ok) {
      assert.ok(r.workflowId);
      assert.ok(Array.isArray(r.plan));
      assert.ok(r.stateStats);
    } else {
      assert.match(r.error, /escalation|escalated|budget spent/i);
    }
    delete process.env.MITOSIS_AGENT_ENABLED;
  });

  test('sequentialthinking becomes one Needle-backed agent step', async () => {
    process.env.MITOSIS_AGENT_ENABLED = 'true';
    const { h } = handlers(localTransport);
    const r = await h.handleToolCall('sequentialthinking', {
      thought: 'need the Jakarta weather first',
      thoughtNumber: 1, totalThoughts: 3, nextThoughtNeeded: true,
      task: 'get weather in Jakarta',
    });
    // Legacy-shaped fields preserved for compat callers.
    assert.equal(r.thoughtNumber, 1);
    assert.equal(typeof r.nextThoughtNeeded, 'boolean');
    // Agent-shaped fields prove the refined path ran.
    assert.equal(r.source, 'needle-agent');
    assert.ok(r.sessionId);
    assert.ok(r.decision && typeof r.decision.action === 'string');
    assert.ok(r.state);
    // Second thought continues the same session.
    const r2 = await h.handleToolCall('sequentialthinking', {
      thought: 'weather known, wrap up',
      thoughtNumber: 2, totalThoughts: 3, nextThoughtNeeded: false,
      task: 'get weather in Jakarta', sessionId: r.sessionId,
    });
    assert.equal(r2.sessionId, r.sessionId);
    delete process.env.MITOSIS_AGENT_ENABLED;
  });
});
