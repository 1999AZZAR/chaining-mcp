import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { agentRun } from './.dist/agent/agent.js';

const TOOLS = [{ name: 'alpha', description: 'first tool' }, { name: 'beta', description: 'second tool' }];
const exec = (impl = async (t, a) => ({ t, a })) => ({ executeTool: impl });
const okProvider = (text, model = 'mock') => ({
  metadata: () => ({ name: 'mock', kind: 'local', model, capabilities: [] }),
  health: async () => ({ ok: true }),
  generate: async () => ({ text, modelUsed: model, latencyMs: 1 }),
});
const scriptProvider = (texts) => {
  let i = 0;
  return {
    metadata: () => ({ name: 'script', kind: 'local', model: 'script', capabilities: [] }),
    health: async () => ({ ok: true }),
    generate: async () => ({ text: texts[Math.min(i++, texts.length - 1)], modelUsed: 'script', latencyMs: 1 }),
  };
};
const failingProvider = (msg) => ({
  metadata: () => ({ name: 'fail', kind: 'local', model: 'fail', capabilities: [] }),
  health: async () => ({ ok: true }),
  generate: async () => { throw Object.assign(new Error(msg), { code: 'UNKNOWN', retryable: true }); },
});
const call = (tool, args = {}) => JSON.stringify({ action: 'call_tool', tool, args });
const done = (result = 'ok') => JSON.stringify({ action: 'complete', result });

describe('agent loop', () => {
  test('single tool call then complete', async () => {
    const seen = [];
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS,
      executor: exec(async (t, a) => { seen.push([t, a]); return { r: 1 }; }),
      providers: { primary: scriptProvider([call('alpha', { x: 1 }), done('fin')]) },
      limits: { maxIterations: 4, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.deepEqual(seen, [['alpha', { x: 1 }]]);
    assert.equal(run.decision.action, 'complete');
    assert.equal(run.escalated, false);
  });

  test('unknown tool rejected, loop continues', async () => {
    const seen = [];
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS,
      executor: exec(async (t) => { seen.push(t); return {}; }),
      providers: { primary: scriptProvider([call('ghost'), call('beta'), done()]) },
      limits: { maxIterations: 5, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.deepEqual(seen, ['beta']);
    assert.equal(run.toolCalls, 1);
  });

  test('identical re-call saturates into complete', async () => {
    let n = 0;
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS,
      executor: exec(async () => { n++; return { v: 42 }; }),
      providers: { primary: scriptProvider([call('alpha'), call('alpha'), call('alpha')]) },
      limits: { maxIterations: 5, maxToolCalls: 5, maxExecutionMs: 5000 },
    });
    assert.equal(n, 1);
    assert.equal(run.decision.action, 'complete');
    assert.deepEqual(run.decision.result, { v: 42 });
  });

  test('iteration limit enforced', async () => {
    await assert.rejects(() => agentRun({
      task: 't', toolSchemas: TOOLS, executor: exec(),
      providers: { primary: scriptProvider([JSON.stringify({ action: 'revise', note: 'again' })]) },
      limits: { maxIterations: 2, maxToolCalls: 3, maxExecutionMs: 5000 },
    }), /iteration limit/);
  });

  test('tool call limit enforced', async () => {
    await assert.rejects(() => agentRun({
      task: 't', toolSchemas: TOOLS, executor: exec(),
      providers: { primary: scriptProvider([call('alpha'), call('beta'), call('alpha', { z: 1 })]) },
      limits: { maxIterations: 8, maxToolCalls: 2, maxExecutionMs: 5000 },
    }), /tool call limit/);
  });

  test('malformed primary output escalates', async () => {
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS, executor: exec(),
      providers: { primary: scriptProvider(['not json{{{']), escalation: okProvider(done('via-escalation')) },
      limits: { maxIterations: 4, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.equal(run.escalated, true);
    assert.equal(run.decision.result, 'via-escalation');
  });

  test('primary failure escalates; escalation failure carries observation count', async () => {
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS, executor: exec(),
      providers: { primary: failingProvider('boom'), escalation: okProvider(done('recovered')) },
      limits: { maxIterations: 4, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.equal(run.escalated, true);
    await assert.rejects(() => agentRun({
      task: 't', toolSchemas: TOOLS, executor: exec(),
      providers: { primary: scriptProvider([call('alpha'), 'garbage{{{']), escalation: failingProvider('down') },
      limits: { maxIterations: 5, maxToolCalls: 3, maxExecutionMs: 5000 },
    }), /prior observations/);
  });

  test('unhealthy primary starts escalated', async () => {
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS, executor: exec(),
      providers: { primary: { ...okProvider(done('e')), health: async () => ({ ok: false, detail: 'nope' }) }, escalation: okProvider(done('e')) },
      limits: { maxIterations: 3, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.equal(run.escalated, true);
  });

  test('tool errors feed back, loop continues', async () => {
    let n = 0;
    const run = await agentRun({
      task: 't', toolSchemas: TOOLS,
      executor: exec(async () => { if (++n === 1) throw new Error('kaput'); return 'fixed'; }),
      providers: { primary: scriptProvider([call('alpha'), call('beta'), done('recovered')]) },
      limits: { maxIterations: 5, maxToolCalls: 4, maxExecutionMs: 5000 },
    });
    assert.equal(n, 2);
    assert.equal(run.decision.action, 'complete');
  });
});
