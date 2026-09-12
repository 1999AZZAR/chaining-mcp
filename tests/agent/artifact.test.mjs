import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sha256Hex, artifactFromBytes, artifactFromFile,
  redactFields, commonSecretRules, isHelaResult, wrapHelaResult,
} from './.dist/agent/hela-result.js';

describe('HelaResult artifacts + redaction (P1-C3 shared helpers)', () => {
  test('sha256Hex matches known vector', () => {
    assert.equal(
      sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  test('artifactFromBytes: content-addressed uri, size, media_type', () => {
    const a = artifactFromBytes('hello', { media_type: 'text/plain' });
    assert.ok(a.uri.startsWith('bytes:sha256:'));
    assert.equal(a.sha256, sha256Hex('hello'));
    assert.equal(a.size, 5);
    assert.equal(a.media_type, 'text/plain');
    const b = artifactFromBytes('hello');
    assert.equal(b.uri, a.uri); // identical payloads dedupe
    assert.equal(b.media_type, undefined);
  });

  test('artifactFromFile: file uri, stat size, content hash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hela-artifact-'));
    try {
      const path = join(dir, 'note.txt');
      writeFileSync(path, 'file-bytes');
      const a = artifactFromFile(path, { media_type: 'text/plain' });
      assert.equal(a.uri, `file://${path}`);
      assert.equal(a.size, 10);
      assert.equal(a.sha256, sha256Hex('file-bytes'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('redactFields: secret keys scrubbed at any depth, meta lists fields', () => {
    const input = {
      query: 'weather in Bandung',
      api_key: 'sk-live-123',
      nested: { password: 'hunter2', safe: 'keep me' },
      list: [{ token: 'tok-abc' }],
    };
    const { data, redaction } = redactFields(input, commonSecretRules());
    assert.equal(data.api_key, '[REDACTED]');
    assert.equal(data.nested.password, '[REDACTED]');
    assert.equal(data.list[0].token, '[REDACTED]');
    assert.equal(data.query, 'weather in Bandung');
    assert.equal(data.nested.safe, 'keep me');
    assert.equal(redaction.applied, true);
    assert.ok(redaction.fields.includes('api_key'));
    assert.ok(redaction.fields.includes('password'));
    assert.ok(redaction.fields.includes('token'));
    // input untouched (pure)
    assert.equal(input.api_key, 'sk-live-123');
  });

  test('redactFields: field match is case-insensitive; patterns replace inline', () => {
    const { data, redaction } = redactFields(
      { API_KEY: 'x', note: 'call Bearer abc123 now' },
      [{ field: 'api_key' }, { pattern: /Bearer \S+/g }],
    );
    assert.equal(data.API_KEY, '[REDACTED]');
    assert.equal(data.note, 'call [REDACTED] now');
    assert.equal(redaction.applied, true);
  });

  test('redactFields: clean payload reports applied=false', () => {
    const { data, redaction } = redactFields({ a: 1, b: 'plain' }, commonSecretRules());
    assert.deepEqual(data, { a: 1, b: 'plain' });
    assert.deepEqual(redaction, { applied: false, fields: [] });
  });

  test('redaction meta fits the HelaResult.redaction slot', () => {
    const { data, redaction } = redactFields({ secret: 's3' }, commonSecretRules());
    const envelope = { ...wrapHelaResult(data, { toolName: 't' }), redaction };
    assert.ok(isHelaResult(envelope));
    assert.equal(envelope.redaction.applied, true);
    assert.deepEqual(envelope.redaction.fields, ['secret']);
  });
});
