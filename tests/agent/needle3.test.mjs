import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  needleConfigFromEnv, needleDefaultsForGeneration, NEEDLE_NO_TELEMETRY_ENV,
} from './.dist/agent/needle-provider.js';

const KEYS = ['NEEDLE_GENERATION', 'NEEDLE_ENGINE_PATH', 'NEEDLE_MODEL_PATH', 'NEEDLE_DEPTH'];

function withEnv(vars, fn) {
  const saved = {};
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, vars);
  try { fn(); } finally {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

describe('Needle 3 generation switch', () => {
  test('default is gen 3 with v3 paths', () => {
    withEnv({}, () => {
      const c = needleConfigFromEnv();
      assert.equal(c.generation, '3');
      assert.equal(c.enginePath, 'assets/needle/needle3');
      assert.equal(c.modelPath, 'assets/needle/needle3.cact');
      assert.equal(c.depth, undefined);
    });
  });

  test('NEEDLE_GENERATION=2 selects legacy v2 paths', () => {
    withEnv({ NEEDLE_GENERATION: '2' }, () => {
      const c = needleConfigFromEnv();
      assert.equal(c.generation, '2');
      assert.ok(c.enginePath.endsWith('assets/needle/needle') || c.enginePath.endsWith('needle.exe'));
      assert.equal(c.modelPath, 'assets/needle/needle2.cact');
    });
  });

  test('explicit ENGINE/MODEL paths win over generation defaults', () => {
    withEnv({ NEEDLE_ENGINE_PATH: '/x/n', NEEDLE_MODEL_PATH: '/x/m.cact' }, () => {
      const c = needleConfigFromEnv();
      assert.equal(c.generation, '3');
      assert.equal(c.enginePath, '/x/n');
      assert.equal(c.modelPath, '/x/m.cact');
    });
  });

  test('NEEDLE_DEPTH validated: 8 ok, 1/garbage dropped', () => {
    withEnv({ NEEDLE_DEPTH: '8' }, () => assert.equal(needleConfigFromEnv().depth, 8));
    withEnv({ NEEDLE_DEPTH: '1' }, () => assert.equal(needleConfigFromEnv().depth, undefined));
    withEnv({ NEEDLE_DEPTH: 'abc' }, () => assert.equal(needleConfigFromEnv().depth, undefined));
  });

  test('telemetry kill-switch constants', () => {
    assert.equal(NEEDLE_NO_TELEMETRY_ENV.NEEDLE_TELEMETRY, '0');
    assert.equal(NEEDLE_NO_TELEMETRY_ENV.DO_NOT_TRACK, '1');
  });

  test('defaults helper covers both generations', () => {
    assert.deepEqual(needleDefaultsForGeneration('3'), { enginePath: 'assets/needle/needle3', modelPath: 'assets/needle/needle3.cact' });
    const v2 = needleDefaultsForGeneration('2');
    assert.equal(v2.modelPath, 'assets/needle/needle2.cact');
    assert.ok(v2.enginePath.includes('needle'));
  });
});
