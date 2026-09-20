import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { bundledEnginePath } from './diagnostics.js';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ModelProvider, ModelRequest, ModelResponse, ProviderMetadata } from './schemas.js';

export interface NeedleConfig {
  enabled: boolean;
  enginePath: string;
  modelPath: string;
  confidenceThreshold: number;
  timeoutMs: number;
  toolIndexPath?: string;
  servePort: number;
  useServer: boolean;
  /** '3' (default) or '2'. v3 engine requires --model; v2 has baked weights. */
  generation: '2' | '3';
  /** Ladder depth 2..20 for v3 (NEEDLE_DEPTH); undefined = full model. */
  depth?: number;
}

/** Env forced on every engine spawn: v3 binaries phone home by default. */
export const NEEDLE_NO_TELEMETRY_ENV = { NEEDLE_TELEMETRY: '0', DO_NOT_TRACK: '1' } as const;

export function needleDefaultsForGeneration(gen: '2' | '3'): { enginePath: string; modelPath: string } {
  return gen === '3'
    ? { enginePath: 'assets/needle/needle3', modelPath: 'assets/needle/needle3.cact' }
    : { enginePath: bundledEnginePath(), modelPath: 'assets/needle/needle2.cact' };
}

export function needleConfigFromEnv(): NeedleConfig {
  const generation = process.env.NEEDLE_GENERATION === '2' ? '2' : '3';
  const defaults = needleDefaultsForGeneration(generation);
  const depthRaw = process.env.NEEDLE_DEPTH;
  const depth = depthRaw !== undefined ? Number(depthRaw) : undefined;
  return {
    enabled: (process.env.MITOSIS_AGENT_ENABLED || 'true').toLowerCase() !== 'false',
    enginePath: process.env.NEEDLE_ENGINE_PATH || defaults.enginePath,
    modelPath: process.env.NEEDLE_MODEL_PATH || defaults.modelPath,
    confidenceThreshold: parseFloat(process.env.NEEDLE_CONFIDENCE_THRESHOLD || '0.6'),
    timeoutMs: parseInt(process.env.NEEDLE_TIMEOUT_MS || '15000', 10),
    // Persisted tool-embedding cache: the engine keys it by a fingerprint over
    // the schemas + model, so one path safely serves many toolsets and restarts.
    toolIndexPath: process.env.NEEDLE_TOOL_INDEX_PATH || 'assets/needle/tools.idx',
    servePort: parseInt(process.env.NEEDLE_PORT || '18080', 10),
    useServer: (process.env.NEEDLE_USE_SERVER || 'true').toLowerCase() !== 'false',
    generation,
    depth: depth !== undefined && Number.isFinite(depth) && depth >= 2 ? Math.floor(depth) : undefined,
  };
}

/**
 * P0-B5: stable ToolDescriptor fingerprint. Cache key covers the full
 * callable surface — server identity + version + protocol + tool name +
 * schema + description — so a description edit or schema drift can never
 * silently reuse a stale tool index.
 */
