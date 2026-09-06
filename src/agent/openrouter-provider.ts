import type { ModelProvider, ModelRequest, ModelResponse, ProviderMetadata } from './schemas.js';
import { LLMManager } from '../managers/llm-manager.js';

/** Milestone 1: move existing OpenRouter/LLMManager behind ModelProvider seam. No behavior change. */
export class OpenRouterProvider implements ModelProvider {
  private llm = new LLMManager();
  metadata(): ProviderMetadata {
    const s = this.llm.getStatus();
    return { name: 'openrouter', kind: 'remote', model: s.model, capabilities: ['escalation', 'decompose', 'summarize'] };
  }
  async health() {
    const s = this.llm.getStatus();
    return s.enabled && s.hasKey ? { ok: true } : { ok: false, detail: s.lastError || 'disabled or no key' };
  }
  async generate(req: ModelRequest): Promise<ModelResponse> {
    const t0 = Date.now();
    const r = await this.llm.query(req.prompt, req.systemPrompt);
    if (!r.ok) {
      const e = new Error(r.error || 'OpenRouter query failed') as Error & { code: string; retryable: boolean };
      e.code = 'UNKNOWN'; e.retryable = true;
      throw e;
    }
    return { text: r.text || '', modelUsed: r.modelUsed || 'openrouter', latencyMs: Date.now() - t0 };
  }
}
