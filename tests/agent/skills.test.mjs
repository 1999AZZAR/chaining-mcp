import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillDiscovery } from './.dist/skills/skill-discovery.js';
import { buildSkillGuidance } from './.dist/agent/guidance.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'skills');

describe('SkillDiscovery', () => {
  test('scans fixture dir, parses frontmatter', () => {
    const d = new SkillDiscovery();
    const skills = d.scan([FIXTURES]);
    assert.deepEqual(skills.map(s => s.name), ['deploy-bot', 'weather-helper']);
    const w = skills.find(s => s.name === 'weather-helper');
    assert.ok(w.description.includes('plain language'));
    assert.ok(w.files.includes('SKILL.md'));
  });

  test('missing dir scans empty, no throw', () => {
    assert.deepEqual(new SkillDiscovery().scan(['/nonexistent-xyz']), []);
  });

  test('search ranks by keyword', () => {
    const d = new SkillDiscovery();
    const hits = d.search('weather forecast', [FIXTURES]);
    assert.equal(hits[0].name, 'weather-helper');
    assert.deepEqual(d.search('zzzqqq-nope', [FIXTURES]), []);
  });

  test('get returns full body; unknown misses', () => {
    const d = new SkillDiscovery();
    const got = d.get('deploy-bot', [FIXTURES]);
    assert.ok(got.content.includes('Blue-green'));
    assert.deepEqual(got.files, ['SKILL.md']);
    assert.equal(d.get('ghost', [FIXTURES]), undefined);
  });
});

describe('buildSkillGuidance', () => {
  test('retrieves relevant skill lines, caps length', () => {
    const d = new SkillDiscovery();
    const g = buildSkillGuidance({ search: (q) => d.search(q, [FIXTURES]) }, 'what is the weather forecast', 300);
    assert.ok(g.includes('weather-helper'));
    assert.ok(g.length <= 301);
  });

  test('empty when nothing matches or catalog throws', () => {
    const d = new SkillDiscovery();
    assert.equal(buildSkillGuidance({ search: (q) => d.search(q, [FIXTURES]) }, 'zzzqqq nope', 300), '');
    assert.equal(buildSkillGuidance({ search: () => { throw new Error('x'); } }, 'weather', 300), '');
  });
});
