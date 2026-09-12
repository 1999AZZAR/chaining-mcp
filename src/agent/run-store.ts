import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'path';

export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
/**
 * 'unknown' = step was 'running' when the process died / handle expired:
 * outcome is genuinely unknown (side effect may or may not have happened).
 * Never auto-treat as 'failed' — resume requires an explicit decision.
 */
export type StepStatus = 'running' | 'completed' | 'failed' | 'skipped' | 'unknown';

export interface StoredRun {
  id: string;
  task: string;
  workflow_id: string | null;
  status: RunStatus;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredStep {
  run_id: string;
  step_id: string;
  server: string | null;
  tool: string | null;
  args: string | null;
  status: StepStatus;
  attempts: number;
  result_summary: string | null;
  /** Full result JSON (capped) so resume can restore downstream outputs. */
  result: string | null;
}

export interface StoredEvent {
  seq: number;
  kind: string;
  body: string;
  at: string;
}

/**
 * Durable run store (P0-B1): SQLite + WAL. Survives process restarts so a
 * workflow re-invoked with the same workflow id can skip already-completed
 * steps (safe resume, P0-B2). Synchronous API on top of node:sqlite.
 */
export class RunStore {
  private db: DatabaseSync;

  constructor(path?: string) {
    const file = path || process.env['HELA_RUNSTORE_PATH'] || resolve(process.cwd(), 'hela-runs.db');
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        task TEXT NOT NULL DEFAULT '',
        workflow_id TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        idempotency_key TEXT UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS steps (
        run_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        server TEXT,
        tool TEXT,
        args TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        attempts INTEGER NOT NULL DEFAULT 0,
        result_summary TEXT,
        result TEXT,
        PRIMARY KEY (run_id, step_id)
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        kind TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        at TEXT NOT NULL,
        UNIQUE (run_id, seq)
      );
      CREATE INDEX IF NOT EXISTS idx_steps_run ON steps (run_id);
      CREATE INDEX IF NOT EXISTS idx_events_run ON events (run_id);
    `);
  }

  /** Idempotent create: same idempotency_key returns the existing run. */
  createRun(task: string, opts: { runId?: string; workflowId?: string; idempotencyKey?: string } = {}): StoredRun {
    const now = new Date().toISOString();
    if (opts.idempotencyKey) {
      const existing = this.db.prepare('SELECT * FROM runs WHERE idempotency_key = ?').get(opts.idempotencyKey) as unknown as StoredRun | undefined;
      if (existing) return existing;
    }
    const id = opts.runId || `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const dupe = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as unknown as StoredRun | undefined;
    if (dupe) return dupe;
    this.db.prepare(
      'INSERT INTO runs (id, task, workflow_id, status, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, task, opts.workflowId ?? null, 'running', opts.idempotencyKey ?? null, now, now);
    return this.getRun(id)!.run;
  }

  recordEvent(runId: string, kind: string, body: unknown): number {
    const next = (this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM events WHERE run_id = ?').get(runId) as { m: number }).m + 1;
    this.db.prepare('INSERT INTO events (run_id, seq, kind, body, at) VALUES (?, ?, ?, ?, ?)').run(
      runId, next, kind, JSON.stringify(body ?? null).slice(0, 4000), new Date().toISOString(),
    );
    return next;
  }

  startStep(runId: string, stepId: string, server: string, tool: string, args: unknown): void {
    const argsJson = JSON.stringify(args ?? null).slice(0, 4000);
    const existing = this.db.prepare('SELECT attempts FROM steps WHERE run_id = ? AND step_id = ?').get(runId, stepId) as { attempts: number } | undefined;
    if (existing) {
      this.db.prepare('UPDATE steps SET server = ?, tool = ?, args = ?, status = ?, attempts = ? WHERE run_id = ? AND step_id = ?')
        .run(server, tool, argsJson, 'running', existing.attempts + 1, runId, stepId);
    } else {
      this.db.prepare('INSERT INTO steps (run_id, step_id, server, tool, args, status, attempts) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(runId, stepId, server, tool, argsJson, 'running', 1);
    }
  }

  finishStep(runId: string, stepId: string, status: StepStatus, summary?: string): void {
    this.db.prepare('UPDATE steps SET status = ?, result_summary = ? WHERE run_id = ? AND step_id = ?')
      .run(status, (summary || '').slice(0, 2000), runId, stepId);
  }

  /** Persist the full step result (capped) for resume restores. */
  saveStepResult(runId: string, stepId: string, result: unknown): void {
    this.db.prepare('UPDATE steps SET result = ? WHERE run_id = ? AND step_id = ?')
      .run(JSON.stringify(result ?? null).slice(0, 8000), runId, stepId);
  }

  finishRun(runId: string, status: RunStatus): void {
    this.db.prepare('UPDATE runs SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), runId);
  }

  completedStepIds(runId: string): Set<string> {
    const rows = this.db.prepare("SELECT step_id FROM steps WHERE run_id = ? AND status = 'completed'").all(runId) as Array<{ step_id: string }>;
    return new Set(rows.map(r => r.step_id));
  }

  /** Steps whose outcome is unknown (orphaned 'running' or expired handles). */
  unknownStepIds(runId: string): Set<string> {
    const rows = this.db.prepare("SELECT step_id FROM steps WHERE run_id = ? AND status = 'unknown'").all(runId) as Array<{ step_id: string }>;
    return new Set(rows.map(r => r.step_id));
  }

  /**
   * Reconcile after a restart: any step still 'running' belonged to a dead
   * process — its side effect may or may not have happened. Flip to
   * 'unknown' so resume never blindly replays it. Returns the count flipped.
   */
  markOrphanedRunningAsUnknown(runId: string): number {
    const rows = this.db.prepare("SELECT step_id FROM steps WHERE run_id = ? AND status = 'running'").all(runId) as Array<{ step_id: string }>;
    if (rows.length === 0) return 0;
    this.db.prepare("UPDATE steps SET status = 'unknown' WHERE run_id = ? AND status = 'running'").run(runId);
    return rows.length;
  }

  getStep(runId: string, stepId: string): StoredStep | undefined {
    return this.db.prepare('SELECT * FROM steps WHERE run_id = ? AND step_id = ?').get(runId, stepId) as unknown as StoredStep | undefined;
  }

  getRun(runId: string): { run: StoredRun; steps: StoredStep[]; events: StoredEvent[] } | undefined {
    const run = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as unknown as StoredRun | undefined;
    if (!run) return undefined;
    const steps = this.db.prepare('SELECT * FROM steps WHERE run_id = ?').all(runId) as unknown as StoredStep[];
    const events = this.db.prepare('SELECT seq, kind, body, at FROM events WHERE run_id = ? ORDER BY seq').all(runId) as unknown as StoredEvent[];
    return { run, steps, events };
  }

  close(): void {
    this.db.close();
  }
}
