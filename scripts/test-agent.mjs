#!/usr/bin/env node
/** Compile src/agent (+llm-manager dep) to tests/agent/.dist, then run node --test. */
import { execFileSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests', 'agent', '.dist');
rmSync(out, { recursive: true, force: true });
execFileSync('node', ['node_modules/typescript/bin/tsc',
  'src/agent/agent.ts', 'src/agent/state.ts', 'src/agent/workflow.ts', 'src/agent/diagnostics.ts', 'src/agent/guidance.ts', 'src/skills/skill-discovery.ts', 'src/handlers/request-handlers.ts', 'src/managers/llm-manager.ts', '--module', 'nodenext', '--moduleResolution', 'nodenext',
  '--target', 'es2022', '--skipLibCheck', '--outDir', out, '--rootDir', 'src',
], { cwd: root, stdio: 'inherit' });
if (!existsSync(join(out, 'agent', 'agent.js'))) throw new Error('compile produced no output');
execFileSync('node', ['--test', 'tests/agent/loop.test.mjs', 'tests/agent/decomposition.test.mjs', 'tests/agent/state.test.mjs', 'tests/agent/step.test.mjs', 'tests/agent/workflow.test.mjs', 'tests/agent/escalation.test.mjs', 'tests/agent/diagnostics.test.mjs', 'tests/agent/guidance.test.mjs', 'tests/agent/skills.test.mjs', 'tests/agent/surface.test.mjs', 'tests/agent/coverage.test.mjs', 'tests/agent/compare.test.mjs', 'tests/agent/live.test.mjs', 'tests/agent/envelope.test.mjs', 'tests/agent/artifact.test.mjs', 'tests/agent/capability.test.mjs', 'tests/agent/http-adapter.test.mjs'],
  { cwd: root, stdio: 'inherit', env: { ...process.env } });