export function fingerprintTools(
  tools: Array<{ name: string; description?: string; parameters?: unknown; schema?: unknown }>,
  opts: { serverId?: string; serverVersion?: string; protocolVersion?: string } = {},
): string {
  const canonical = [...tools]
    .map(t => ({
      name: t.name,
      description: t.description || '',
      schema: (t.parameters ?? t.schema ?? {}) as unknown,
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const payload = JSON.stringify({
    server: opts.serverId || 'local',
    serverVersion: opts.serverVersion || '',
    protocol: opts.protocolVersion || '',
    tools: canonical,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/**
 * P0-B5: per-family confidence thresholds. The old global 0.6 under-gates
 * privileged families (shell, device control) and over-gates pure
 * observation. Effective threshold for a decision = strictest (max) of the
 * involved families. Override any family via HELA_NEEDLE_THRESHOLD_<FAMILY>
 * (0..1), e.g. HELA_NEEDLE_THRESHOLD_SHELL=0.8.
 */
export const NEEDLE_FAMILY_THRESHOLDS: Record<string, number> = {
  shell: 0.75, terminal: 0.75,
  browser_act: 0.7, android_control: 0.75, blender: 0.7,
  filesystem_write: 0.65, destructive: 0.8,
  research: 0.5, filesystem_read: 0.5, observe: 0.5, project_query: 0.5,
  design: 0.55, default: 0.6,
};

export function needleFamilyOf(toolName: string): string {
  const n = toolName.toLowerCase();
  if (/shell|execute_command|terminal|pty|session_(spawn|write)|agent_spawn/.test(n)) return 'shell';
  if (/shell_exec|reboot|push|install|uninstall/.test(n)) return 'android_control';
  if (/browser_.*(click|type|press|drag|upload|navigate)|screenshot|record/.test(n)) return 'browser_act';
  if (/blender|execute_blender|render_output/.test(n)) return 'blender';
  if (/delete|destroy|prune|close|kill|uninstall/.test(n)) return 'destructive';
  if (/write|create|update|move|copy|archive|import/.test(n)) return 'filesystem_write';
  if (/search|query|read|list|get|observe|extract|fetch|summary/.test(n)) return 'research';
  if (/design|palette|template|tokens|component/.test(n)) return 'design';
  return 'default';
}

export function resolveFamilyThreshold(family: string, globalDefault = 0.6): number {
  const envKey = `HELA_NEEDLE_THRESHOLD_${family.toUpperCase()}`;
  const raw = process.env[envKey];
  if (raw !== undefined) {
    const v = Number(raw);
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  }
  return NEEDLE_FAMILY_THRESHOLDS[family] ?? globalDefault;
}

/** Strictest threshold across all tools involved in one routing decision. */
export function resolveThresholdForTools(toolNames: string[], globalDefault = 0.6): number {
  if (toolNames.length === 0) return globalDefault;
  return Math.max(...toolNames.map(t => resolveFamilyThreshold(needleFamilyOf(t), globalDefault)));
}

function fail(code: string, msg: string, retryable = false): never {
  const e = new Error(msg) as Error & { code: string; retryable: boolean };
  e.code = code; e.retryable = retryable;
  throw e;
}

/**
 * Needle provider: spawns the bundled CLI one-shot
 * (`needle --model weights.cact --tools tools.json --prompt "..."`), parses
 * the JSON `{type:function_calls,confidence,reasoning}` contract.
 * Gen 3 (default, NEEDLE_GENERATION=3): external .cact via --model, --depth
 * ladder, telemetry force-disabled. Gen 2 (NEEDLE_GENERATION=2): baked
 * weights, no --model flag.
 */
export class NeedleProvider implements ModelProvider {
  private server?: ChildProcess;
  private serverToolsHash?: string;
  private activePort?: number;
  private toolsFile?: string;
  constructor(private config: NeedleConfig = needleConfigFromEnv()) {}

  metadata(): ProviderMetadata {
    return { name: 'needle', kind: 'local', model: this.config.modelPath || `needle-${this.config.generation} (baked)`, capabilities: ['tool-call', 'extract', 'confidence-gated'] };
  }

  /** v3-only flags: --model (required, weights not baked) + --depth ladder. */
  private modelArgs(): string[] {
    if (this.config.generation !== '3') return [];
    const args = ['--model', this.config.modelPath];
    if (this.config.depth !== undefined) args.push('--depth', String(this.config.depth));
    return args;
  }

  /** Every engine spawn inherits a telemetry-free environment. */
  private spawnEnv(): NodeJS.ProcessEnv {
    return { ...process.env, ...NEEDLE_NO_TELEMETRY_ENV };
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.config.enabled) return { ok: false, detail: 'MITOSIS_AGENT_ENABLED == false' };
    if (!existsSync(this.config.enginePath)) return { ok: false, detail: `engine missing: ${this.config.enginePath} (run npm run needle:fetch)` };
    // Tuned-model note: gen-3 engines take --model explicitly (weights are
    // not baked in); gen-2 bakes the base model in. NEEDLE_MODEL_PATH /
    // NEEDLE_ENGINE_PATH overrides always win over generation defaults.
    const modelNote = this.config.generation === '3' || existsSync(this.config.modelPath)
      ? `model file ${existsSync(this.config.modelPath) ? 'present' : 'MISSING'} (${this.config.modelPath})`
      : `model file absent (${this.config.modelPath}); using baked base model`;
    return new Promise((resolve) => {
      execFile(this.config.enginePath, ['--help'], { timeout: 5000, env: this.spawnEnv() }, (err, stdout) => {
        resolve(err
          ? { ok: false, detail: String(err.message).slice(0, 160) }
          : { ok: true, detail: `${String(stdout).slice(0, 100)} | ${modelNote}` });
      });
    });
  }

  async generate(req: ModelRequest): Promise<ModelResponse> {
    const t0 = Date.now();
    if (!existsSync(this.config.enginePath)) fail('MODEL_UNAVAILABLE', `needle engine not found at ${this.config.enginePath}; run npm run needle:fetch`);
    const tools = (req.tools || []).map(t => ({ name: t.name, description: t.description || t.name, parameters: t.schema || { type: 'object' } }));
    if (this.config.useServer) {
      await this.ensureServer(tools);
      const parsed = await this.postJson('/complete', { input: req.systemPrompt ? `${req.systemPrompt}\n\n${req.prompt}` : req.prompt });
      return { text: JSON.stringify(parsed), modelUsed: `needle${this.config.generation}:server:${this.activePort}`, latencyMs: Date.now() - t0 };
    }
    return this.generateOneShot(tools, req, t0);
  }

  private async generateOneShot(tools: unknown[], req: ModelRequest, t0: number): Promise<ModelResponse> {
    const toolsFile = join(tmpdir(), `needle-tools-${Date.now()}-${Math.floor(Math.random() * 1e6)}.json`);
    writeFileSync(toolsFile, JSON.stringify(tools));
    const args = [...this.modelArgs(), '--tools', toolsFile, '--prompt', req.prompt];
    if (this.config.toolIndexPath) args.push('--tool-index', this.config.toolIndexPath);
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(this.config.enginePath, args, { timeout: req.timeoutMs || this.config.timeoutMs, maxBuffer: 4 * 1024 * 1024, env: this.spawnEnv() }, (err, out, stderr) => {
          if (err) reject(Object.assign(new Error(`needle exec failed: ${String(stderr || err.message).slice(0, 300)}`), { code: 'code' in err ? err.code : undefined }));
          else resolve(String(out));
        });
      });
      const parsed = JSON.parse(stdout.trim().split('\n').filter(Boolean).pop() as string);
      return { text: JSON.stringify(parsed), modelUsed: `needle${this.config.generation}@${this.config.enginePath}`, latencyMs: Date.now() - t0 };
    } catch (e) {
      if (e instanceof SyntaxError) fail('MALFORMED_OUTPUT', 'needle returned non-JSON output', true);
      const msg = e instanceof Error ? e.message : String(e);
      fail(msg.includes('timed out') || msg.includes('TIMEOUT') ? 'TIMEOUT' : 'UNKNOWN', msg, true);
      throw new Error('unreachable');
    } finally {
      try { unlinkSync(toolsFile); } catch { /* best effort */ }
    }
  }

  confidenceOf(rawText: string): number | null {
    try { const p = JSON.parse(rawText); return typeof p.confidence === 'number' ? p.confidence : null; }
    catch { return null; }
  }

  isConfident(rawText: string): boolean {
    const c = this.confidenceOf(rawText);
    return c === null ? true : c >= this.config.confidenceThreshold;
  }

  /**
   * P0-B5: family-aware gate. Pass the candidate tool names from the parsed
   * decision when known; falls back to the global threshold for empty sets.
   */
  isConfidentFor(rawText: string, toolNames: string[] = []): boolean {
    const c = this.confidenceOf(rawText);
    if (c === null) return true;
    return c >= resolveThresholdForTools(toolNames, this.config.confidenceThreshold);
  }

  /** Persistent `--serve` mode: one engine process per toolset, HTTP loopback. */
  private async ensureServer(tools: unknown[]): Promise<void> {
    // P0-B5: fingerprint over name+schema+description (not length:name) so
    // stale indexes from edited descriptions can never be reused.
    const hash = fingerprintTools(tools as Array<{ name: string; description?: string; parameters?: unknown }>);
    if (this.server && !this.server.killed && this.serverToolsHash === hash && this.activePort) {
      try { await this.postJson('/reset', {}); return; } catch { /* stale — respawn below */ }
    }
    this.stopServer();
    await new Promise(r => setTimeout(r, 150)); // let the old port release
    this.activePort = await pickFreePort(this.config.servePort);
    this.toolsFile = join(tmpdir(), `needle-tools-${Date.now()}-${process.pid}-${Math.floor(Math.random() * 1e6)}.json`);
    writeFileSync(this.toolsFile, JSON.stringify(tools));
    const args = [...this.modelArgs(), '--tools', this.toolsFile, '--serve', '--port', String(this.activePort)];
    if (this.config.toolIndexPath) args.push('--tool-index', this.config.toolIndexPath);
    this.server = spawn(this.config.enginePath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: this.spawnEnv() });
    this.serverToolsHash = hash;
    for (let i = 0; i < 40; i++) {
      if (this.server.killed || this.server.exitCode !== null) throw new Error('needle server exited during startup');
      try { await this.postJson('/reset', {}); return; } catch { await new Promise(r => setTimeout(r, 250)); }
    }
    this.stopServer();
    throw new Error('needle server not responding on port ' + this.activePort);
  }

  private postJson(path: string, body: unknown, retried = false): Promise<unknown> {
    const data = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = httpRequest({
        host: '127.0.0.1', port: this.activePort ?? this.config.servePort, path, method: 'POST',
        agent: false,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Connection': 'close' },
        timeout: this.config.timeoutMs,
      }, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c; });
        res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
      });
      req.on('error', (e) => {
        // Engine closes idle keep-alive sockets; retry once on a fresh connection.
        if (!retried && /socket hang up|ECONNRESET/.test(e.message)) this.postJson(path, body, true).then(resolve, reject);
        else reject(e);
      });
      req.on('timeout', () => { req.destroy(new Error('needle server request timeout')); });
      req.write(data);
      req.end();
    });
  }

  /** Rewind the server conversation; call once per agent run (server owns one global session). */
  async resetConversation(): Promise<void> {
    if (this.server && !this.server.killed) await this.postJson('/reset', {});
  }

  stopServer(): void {
    const proc = this.server;
    try { proc?.kill(); } catch { /* best effort */ }
    // SIGKILL fallback so a wedged engine can never linger and hold its port.
    if (proc && !proc.killed) {
      const t = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* best effort */ } }, 2000);
      t.unref?.();
    }
    this.server = undefined;
    this.serverToolsHash = undefined;
    this.activePort = undefined;
    if (this.toolsFile) { try { unlinkSync(this.toolsFile); } catch { /* best effort */ } this.toolsFile = undefined; }
  }
}

/** Prefer the configured port (back-compat), else any free loopback port. */
function pickFreePort(preferred: number): Promise<number> {
  return new Promise<number>((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(0)); // 0 = let the engine pick is unsupported; fall through to scan
    srv.listen(preferred, '127.0.0.1', () => {
      srv.close(() => resolve(preferred));
    });
  }).then(async (port) => {
    if (port !== 0) return port;
    return new Promise<number>((resolve, reject) => {
      const srv = createServer();
      srv.once('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address();
        const p = typeof addr === 'object' && addr ? addr.port : 0;
        srv.close(() => resolve(p));
      });
    });
  });
}
