import { execFile } from 'node:child_process';
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
}
