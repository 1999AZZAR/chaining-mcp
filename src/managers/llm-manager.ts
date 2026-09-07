/**
 * LLM Manager for Chaining MCP Server
 *
 * Integrates optional internal LLM capabilities (via OpenRouter or OpenAI-compatible API)
 * for task decomposition, intelligent routing, and content summarization.
 * Opt-in only via CHAINING_LLM_ENABLED=true.
 */

export interface LLMConfig {
  enabled: boolean;
  apiKey?: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt?: string;
  appUrl: string;
  appName: string;
}

export interface LLMUsageStats {
  callsTotal: number;
  promptTokensTotal: number;
  completionTokensTotal: number;
  lastError?: string;
  lastCallTimestamp?: string;
}

export class LLMManager {
  private config: LLMConfig;
  private stats: LLMUsageStats = {
    callsTotal: 0,
    promptTokensTotal: 0,
    completionTokensTotal: 0,
  };
  private cache = new Map<string, { response: string; timestamp: number }>();
  private cacheTtlMs = 300000; // 5 minutes

  constructor() {
    this.config = {
      enabled: (process.env.CHAINING_LLM_ENABLED || '').toLowerCase() === 'true',
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
      model: process.env.CHAINING_LLM_MODEL || 'openrouter/free',
      baseUrl: process.env.CHAINING_LLM_BASE_URL || 'https://openrouter.ai/api/v1',
      maxTokens: parseInt(process.env.CHAINING_LLM_MAX_TOKENS || '1024', 10),
      timeoutMs: Math.min(parseInt(process.env.CHAINING_LLM_TIMEOUT_MS || '4000', 10), 5000),
      systemPrompt: process.env.CHAINING_LLM_SYSTEM_PROMPT,
      appUrl: process.env.CHAINING_LLM_APP_URL || 'https://github.com/1999AZZAR/hela-mcp-ecosystem',
      appName: process.env.CHAINING_LLM_APP_NAME || 'hela-mitosis',
    };
  }

  public isEnabled(): boolean {
    return this.config.enabled && Boolean(this.config.apiKey);
  }

  public getStatus(): {
    enabled: boolean;
    hasKey: boolean;
    model: string;
    callsTotal: number;
    lastError?: string;
    lastCallTimestamp?: string;
  } {
    return {
      enabled: this.config.enabled,
      hasKey: Boolean(this.config.apiKey),
      model: this.config.model,
      callsTotal: this.stats.callsTotal,
      lastError: this.stats.lastError,
      lastCallTimestamp: this.stats.lastCallTimestamp,
    };
  }

  public getUsage(): LLMUsageStats {
    return { ...this.stats };
  }

  /**
   * Execute an LLM query with caching, timeout, and automatic model fallback
   */
  async query(prompt: string, systemPromptOverride?: string): Promise<{ ok: boolean; text?: string; error?: string; cached?: boolean; modelUsed?: string }> {
    if (!this.isEnabled()) {
      return { ok: false, error: 'LLM integration is disabled or OPENROUTER_API_KEY is not set' };
    }

    const cacheKey = `${prompt}::${systemPromptOverride || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
      return { ok: true, text: cached.response, cached: true };
    }

    const candidateModels = [this.config.model];
    if (this.config.model !== 'openrouter/auto') {
      candidateModels.push('openrouter/auto');
    }

    let lastErrorMessage = '';
    const startTime = Date.now();

    for (const modelToTry of candidateModels) {
      // If we've already spent > 4.5s overall, don't attempt another model
      if (Date.now() - startTime > 4500) {
        break;
      }

      const controller = new AbortController();
      const perAttemptTimeout = Math.min(this.config.timeoutMs, 3500);
      const timeout = setTimeout(() => controller.abort(), perAttemptTimeout);

      try {
        this.stats.callsTotal++;
        this.stats.lastCallTimestamp = new Date().toISOString();

        const messages: Array<{ role: string; content: string }> = [];
        const systemMessage = systemPromptOverride || this.config.systemPrompt || 'You are an expert autonomous MCP tool chain assistant. Be concise, precise, and structured.';
        messages.push({ role: 'system', content: systemMessage });
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'HTTP-Referer': this.config.appUrl,
            'X-Title': this.config.appName,
          },
          body: JSON.stringify({
            model: modelToTry,
            messages,
            max_tokens: this.config.maxTokens,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => '');
          throw new Error(`LLM API with model ${modelToTry} returned HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
        }

        const data: any = await response.json();
        const text = data.choices?.[0]?.message?.content || '';

        if (data.usage) {
          this.stats.promptTokensTotal += data.usage.prompt_tokens || 0;
          this.stats.completionTokensTotal += data.usage.completion_tokens || 0;
        }

        this.cache.set(cacheKey, { response: text, timestamp: Date.now() });
        return { ok: true, text, modelUsed: modelToTry };
      } catch (err) {
        clearTimeout(timeout);
        lastErrorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    this.stats.lastError = lastErrorMessage;
    return { ok: false, error: lastErrorMessage };
  }

  /**
   * Decompose a complex task into structured subtasks
   */
  async decomposeTask(task: string, availableToolsSummary: string): Promise<{ ok: boolean; subtasks?: Array<{ step: number; task: string; recommendedCategory: string }>; error?: string }> {
    const prompt = `Decompose the following task into 3-6 ordered, discrete sub-steps. Map each step to a tool category (e.g. filesystem, search, analysis, execution, verification).

Task: "${task}"

Available Tools Summary:
${availableToolsSummary}

Respond strictly in JSON array format:
[
  { "step": 1, "task": "description", "recommendedCategory": "category" }
]`;

    const result = await this.query(prompt, 'You are a task decomposition engine. Output valid JSON only, without markdown fences.');
    if (!result.ok || !result.text) {
      // M7: honest failure instead of a fake analysis → utility → validation plan.
      return { ok: false, error: result.error || 'LLM decomposition unavailable' };
    }

    try {
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const subtasks = JSON.parse(cleanJson);
      return { ok: true, subtasks };
    } catch {
      return { ok: false, error: 'LLM returned unparseable decomposition; no heuristic fallback (removed in M7)' };
    }
  }

  /**
   * Summarize tool outputs or logs into concise text
   */
  async summarize(content: string, maxSummaryWords: number = 100): Promise<string> {
    if (!this.isEnabled()) {
      return content.length > 300 ? content.slice(0, 300) + '... (truncated)' : content;
    }

    const prompt = `Summarize the following output in under ${maxSummaryWords} words. Capture key facts, errors, and outcomes:\n\n${content.slice(0, 4000)}`;
    const result = await this.query(prompt, 'You are a concise technical summarizer. Provide high-density, accurate summaries.');
    return result.ok && result.text ? result.text : content.slice(0, 300);
  }
}
