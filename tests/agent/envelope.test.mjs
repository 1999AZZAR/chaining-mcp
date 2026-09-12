import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowOrchestrator } from './.dist/managers/workflow-orchestrator.js';
import { wrapHelaResult, wrapHelaError, isHelaResult } from './.dist/agent/hela-result.js';
import { RunStore } from './.dist/agent/run-store.js';

const contract = {
  capability: 'terminal.execute', operation: 'exec', risk: 'write', idempotent: false,
  openWorld: false, requiresApproval: false, timeoutMs: 5000,
  sideEffects: ['spawns process'], secretsExposure: 'none', provenanceRequired: false,
};

describe('HelaResult envelope (P1-C1 Mitosis adapter)', () => {
  test('wrap raw payload: ok/data/summary/execution', () => {
    const e = wrapHelaResult({ echo: 's1' }, { toolName: 't', serverName: 's' });
    assert.equal(e.ok, true);
    assert.deepEqual(e.data, { echo: 's1' });
    assert.ok(e.summary.includes('t'));
    assert.deepEqual(e.artifacts, []);
    assert.deepEqual(e.provenance, []);
    assert.deepEqual(e.warnings, []);
    assert.deepEqual(e.sideEffects, []);
    assert.equal(e.execution.toolName, 't');
    assert.equal(e.execution.serverName, 's');
    assert.deepEqual(e.redaction, { applied: false, fields: [] });
    assert.ok(isHelaResult(e));
  });

  test('contract sideEffects + run meta carried', () => {
    const e = wrapHelaResult({}, { toolName: 'x', contract, run: { run_id: 'r', step_id: 's1', attempt: 1, policy_profile: 'full-access' } });
    assert.deepEqual(e.sideEffects, ['spawns process']);
    assert.equal(e.execution.run_id, 'r');
    assert.equal(e.execution.step_id, 's1');
  });

  test('wrap is idempotent (envelope passes through by ref)', () => {
    const e1 = wrapHelaResult({ a: 1 }, { toolName: 't' });
    assert.equal(wrapHelaResult(e1), e1);
  });

  test('legacy structured normalized to data, never dual-fielded', () => {
    const e = wrapHelaResult({ structured: { a: 1 } }, { toolName: 't' });
    assert.deepEqual(e.data, { a: 1 });
    assert.ok(!('structured' in e));
    assert.equal(e.warnings.length, 1);
  });

  test('isHelaResult rejects raw/null/partial', () => {
    assert.equal(isHelaResult({ echo: 1 }), false);
    assert.equal(isHelaResult(null), false);
    assert.equal(isHelaResult({ ok: true, summary: 'x' }), false);
  });

  test('wrapHelaError: ok=false with message', () => {
    const e = wrapHelaError(new Error('boom'), { toolName: 't' });
    assert.equal(e.ok, false);
    assert.equal(e.data, null);
    assert.ok(e.error.includes('boom'));
    assert.ok(isHelaResult(e));
  });

  test('executeTool default stays raw (back-compat)', async () => {
    const o = new WorkflowOrchestrator();
    const r = await o.executeTool('thing', {});
    assert.equal(r.success, true);
    assert.ok(!('artifacts' in r));
    assert.equal(isHelaResult(r), false);
  });

  test('executeTool envelope:true returns envelope, data=raw', async () => {
    const o = new WorkflowOrchestrator();
    const r = await o.executeTool('thing', {}, { serverName: 's', envelope: true });
    assert.ok(isHelaResult(r));
    assert.equal(r.data.success, true);
    assert.equal(r.execution.toolName, 'thing');
  });

  test('executeTool envelope:true still persists RAW payload for resume', async () => {
    const store = new RunStore(':memory:');
    try {
      store.createRun('t', { runId: 'r1', workflowId: 'r1' });
      const o = new WorkflowOrchestrator();
      o.attachRunStore(store);
      const r = await o.executeTool('thing', {}, {
        serverName: 's', envelope: true, run: { run_id: 'r1', step_id: 's1', attempt: 1, policy_profile: 'full-access' },
      });
      assert.ok(isHelaResult(r));
      const saved = store.getStep('r1', 's1');
      const raw = JSON.parse(saved.result);
      assert.equal(raw.success, true);
      assert.ok(!('artifacts' in raw));
    } finally {
      store.close();
    }
  });
});
