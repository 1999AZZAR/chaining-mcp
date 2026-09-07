import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { agentStep, translateNativeDecision, parseDecision } from './.dist/agent/agent.js';
import { AgentStateManager } from './.dist/agent/state.js';

const call = (tool, args = {}) => JSON.stringify({ action: 'call_tool', tool, args });
const done = (result = 'ok') => JSON.stringify({ action: 'complete', result });
const nativeCall = (name, args = {}) => JSON.stringify({ type: 'call', function_calls: [{ name, arguments: args }], confidence: 0.9 });
const scriptProvider = (texts) => {
  let i = 0;
  return {
    metadata: () => ({ name: 's', kind: 'local', model: 's', capabilities: [] }),
    health: async () => ({ ok: true }),
    generate: async () => ({ text: texts[Math.min(i++, texts.length - 1)], modelUsed: 's', latencyMs: 1 }),
  };
};
const TOOLS = [{ name: 'alpha', description: 'a' }];

describe('translateNativeDecision', () => {
  test('respond/call/refusal shapes', () => {
    assert.deepEqual(JSON.parse(translateNativeDecision(JSON.stringify({ type: 'respond', reasoning: 'hi', function_calls: [] }), null)).action, 'complete');
    assert.deepEqual(JSON.parse(translateNativeDecision(JSON.stringify({ type: 'call', function_calls: [] }), null)).action, 'escalate');
    const d = JSON.parse(translateNativeDecision(nativeCall('alpha', { x: 1 }), null));
    assert.deepEqual([d.action, d.tool, d.args], ['call_tool', 'alpha', { x: 1 }]);
  });
  test('non-native passes through for normal parsing', () => {
    assert.deepEqual(parseDecision(translateNativeDecision(done('x'), null)).action, 'complete');
  });
});

describe('agentStep', () => {
  test('observation + decision recorded; call without executor', async () => {
    const m = new AgentStateManager();
    const s = await agentStep({
      task: 't', observation: 'hmm alpha next', tools: TOOLS,
      providers: { primary: scriptProvider([call('alpha', { x: 1 })]) },
      state: m,
    });
    assert.equal(s.decision.action, 'call_tool');
    assert.equal(s.result, undefined);
    const st = m.stats(s.sessionId);
    assert.equal(st.toolCalls, 1); // recorded intent
    assert.equal(st.terminated, undefined);
    assert.ok(m.tail(s.sessionId).join('|').includes('hmm alpha next')); // observation visible in tail
  });

  test('execute=true runs executor and records result', async () => {
    const m = new AgentStateManager();
    const s = await agentStep({
      task: 't', tools: TOOLS, execute: true,
      executor: { executeTool: async () => ({ v: 7 }) },
      providers: { primary: scriptProvider([call('alpha')]) },
      state: m,
    });
    assert.deepEqual(s.result, { v: 7 });
    assert.equal(m.stats(s.sessionId).toolCalls, 1);
  });

  test('unknown tool rejected without throwing', async () => {
    const m = new AgentStateManager();
    const s = await agentStep({
      task: 't', tools: TOOLS, execute: true,
      executor: { executeTool: async () => { throw new Error('must not run'); } },
      providers: { primary: scriptProvider([call('ghost')]) },
      state: m,
    });
    assert.match(s.error, /not in the agent tool registry/);
  });

  test('sessions continue across steps; revise and branch recorded', async () => {
    const m = new AgentStateManager();
    const s1 = await agentStep({
      task: 't', observation: 'first', tools: TOOLS,
      providers: { primary: scriptProvider([call('alpha')]) },
      state: m, sessionId: 'cont-1',
    });
    const s2 = await agentStep({
      task: 't', observation: 'second', tools: TOOLS,
      revision: 'better idea', branch: { branchId: 'b1', fromEvent: 1 },
      providers: { primary: scriptProvider([done('fin')]) },
      state: m, sessionId: 'cont-1',
    });
    assert.equal(s1.sessionId, s2.sessionId);
    const snap = m.snapshot('cont-1');
    const kinds = snap.events.map(e => e.kind);
    assert.ok(kinds.includes('observation') && kinds.includes('revision') && kinds.includes('branch'));
    assert.equal(snap.terminated.reason, 'completed');
  });

  test('both layers escalate → recorded, returned as escalated', async () => {
    const m = new AgentStateManager();
    const s = await agentStep({
      task: 't', tools: TOOLS,
      providers: {
        primary: scriptProvider([JSON.stringify({ action: 'escalate', reason: 'stuck' })]),
        escalation: scriptProvider([JSON.stringify({ action: 'escalate', reason: 'still stuck' })]),
      },
      state: m,
    });
    assert.equal(s.escalated, true);
    assert.equal(s.decision.action, 'escalate');
    const snap = m.snapshot(s.sessionId);
    assert.ok(snap.events.filter(e => e.kind === 'escalation').length >= 2);
  });

  test('needle escalate hands the turn to OpenRouter (escalation decides)', async () => {
    const m = new AgentStateManager();
    const s = await agentStep({
      task: 't', tools: TOOLS,
      providers: {
        primary: scriptProvider([JSON.stringify({ action: 'escalate', reason: 'needle unsure' })]),
        escalation: scriptProvider([call('alpha', { q: 9 })]),
      },
      state: m,
    });
    assert.equal(s.escalated, true);
    assert.equal(s.decision.action, 'call_tool');
    assert.equal(s.decision.tool, 'alpha');
    const snap = m.snapshot(s.sessionId);
    assert.ok(snap.events.some(e => e.kind === 'escalation'));
  });

  test('escalation failing too leaves the agent trail as the last layer', async () => {
    const m = new AgentStateManager();
    const s = await agentStep({
      task: 't', tools: TOOLS,
      providers: {
        primary: scriptProvider([JSON.stringify({ action: 'escalate', reason: 'needle unsure' })]),
        escalation: { ...scriptProvider([]), generate: async () => { throw new Error('escalation down'); } },
      },
      state: m, sessionId: 'last-layer',
    });
    // No throw: a shaped escalate outcome with the trail is the last layer.
    assert.equal(s.escalated, true);
    assert.equal(s.decision.action, 'escalate');
    assert.match(s.error, /escalation failed after Needle/);
    assert.ok(m.stats('last-layer').escalations >= 2);
  });
});
