import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recallEpisodicMemory, retainWorkflowDecision } from './.dist/agent/episodic-retention.js';
import { existsSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

describe('Episodic memory & retention (P1-C5)', () => {
  const testDb = 'test-episodic-memory.db';

  test('setup test database', () => {
    if (existsSync(testDb)) unlinkSync(testDb);
    const db = new DatabaseSync(testDb);
    db.exec(`
      CREATE TABLE entities (
        name TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        observations TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO entities (name, entity_type, observations, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('task:auth-service', 'task', JSON.stringify(['JWT authentication setup and token rotation']), now, now);
    db.close();
  });

  test('recallEpisodicMemory retrieves relevant observation by keyword', () => {
    const hint = recallEpisodicMemory('implement auth service and rotation', { memoryDbPath: testDb });
    assert.ok(hint.length > 0);
    assert.ok(hint.includes('task:auth-service'));
    assert.ok(hint.includes('JWT authentication setup'));
  });

  test('recallEpisodicMemory returns empty on no keyword hit', () => {
    const hint = recallEpisodicMemory('quux flibbertigibbet', { memoryDbPath: testDb });
    assert.equal(hint, '');
  });

  test('retainWorkflowDecision stores workflow execution into database', () => {
    process.env.HELA_MEMORY_DB_PATH = testDb;
    const ok = retainWorkflowDecision('build and test auth', ['read_file', 'execute_command'], 'verified pass');
    assert.equal(ok, true);

    const db = new DatabaseSync(testDb, { readOnly: true });
    const row = db.prepare('SELECT observations FROM entities WHERE name = ?').get('workflow:build-and-test-auth');
    assert.ok(row);
    assert.ok(row.observations.includes('read_file, execute_command'));
    db.close();
    delete process.env.HELA_MEMORY_DB_PATH;
  });

  test('cleanup', () => {
    if (existsSync(testDb)) unlinkSync(testDb);
  });
});

import { resolveSystemPromptPath } from './.dist/agent/needle-provider.js';

describe('Profile-aware system grounding (P1-C6)', () => {
  test('defaults to hela-system.txt when no profile is set', () => {
    delete process.env.HELA_PROFILE;
    delete process.env.NEEDLE_SYSTEM_PATH;
    const path = resolveSystemPromptPath();
    assert.equal(path, 'assets/needle/hela-system.txt');
  });

  test('resolves specific profile grounding card when HELA_PROFILE is set', () => {
    process.env.HELA_PROFILE = 'dev-workspace';
    const path = resolveSystemPromptPath();
    assert.equal(path, 'assets/needle/profiles/dev-workspace.txt');
    delete process.env.HELA_PROFILE;
  });

  test('falls back gracefully to hela-system.txt for unknown profile', () => {
    process.env.HELA_PROFILE = 'unknown-profile-xyz';
    const path = resolveSystemPromptPath();
    assert.equal(path, 'assets/needle/hela-system.txt');
    delete process.env.HELA_PROFILE;
  });
});
