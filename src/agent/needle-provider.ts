import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
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
}

export function needleConfigFromEnv(): NeedleConfig {
  const exe = process.platform === 'win32' ? 'needle.exe' : 'needle';
  return {
    enabled: (process.env.MITOSIS_AGENT_ENABLED || '').toLowerCase() === 'true',
    enginePath: process.env.NEEDLE_ENGINE_PATH || `assets/needle/${exe}`,
    modelPath: process.env.NEEDLE_MODEL_PATH || 'assets/needle/needle2.cact',
    confidenceThreshold: parseFloat(process.env.NEEDLE_CONFIDENCE_THRESHOLD || '0.6'),
    timeoutMs: parseInt(process.env.NEEDLE_TIMEOUT_MS || '15000', 10),
    toolIndexPath: process.env.NEEDLE_TOOL_INDEX_PATH,
    servePort: parseInt(process.env.NEEDLE_PORT || '18080', 10),
    useServer: (process.env.NEEDLE_USE_SERVER || 'true').toLowerCase() !== 'false',
  };
}

function fail(code: string, msg: string, retryable = false): never {
  const e = new Error(msg) as Error & { code: string; retryable: boolean };
  e.code = code; e.retryable = retryable;
  throw e;
}

/**
 * Needle 2 provider: spawns the bundled CLI one-shot
 * (`needle --tools tools.json --prompt "..."`), parses the JSON
 * `{type,function_calls,confidence,reasoning}` contract.
 * Weights are baked into the engine; NEEDLE_MODEL_PATH selects a tuned
 * `.cact` when present (passed via --weights if the CLI supports it).
 */
export class NeedleProvider implements ModelProvider {
  private server?: ChildProcess;
  private serverToolsHash?: string;
  private toolsFile?: string;
  constructor(private config: NeedleConfig = needleConfigFromEnv()) {}

  metadata(): ProviderMetadata {
    return { name: 'needle', kind: 'local', model: this.config.modelPath || 'needle-2 (baked)', capabilities: ['tool-call', 'extract', 'confidence-gated'] };
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.config.enabled) return { ok: false, detail: 'MITOSIS_AGENT_ENABLED != true' };
    if (!existsSync(this.config.enginePath)) return { ok: false, detail: `engine missing: ${this.config.enginePath} (run npm run needle:fetch)` };
    return new Promise((resolve) => {
      execFile(this.config.enginePath, ['--help'], { timeout: 5000 }, (err, stdout) => {
        resolve(err ? { ok: false, detail: String(err.message).slice(0, 160) } : { ok: true, detail: String(stdout).slice(0, 120) });
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
      return { text: JSON.stringify(parsed), modelUsed: `needle2:server:${this.config.servePort}`, latencyMs: Date.now() - t0 };
    }
    return this.generateOneShot(tools, req, t0);
  }

  private async generateOneShot(tools: unknown[], req: ModelRequest, t0: number): Promise<ModelResponse> {
    const toolsFile = join(tmpdir(), `needle-tools-${Date.now()}-${Math.floor(Math.random() * 1e6)}.json`);
    writeFileSync(toolsFile, JSON.stringify(tools));
    const args = ['--tools', toolsFile, '--prompt', req.prompt];
    if (this.config.toolIndexPath) args.push('--tool-index', this.config.toolIndexPath);
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(this.config.enginePath, args, { timeout: req.timeoutMs || this.config.timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, out, stderr) => {
          if (err) reject(Object.assign(new Error(`needle exec failed: ${String(stderr || err.message).slice(0, 300)}`), { code: 'code' in err ? err.code : undefined }));
          else resolve(String(out));
        });
      });
      const parsed = JSON.parse(stdout.trim().split('\n').filter(Boolean).pop() as string);
      return { text: JSON.stringify(parsed), modelUsed: `needle2@${this.config.enginePath}`, latencyMs: Date.now() - t0 };
    } catch (e) {
      if (e instanceof SyntaxError) fail('MALFORMED_OUTPUT', 'needle returned non-JSON output', true);
      const msg = e instanceof Error ? e.message : String(e);
      fail(msg.includes('timed out') || msg.includes('TIMEOUT') ? 'TIMEOUT' : 'UNKNOWN', msg, true);
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

  /** Persistent `--serve` mode: one engine process per toolset, HTTP loopback. */
  private async ensureServer(tools: unknown[]): Promise<void> {
    const hash = JSON.stringify(tools).length + ':' + (tools as Array<{ name: string }>).map(t => t.name).join(',');
    if (this.server && !this.server.killed && this.serverToolsHash === hash) return;
    this.stopServer();
    this.toolsFile = join(tmpdir(), `needle-tools-${Date.now()}.json`);
    writeFileSync(this.toolsFile, JSON.stringify(tools));
    const args = ['--tools', this.toolsFile, '--serve', '--port', String(this.config.servePort)];
    if (this.config.toolIndexPath) args.push('--tool-index', this.config.toolIndexPath);
    this.server = spawn(this.config.enginePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.serverToolsHash = hash;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('needle server start timeout')), 10000);
      const onData = () => { clearTimeout(timer); resolve(); };
      this.server!.stdout?.once('data', onData);
      this.server!.stderr?.once('data', onData);
      this.server!.once('error', (e) => { clearTimeout(timer); reject(e); });
      this.server!.once('exit', (code) => { clearTimeout(timer); reject(new Error(`needle server exited ${code}`)); });
    }).catch(async () => {
      // Fall back to readiness probe: server may not log on stdout.
      for (let i = 0; i < 20; i++) {
        try { await this.postJson('/reset', {}); return; } catch { await new Promise(r => setTimeout(r, 250)); }
      }
      throw new Error('needle server not responding on port ' + this.config.servePort);
    });
  }

  private postJson(path: string, body: unknown, retried = false): Promise<unknown> {
    const data = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = httpRequest({
        host: '127.0.0.1', port: this.config.servePort, path, method: 'POST',
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
    try { this.server?.kill(); } catch { /* best effort */ }
    this.server = undefined;
    this.serverToolsHash = undefined;
    if (this.toolsFile) { try { unlinkSync(this.toolsFile); } catch { /* best effort */ } this.toolsFile = undefined; }
  }
}
