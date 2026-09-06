import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AgentStateManager } from './.dist/agent/state.js';
import { agentRun } from './.dist/agent/agent.js';

const call = (tool, args = {}) => JSON.stringify({ action: 'call_tool', tool, args });
const done = (result = 'ok') => JSON.stringify({ action: 'complete', result });
const scriptProvider = (texts) => {
  let i = 0;
  return {
    metadata: () => ({ name: 'script', kind: 'local', model: 's', capabilities: [] }),
    health: async () => ({ ok: true }),
    generate: async () => ({ text: texts[Math.min(i++, texts.length - 1)], modelUsed: 's', latencyMs: 1 }),
  };
};

describe('AgentStateManager', () => {
  test('create/record/snapshot/terminate lifecycle', async () => {
    const m = new AgentStateManager();
    const s = m.create('do x', 's1', 'w1');
    assert.equal(s.id, 's1');
    m.record('s1', { kind: 'tool_call', tool: 'a', args: {} });
    m.record('s1', { kind: 'tool_result', tool: 'a', result: { v: 1 } });
    m.record('s1', { kind: 'decision', decision: { action: 'complete' } });
    const fin = m.terminate('s1', 'completed');
    assert.equal(fin.terminated.reason, 'completed');
    const st = m.stats('s1');
    assert.deepEqual([st.toolCalls, st.errors, st.escalations], [1, 0, 0]);
    assert.throws(() => m.record('s1', { kind: 'observation', text: 'late' }), /terminated/);
  });

  test('bounded history drops oldest, counts drops', () => {
    const m = new AgentStateManager(5);
    m.create('t', 'b');
    for (let i = 0; i < 8; i++) m.record('b', { kind: 'observation', text: `o${i}` });
    const snap = m.snapshot('b');
    assert.equal(snap.events.length, 5);
    assert.equal(snap.droppedEvents, 3);
    assert.equal(snap.events[0].text, 'o3');
  });

  test('tail renders compact lines; sessionsForWorkflow groups', () => {
    const m = new AgentStateManager();
    m.create('t', 'c', 'wf-9');
    m.record('c', { kind: 'tool_call', tool: 'alpha', args: { x: 1 } });
    m.record('c', { kind: 'tool_result', tool: 'alpha', error: 'kaput' });
    m.record('c', { kind: 'escalation', reason: 'low conf' });
    const tail = m.tail('c');
    assert.ok(tail[0].startsWith('call alpha'));
    assert.ok(tail[1].includes('ERROR'));
    assert.deepEqual(m.sessionsForWorkflow('wf-9'), ['c']);
    assert.equal(m.delete('c'), true);
    assert.equal(m.snapshot('c'), undefined);
  });

  test('unknown session errors', () => {
    const m = new AgentStateManager();
    assert.throws(() => m.record('nope', { kind: 'observation', text: 'x' }), /unknown/);
    assert.equal(m.stats('nope'), undefined);
  });
});

describe('agentRun state recording', () => {
  test('loop records session with tool + decision + termination', async () => {
    const m = new AgentStateManager();
    const run = await agentRun({
      task: 't', toolSchemas: [{ name: 'alpha' }],
      executor: { executeTool: async () => ({ v: 1 }) },
      providers: { primary: scriptProvider([call('alpha'), done('fin')]) },
      state: { manager: m, sessionId: 'run-1', workflowId: 'wf-1' },
      limits: { maxIterations: 4, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.equal(run.sessionId, 'run-1');
    const st = m.stats('run-1');
    assert.equal(st.toolCalls, 1);
    assert.equal(st.terminated, 'completed');
    assert.deepEqual(m.sessionsForWorkflow('wf-1'), ['run-1']);
  });

  test('limit breach terminates session with reason', async () => {
    const m = new AgentStateManager();
    await assert.rejects(() => agentRun({
      task: 't', toolSchemas: [{ name: 'alpha' }],
      executor: { executeTool: async () => ({}) },
      providers: { primary: scriptProvider([call('alpha', { i: 1 }), call('alpha', { i: 2 }), call('alpha', { i: 3 })]) },
      state: { manager: m, sessionId: 'run-2' },
      limits: { maxIterations: 8, maxToolCalls: 2, maxExecutionMs: 5000 },
    }), /tool call limit/);
    assert.equal(m.stats('run-2').terminated, 'tool_call_limit');
  });

  test('no state option means no sessionId, same behavior', async () => {
    const run = await agentRun({
      task: 't', toolSchemas: [{ name: 'alpha' }],
      executor: { executeTool: async () => ({}) },
      providers: { primary: scriptProvider([done('x')]) },
      limits: { maxIterations: 3, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.equal(run.sessionId, undefined);
    assert.equal(run.decision.action, 'complete');
  });
});
