import { AgentDecisionSchema, type AgentDecision, type ModelProvider, type ModelRequest } from './schemas.js';
import { NeedleProvider } from './needle-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';

export interface AgentLoopLimits { maxIterations: number; maxToolCalls: number; maxExecutionMs: number }
export interface AgentToolExecutor { executeTool(tool: string, args: unknown, signal?: AbortSignal): Promise<unknown> }
export interface AgentRunInput {
  task: string;
  toolSchemas: Array<{ name: string; description?: string; schema?: unknown }>;
  executor: AgentToolExecutor;
  signal?: AbortSignal;
  limits?: Partial<AgentLoopLimits>;
}

const DEFAULT_LIMITS: AgentLoopLimits = { maxIterations: 8, maxToolCalls: 12, maxExecutionMs: 60000 };

function buildObservation(task: string, tools: AgentRunInput['toolSchemas'], history: unknown[]): string {
  const toolList = tools.map(t => `- ${t.name}${t.description ? ': ' + t.description : ''}`).slice(0, 60).join('\n');
  return `Task: ${task}\n\nAvailable tools:\n${toolList}\n\nHistory (most recent last):\n${JSON.stringify(history.slice(-10))}\n\nRespond with exactly one JSON AgentDecision: {"action":"call_tool","tool":"...","args":{}} | {"action":"complete","result":...} | {"action":"escalate","reason":"..."} | {"action":"revise","note":"..."}.`;
}

/**
 * Milestone 2: Needle-first agent loop with OpenRouter escalation.
 * Parses + validates every decision via AgentDecisionSchema; rejects unknown tools.
 */
export async function agentRun(input: AgentRunInput): Promise<{ decision: AgentDecision; toolCalls: number; iterations: number; escalated: boolean }> {
  const limits = { ...DEFAULT_LIMITS, ...input.limits };
  const t0 = Date.now();
  const needle = new NeedleProvider();
  const escalation = new OpenRouterProvider();
  const knownTools = new Set(input.toolSchemas.map(t => t.name));
  const history: unknown[] = [];
  let toolCalls = 0;
  let escalated = false;

  let provider: ModelProvider = needle;
  try { await needle.health(); } catch { /* stub always unhealthy -> escalate path */ }
  const needleHealth = await needle.health().catch(() => ({ ok: false as const }));
  if (!needleHealth.ok) {
    provider = escalation;
    escalated = true;
    history.push({ note: 'needle unavailable, escalated to openrouter', detail: needleHealth.detail });
  }

  for (let i = 1; i <= limits.maxIterations; i++) {
    if (Date.now() - t0 > limits.maxExecutionMs) throw new Error('agent loop: execution time limit exceeded');
    if (input.signal?.aborted) throw new Error('agent loop: aborted');

    const req: ModelRequest = {
      prompt: buildObservation(input.task, input.toolSchemas, history),
      systemPrompt: 'You are Mitosis agent runtime. Output exactly one JSON AgentDecision, no prose.',
      signal: input.signal,
      timeoutMs: 8000,
    };
    const res = await provider.generate(req);
    let decision: AgentDecision;
    try {
      const cleaned = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
      decision = AgentDecisionSchema.parse(JSON.parse(cleaned));
    } catch {
      history.push({ malformedOutput: res.text.slice(0, 500) });
      if (provider === needle) { provider = escalation; escalated = true; history.push({ note: 'malformed needle output, escalated' }); continue; }
      throw new Error('agent loop: escalation provider returned malformed decision');
    }

    if (decision.action === 'complete') return { decision, toolCalls, iterations: i, escalated };
    if (decision.action === 'escalate') {
      provider = escalation; escalated = true;
      history.push({ escalated: decision.reason, context: (decision as { context?: unknown }).context });
      continue;
    }
    if (decision.action === 'revise') { history.push({ revised: decision.note }); continue; }
    if (decision.action === 'call_tool') {
      if (!knownTools.has(decision.tool)) { history.push({ rejectedUnknownTool: decision.tool }); continue; }
      if (++toolCalls > limits.maxToolCalls) throw new Error('agent loop: tool call limit exceeded');
      try {
        const result = await input.executor.executeTool(decision.tool, decision.args, input.signal);
        history.push({ tool: decision.tool, result });
      } catch (e) {
        history.push({ tool: decision.tool, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  throw new Error('agent loop: iteration limit exceeded');
}
