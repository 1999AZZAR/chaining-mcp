import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildGuidance } from './.dist/agent/guidance.js';

const source = {
  searchPrompts: (q) => q.includes('weather')
    ? [{ id: 'w1', name: 'Weather Workflow', prompt: 'Check the forecast first, then act on it. '.repeat(20), expectedTools: ['get_weather'] }]
    : [],
  getAllPrompts: () => [
    { id: 'w1', name: 'Weather Workflow', prompt: 'Check the forecast first. '.repeat(20), expectedTools: ['get_weather'] },
    { id: 'g1', name: 'Generic Planning', prompt: 'Break work into steps. '.repeat(20), expectedTools: [] },
  ],
};

describe('buildGuidance', () => {
  test('keyword + expectedTools overlap retrieves guidance', () => {
    const g = buildGuidance(source, 'get weather in Jakarta', ['get_weather', 'other']);
    assert.ok(g.includes('Weather Workflow'));
    assert.ok(g.length <= 620);
  });

  test('empty when nothing relevant', () => {
    assert.equal(buildGuidance(source, 'zzzqqq unrelated', ['nope']), '');
  });

  test('expectedTools overlap alone suffices (no keyword hit)', () => {
    const g = buildGuidance(source, 'do something', ['get_weather']);
    assert.ok(g.includes('Weather Workflow'));
  });

  test('caps length and prompt count', () => {
    const big = { searchPrompts: () => [], getAllPrompts: () => source.getAllPrompts() };
    const g = buildGuidance(big, 'anything at all here', ['get_weather'], 100);
    assert.ok(g.length <= 101);
  });
});
