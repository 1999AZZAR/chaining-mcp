import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EscalationController } from './.dist/agent/escalation.js';
import { agentRun } from './.dist/agent/agent.js';

const call = (tool, args = {}) => JSON.stringify({ action: 'call_tool', tool, args });
const done = (result = 'ok') => JSON.stringify({ action: 'complete', result });
const escAction = (reason) => JSON.stringify({ action: 'escalate', reason });
const scriptProvider = (texts, healthy = true) => {
  let i = 0;
  return {
    metadata: () => ({ name: 's', kind: 'local', model: 's', capabilities: [] }),
    health: async () => healthy ? ({ ok: true }) : ({ ok: false, detail: 'down' }),
    generate: async () => ({ text: texts[Math.min(i++, texts.length - 1)], modelUsed: 's', latencyMs: 1 }),
  };
};
const TOOLS = [{ name: 'alpha' }];
const execOk = { executeTool: async () => ({}) };

describe('EscalationController', () => {
  test('budget enforced, trail recorded', () => {
    const c = new EscalationController({ maxEscalations: 1, repeatedToolFailureThreshold: 3 });
    assert.equal(c.escalated, false);
    c.escalate('low_confidence', '0.2');
    assert.equal(c.escalated, true);
    assert.deepEqual(c.trail.map(r => r.trigger), ['low_confidence']);
    assert.throws(() => c.escalate('refusal'), /budget spent.*low_confidence/);
  });

  test('repeated tool failures trip at threshold, success resets', () => {
    const c = new EscalationController({ maxEscalations: 2, repeatedToolFailureThreshold: 2 });
    assert.equal(c.noteToolResult(false), null);
    assert.equal(c.noteToolResult(false), 'repeated_tool_failure');
    assert.equal(c.noteToolResult(true), null);
    assert.equal(c.noteToolResult(false), null);
  });

  test('zero budget refuses immediately', () => {
    const c = new EscalationController({ maxEscalations: 0, repeatedToolFailureThreshold: 3 });
    assert.throws(() => c.escalate('refusal'), /budget spent/);
  });
});

describe('agentRun escalation policy', () => {
  test('trail returned; single escalation sticks (no ping-pong)', async () => {
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS, executor: execOk,
      providers: { primary: scriptProvider(['garbage{{{']), escalation: scriptProvider([done('recovered')]) },
      limits: { maxIterations: 5, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.equal(run.escalated, true);
    assert.deepEqual(run.escalations.map(e => e.trigger), ['malformed_output']);
  });

  test('escalation provider asking to escalate hits budget, run ends', async () => {
    await assert.rejects(() => agentRun({
      task: 't', toolSchemas: TOOLS, executor: execOk,
      providers: { primary: scriptProvider(['garbage{{{']), escalation: scriptProvider([escAction('still unsure')]) },
      limits: { maxIterations: 6, maxToolCalls: 3, maxExecutionMs: 5000 },
    }), /budget spent/);
  });

  test('repeated tool failures escalate mid-run', async () => {
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS,
      executor: { executeTool: async () => { throw new Error('kaput'); } },
      providers: {
        primary: scriptProvider([call('alpha'), call('alpha'), call('alpha'), done('after')]),
        escalation: scriptProvider([done('escalated-done')]),
      },
      escalationPolicy: { maxEscalations: 1, repeatedToolFailureThreshold: 3 },
      limits: { maxIterations: 8, maxToolCalls: 8, maxExecutionMs: 5000 },
    });
    assert.equal(run.escalated, true);
    assert.ok(run.escalations.some(e => e.trigger === 'repeated_tool_failure'));
  });

  test('explicit escalation decision maps refusal trigger', async () => {
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS, executor: execOk,
      providers: { primary: scriptProvider([escAction('I refuse: no tool fits')]), escalation: scriptProvider([done('e')]) },
      limits: { maxIterations: 5, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.deepEqual(run.escalations.map(e => e.trigger), ['refusal']);
  });

  test('AGENT_ESCALATION_ENABLED=false blocks escalation', async () => {
    process.env.AGENT_ESCALATION_ENABLED = 'false';
    try {
      await assert.rejects(() => agentRun({
        task: 't', toolSchemas: TOOLS, executor: execOk,
        providers: { primary: scriptProvider(['garbage{{{']), escalation: scriptProvider([done('e')]) },
        limits: { maxIterations: 4, maxToolCalls: 3, maxExecutionMs: 5000 },
      }), /budget spent/);
    } finally {
      delete process.env.AGENT_ESCALATION_ENABLED;
    }
  });
});
