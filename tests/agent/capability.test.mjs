import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { agentRun } from './.dist/agent/agent.js';
import {
  HELA_CAPABILITIES, selectCapabilitiesForTask, scopeToolsForTask,
  capabilityOfTool, promptContextSize, stemWord, stemMatches,
  CAPABILITY_TRANSITIONS, scopeCompactTools, recallCapabilityPrecedents,
} from './.dist/agent/capability-graph.js';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const T = (name, server, description = '') => ({ name, server, description });
const MIXED = [
  T('read_file', 'filesystem', 'read a file'), T('list_directory', 'filesystem', 'list dir'),
  T('write_file', 'filesystem', 'write a file'), T('execute_command', 'terminal', 'run shell'),
  T('google_search', 'researcher', 'web search'), T('browser_click', 'browser', 'click element'),
  T('browser_screenshot', 'browser', 'capture page'), T('tap_screen', 'scrcpy', 'tap device'),
  T('render_output', 'll3m', 'render scene'), T('generate_tokens', 'designer', 'design tokens'),
  T('open_nodes', 'project', 'read memory graph'),
];

describe('capability graph (P1-C4)', () => {
  test('registry covers the 8 required capability families', () => {
    const names = new Set(HELA_CAPABILITIES.map(c => c.name));
    for (const c of ['filesystem.read', 'filesystem.write', 'terminal.execute', 'browser.observe',
      'browser.act', 'research.search', 'project.query', 'android.inspect',
      'android.control', 'blender.model', 'ui.design']) {
      assert.ok(names.has(c), `missing ${c}`);
    }
  });

  test('route-accuracy corpus: task -> expected capability', () => {
    const cases = [
      ['read the config file and list the directory', 'filesystem.read'],
      ['run pytest and build the project', 'terminal.execute'],
      ['search google for latest AI news', 'research.search'],
      ['tap the submit button on the android phone screen', 'android.control'],
      ['render a cube in blender viewport', 'blender.model'],
      ['design a landing page component with new palette', 'ui.design'],
      ['remember this project entity in memory', 'project.query'],
      ['take a screenshot of the webpage', 'browser.observe'],
      ['click submit to navigate and login', 'browser.act'],
      ['what is on the device screen', 'android.inspect'],
    ];
    for (const [task, expected] of cases) {
      const caps = selectCapabilitiesForTask(task);
      assert.ok(caps.includes(expected), `'${task}' -> [${caps}] (want ${expected})`);
    }
  });

  test('scopeToolsForTask keeps only task capabilities', () => {
    const r = scopeToolsForTask(MIXED, 'run the build script and execute tests');
    assert.equal(r.scoped, true);
    assert.deepEqual(r.tools.map(t => t.name), ['execute_command']);
  });

  test('no signal -> full catalog fallback (never blind the planner)', () => {
    const r = scopeToolsForTask(MIXED, 'flibbertigibbet xyzzy quux');
    assert.equal(r.scoped, false);
    assert.equal(r.tools, MIXED);
  });

  test('capabilityOfTool maps concrete tools', () => {
    assert.equal(capabilityOfTool('terminal', 'execute_command'), 'terminal.execute');
    assert.equal(capabilityOfTool('researcher', 'google_search'), 'research.search');
    assert.equal(capabilityOfTool('filesystem', 'read_file'), 'filesystem.read');
  });

  test('context-size benchmark: 240-tool catalog collapses to one capability', () => {
    const fams = [
      ['browser', 'browser_act_'], ['browser', 'browser_see_'], ['project', 'genome_'],
      ['researcher', 'enzyme_'], ['designer', 'pheno_'], ['terminal', 'shell_'],
    ];
    const big = [];
    for (let i = 0; i < 240; i++) {
      const [server, prefix] = fams[i % fams.length];
      big.push(T(`${prefix}tool_${i}`, server, `synthetic tool number ${i} for context benchmark`));
    }
    const full = promptContextSize(big);
    const r = scopeToolsForTask(big, 'run the build script in terminal');
    assert.equal(r.scoped, true);
    assert.ok(r.tools.length <= big.length * 0.25, `scoped ${r.tools.length}/240`);
    assert.ok(promptContextSize(r.tools) < full * 0.5, 'prompt chars collapse');
  });
});

