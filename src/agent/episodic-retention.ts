/**
 * HeLa Episodic Memory & Retention (P1-C5).
 *
 * Fuses HeLa Genome (memory.db) and HeLa Runs (hela-runs.db) into
 * Needle's planning and routing loop.
 *
 * When an agent plans or executes a task, this module:
 * 1. Recalls relevant past successful tool decisions and entity context
 *    to steer Needle 3 with empirical few-shot history.
 * 2. Records successful workflow chains and routing decisions back to memory.db
 *    so Needle continuously accumulates ecosystem experience over time.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

export interface EpisodicMemoryConfig {
  memoryDbPath?: string;
  runsDbPath?: string;
  maxRecallChars?: number;
}

export function defaultMemoryDbPath(): string | undefined {
  const envPath = process.env['HELA_MEMORY_DB_PATH'] || process.env['MEMORY_FILE_PATH'];
  if (envPath && existsSync(envPath)) return envPath;

  // Prefer non-empty memory.db from cwd or parent
  const localPath = resolve(process.cwd(), 'memory.db');
  const parentPath = resolve(process.cwd(), '..', 'memory.db');
  if (existsSync(parentPath)) return parentPath;
  if (existsSync(localPath)) return localPath;

  const centralPath = join(homedir(), 'memory', 'memory.db');
  if (existsSync(centralPath)) return centralPath;

  return undefined;
}

export function defaultRunsDbPath(): string | undefined {
  const envPath = process.env['HELA_RUNSTORE_PATH'];
  if (envPath && existsSync(envPath)) return envPath;

  const localPath = resolve(process.cwd(), 'hela-runs.db');
  if (existsSync(localPath)) return localPath;

  const parentPath = resolve(process.cwd(), '..', 'hela-runs.db');
  if (existsSync(parentPath)) return parentPath;

  return undefined;
}

/**
 * Recall task-relevant prior observations, completed tasks, or successful tool steps.
 * Returns concise text (max chars) suitable for injection into Needle 3 turn-1 guidance.
 */
export function recallEpisodicMemory(task: string, config: EpisodicMemoryConfig = {}): string {
  const dbPath = config.memoryDbPath || defaultMemoryDbPath();
  if (!dbPath) return '';

  const maxChars = config.maxRecallChars || parseInt(process.env['HELA_RECALL_MAX_CHARS'] || '400', 10);
  const keywords = (task || '')
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(w => w.length > 3)
    .slice(0, 6);

  if (keywords.length === 0) return '';

  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const hits: string[] = [];

    // Query entities matching keywords
    const stmt = db.prepare(`
      SELECT name, entity_type, observations FROM entities
      WHERE name LIKE ? OR observations LIKE ?
      ORDER BY updated_at DESC LIMIT 3
    `);

    for (const kw of keywords) {
      const pattern = `%${kw}%`;
      const rows = stmt.all(pattern, pattern) as Array<{ name: string; entity_type: string; observations: string }>;
      for (const row of rows) {
        let obsList: string[] = [];
        try {
          obsList = JSON.parse(row.observations || '[]');
        } catch {
          obsList = [String(row.observations)];
        }
        const lastObs = obsList[obsList.length - 1] || '';
        const summary = `${row.name} (${row.entity_type}): ${lastObs.replace(/\s+/g, ' ').slice(0, 100)}`;
        if (!hits.includes(summary)) {
          hits.push(summary);
        }
        if (hits.length >= 2) break;
      }
      if (hits.length >= 2) break;
    }

    db.close();

    if (hits.length === 0) return '';
    let out = hits.map(h => `- prior_reference: ${h} (prefer simpler direct tools if available)`).join('\n');
    if (out.length > maxChars) out = out.slice(0, maxChars) + '…';
    return out;
  } catch {
    return '';
  }
}

/**
 * Persist an executed successful tool decision or task workflow into memory.db
 * so future runs retain knowledge of what worked.
 */
export interface RetainWorkflowOptions {
  summary?: string;
  escalated?: boolean;
  errorCount?: number;
}

/**
 * Persist an executed successful tool decision or task workflow into memory.db.
 *
 * Anti-Stagnation & Quality Gates:
 * 1. Filter Out Dirty Runs: Discards runs with excessive tool errors or failures (> 2).
 * 2. Pareto Efficiency / Upgrade-Only: If an existing workflow for this task pattern exists,
 *    only upgrade/overwrite if the new workflow uses <= steps or resolves a previously escalated run.
 *    Longer, less-efficient workflows are never allowed to overwrite lean ones.
 */
export function retainWorkflowDecision(
  task: string,
  toolChain: string[],
  options: RetainWorkflowOptions | string = {}
): boolean {
  const opts: RetainWorkflowOptions = typeof options === 'string' ? { summary: options } : options;
  const dbPath = defaultMemoryDbPath();
  if (!dbPath) return false;

  // Gate 1: Do not retain runs with multiple tool errors/retries (dirty trails)
  if ((opts.errorCount ?? 0) > 2) {
    return false;
  }

  // Gate 2: Do not retain empty chains
  if (!toolChain || toolChain.length === 0) {
    return false;
  }

  try {
    const db = new DatabaseSync(dbPath);
    const now = new Date().toISOString();
    const cleanTask = task.trim().slice(0, 60).replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase();
    const entityName = `workflow:${cleanTask}`;
    const newSteps = toolChain.length;
    const isEscalated = !!opts.escalated;
    const summary = opts.summary || 'auto-retained workflow';
    const observation = `[${now}] steps: ${newSteps} | escalated: ${isEscalated} | tools: [${toolChain.join(', ')}] | note: ${summary}`;

    const existing = db.prepare('SELECT rowid, observations FROM entities WHERE name = ?').get(entityName) as { rowid: number; observations: string } | undefined;
    if (existing) {
      let obsList: string[] = [];
      try {
        obsList = JSON.parse(existing.observations || '[]');
      } catch {
        obsList = [];
      }

      // Gate 3: Pareto Efficiency check against the best recorded workflow
      // Parse steps and escalation from previous observations
      let bestSteps = Infinity;
      let bestWasEscalated = true;
      for (const obs of obsList) {
        const match = obs.match(/steps:\s*(\d+)/);
        if (match) {
          const s = parseInt(match[1], 10);
          if (s < bestSteps) bestSteps = s;
        }
        if (obs.includes('escalated: false')) {
          bestWasEscalated = false;
        }
      }

      // If existing was clean and had fewer steps, reject the suboptimal candidate
      if (bestSteps < newSteps && !bestWasEscalated && isEscalated) {
        db.close();
        return false;
      }

      obsList.push(observation);
      db.prepare('UPDATE entities SET observations = ?, updated_at = ? WHERE rowid = ?').run(
        JSON.stringify(obsList.slice(-10)),
        now,
        existing.rowid
      );
    } else {
      db.prepare(`
        INSERT INTO entities (name, entity_type, observations, created_at, updated_at)
        VALUES (?, 'workflow', ?, ?, ?)
      `).run(entityName, JSON.stringify([observation]), now, now);
    }

    db.close();
    return true;
  } catch {
    return false;
  }
}
