import type { ModelProvider, ModelRequest, ModelResponse, ProviderMetadata } from './schemas.js';

export interface NeedleConfig {
  enabled: boolean;
  modelPath: string;
  maxTokens: number;
  timeoutMs: number;
  contextLength?: number;
}

export function needleConfigFromEnv(): NeedleConfig {
  return {
    enabled: (process.env.MITOSIS_AGENT_ENABLED || '').toLowerCase() === 'true',
    modelPath: process.env.NEEDLE_MODEL_PATH || '',
    maxTokens: parseInt(process.env.NEEDLE_MAX_TOKENS || '1024', 10),
    timeoutMs: parseInt(process.env.NEEDLE_TIMEOUT_MS || '8000', 10),
    contextLength: parseInt(process.env.NEEDLE_CONTEXT_LENGTH || '4096', 10),
  };
}

/**
 * Milestone 1 stub: local Needle 2 provider seam.
 * Real runtime binding lands here; until then health() reports unavailable
 * and generate() throws typed error so callers escalate cleanly.
 */
export class NeedleProvider implements ModelProvider {
  constructor(private config: NeedleConfig = needleConfigFromEnv()) {}

  metadata(): ProviderMetadata {
    return { name: 'needle', kind: 'local', model: this.config.modelPath || 'needle-2 (unconfigured)', capabilities: ['plan', 'select', 'revise'] };
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.config.enabled) return { ok: false, detail: 'MITOSIS_AGENT_ENABLED != true' };
    if (!this.config.modelPath) return { ok: false, detail: 'NEEDLE_MODEL_PATH not set' };
    return { ok: false, detail: 'Needle runtime not yet bound (Milestone 1 stub)' };
  }

  async generate(_req: ModelRequest): Promise<ModelResponse> {
    const err = new Error('Needle runtime not yet bound') as Error & { code: string; retryable: boolean };
    err.code = 'MODEL_UNAVAILABLE';
    err.retryable = false;
    throw err;
  }
}