describe('agentRun capabilityRouting', () => {
  const scriptProvider = (texts) => {
    let i = 0;
    return {
      metadata: () => ({ name: 's', kind: 'local', model: 's', capabilities: [] }),
      health: async () => ({ ok: true }),
      generate: async () => ({ text: texts[Math.min(i++, texts.length - 1)], modelUsed: 's', latencyMs: 1 }),
    };
  };
  const call = (tool, args = {}) => JSON.stringify({ action: 'call_tool', tool, args });
  const done = (result = 'ok') => JSON.stringify({ action: 'complete', result });
  const exec = (impl) => ({ executeTool: impl });

  test('off by default: full catalog visible', async () => {
    const seen = [];
    const run = await agentRun({
      task: 'read the config file', toolSchemas: MIXED,
      executor: exec(async (t, a) => { seen.push(t); return { r: 1 }; }),
      providers: { primary: scriptProvider([call('read_file'), done('fin')]) },
      limits: { maxIterations: 4, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.deepEqual(seen, ['read_file']);
    assert.equal(run.decision.action, 'complete');
  });

  test('on: out-of-scope tool rejected, in-scope executes', async () => {
    const seen = [];
    const run = await agentRun({
      task: 'read the config file', toolSchemas: MIXED, capabilityRouting: true,
      executor: exec(async (t) => { seen.push(t); return {}; }),
      providers: { primary: scriptProvider([call('browser_click'), call('read_file'), done()]) },
      limits: { maxIterations: 6, maxToolCalls: 3, maxExecutionMs: 5000 },
    });
    assert.deepEqual(seen, ['read_file']);
    assert.equal(run.toolCalls, 1);
  });
});

describe('dynamic capability resolver v2', () => {
  test('stemWord and stemMatches support morphological inflection', () => {
    assert.equal(stemWord('designing'), 'design');
    assert.equal(stemWord('rendering'), 'render');
    assert.equal(stemWord('components'), 'component');
    assert.equal(stemWord('tokens'), 'token');

    assert.ok(stemMatches('designing', 'design'));
    assert.ok(stemMatches('palettes', 'palette'));
    assert.ok(stemMatches('scraped', 'scrape'));
    assert.ok(stemMatches('modifying', 'modify'));
    assert.ok(!stemMatches('unrelated', 'palette'));
  });

  test('stemmed keyword hits map to expected capabilities', () => {
    const cases = [
      ['designing a bento showcase with kinetic animations', 'ui.design'],
      ['scraped the headlines from web pages', 'browser.observe'],
      ['syncing design system tokens to stitch canvas', 'ui.design'],
      ['executed bash commands to compile the typescript project', 'terminal.execute'],
      ['modifying the config file and archiving the directory', 'filesystem.write'],
    ];
    for (const [task, expected] of cases) {
      const caps = selectCapabilitiesForTask(task);
      assert.ok(caps.includes(expected), `'${task}' -> [${caps}] (want ${expected})`);
    }
  });

  test('stateful transition graph boosts logically subsequent capabilities', () => {
    // 1. After research.search, user says 'save it' -> boosts filesystem.write
    const res1 = selectCapabilitiesForTask('save it', { previousCapability: 'research.search' });
    assert.ok(res1.includes('filesystem.write'), `want filesystem.write in [${res1}]`);

    // 2. After filesystem.write, task says 'test page' -> terminal.execute or browser.observe
    const res2 = selectCapabilitiesForTask('test page', { previousTool: 'write_file' });
    assert.ok(res2.includes('terminal.execute') || res2.includes('browser.observe'), `want terminal.execute or browser.observe in [${res2}]`);

    // 3. After ui.design, task says 'inspect canvas' -> ui.design
    const res3 = selectCapabilitiesForTask('inspect canvas', { previousCapability: 'ui.design' });
    assert.ok(res3.includes('ui.design'), `want ui.design in [${res3}]`);
  });

  test('scopeCompactTools provides lean 1-line tool representation', () => {
    const tools = [
      T('generate_tokens', 'designer', 'Generate OKLCH color tokens for design system'),
      T('stitch_create', 'designer', 'Create a new screen in Stitch Canvas'),
    ];
    const compact = scopeCompactTools(tools);
    assert.ok(compact.includes('- generate_tokens: Generate OKLCH color tokens'));
    assert.ok(compact.includes('- stitch_create: Create a new screen in Stitch Canvas'));
  });

  test('episodic prior precedent steering elevates successful past capabilities', () => {
    const tmpDir = os.tmpdir();
    const testDb = path.join(tmpDir, `test-cap-precedents-${Date.now()}.db`);
    try {
      const db = new DatabaseSync(testDb);
      db.exec(`
        CREATE TABLE entities (
          name TEXT PRIMARY KEY,
          entity_type TEXT,
          observations TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `);
      const now = new Date().toISOString();
      const obs = JSON.stringify([
        `[${now}] steps: 2 | tools: [generate_tokens, stitch_sync_design_system] | note: successful theme creation`
      ]);
      db.prepare(`
        INSERT INTO entities (name, entity_type, observations, created_at, updated_at)
        VALUES ('workflow:brand-tokens', 'workflow', ?, ?, ?)
      `).run(obs, now, now);
      db.close();

      const precedents = recallCapabilityPrecedents('brand tokens setup', { memoryDbPath: testDb });
      assert.ok(precedents.includes('ui.design'), `precedents [${precedents}] should include ui.design`);

      const scoped = selectCapabilitiesForTask('brand tokens setup', {
        useEpisodicMemory: true,
        memoryDbPath: testDb,
      });
      assert.equal(scoped[0], 'ui.design');
    } finally {
      try { fs.unlinkSync(testDb); } catch {}
    }
  });
});
