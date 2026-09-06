import { AgentDecisionSchema, AgentPlanSchema, type AgentDecision, type AgentPlan, type ModelProvider, type ModelRequest } from './schemas.js';
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

function compact(value: unknown, max = 160): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function buildObservation(task: string, tools: AgentRunInput['toolSchemas'], history: unknown[]): string {
  const toolList = tools.map(t => `- ${t.name}${t.description ? ': ' + compact(t.description, 80) : ''}`).slice(0, 20).join('\n');
  const trail = (history.slice(-6) as Array<Record<string, unknown>>).map((h, i) => {
    if (h.tool) return `${i + 1}. ${String(h.tool)}(${compact(h.args ?? {}, 100)}) -> ${h.error ? 'ERROR ' + compact(h.error) : 'ok ' + compact(h.result)}`;
    if (h.rejectedUnknownTool) return `${i + 1}. rejected unknown tool ${String(h.rejectedUnknownTool)}`;
    if (h.revised) return `${i + 1}. revised: ${compact(h.revised, 100)}`;
    if (h.escalated) return `${i + 1}. escalated: ${compact(h.escalated, 100)}`;
    if (h.malformedOutput) return `${i + 1}. malformed output, retry`;
    return `${i + 1}. ${compact(h, 120)}`;
  }).join('\n');
  return `Task: ${compact(task, 300)}\n\nTools:\n${toolList}\n\nDone so far:\n${trail || '(nothing yet — pick the first tool call)'}`;
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
  let lastCallSig: string | undefined;
  let lastToolResult: unknown;

  let provider: ModelProvider = needle;
  try { await needle.health(); } catch { /* stub always unhealthy -> escalate path */ }
  const needleHealth: { ok: boolean; detail?: string } = await needle.health().catch(() => ({ ok: false, detail: 'health check threw' }));
  if (!needleHealth.ok) {
    provider = escalation;
    escalated = true;
    history.push({ note: 'needle unavailable, escalated to openrouter', detail: needleHealth.detail });
  }

  try {

  if (provider === needle) await needle.resetConversation().catch(() => undefined);
  for (let i = 1; i <= limits.maxIterations; i++) {
    if (Date.now() - t0 > limits.maxExecutionMs) throw new Error('agent loop: execution time limit exceeded');
    if (input.signal?.aborted) throw new Error('agent loop: aborted');

    // Needle contract: turn 1 frames task+tools; later turns feed the raw
    // tool result back so the model continues the loop (result-forward).
    // Anything else (prose wrappers) degrades its confidence.
    const lastResult = [...history].reverse().find((h): h is { tool: unknown; result: unknown } =>
      typeof h === 'object' && h !== null && 'tool' in h && 'result' in h);
    const prompt = (provider === needle && lastResult)
      ? `Result of ${String((lastResult as { tool: unknown }).tool)}: ${compact((lastResult as { result: unknown }).result, 400)}\nTask reminder: ${compact(input.task, 200)}`
      : buildObservation(input.task, input.toolSchemas, history);
    const req: ModelRequest = {
      prompt,
      systemPrompt: 'You are Mitosis agent runtime. Output exactly one JSON AgentDecision, no prose: {"action":"call_tool","tool":"...","args":{}} or {"action":"complete","result":...} or {"action":"escalate","reason":"..."} or {"action":"revise","note":"..."}.',
      signal: input.signal,
      timeoutMs: 8000,
      tools: input.toolSchemas.map(t => ({ name: t.name, description: t.description, schema: t.schema })),
    };
    let res;
    try {
      res = await provider.generate(req);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (provider !== escalation) { provider = escalation; escalated = true; history.push({ note: 'primary provider failed, escalated', error: msg }); continue; }
      throw new Error(`agent loop: escalation provider failed after Needle (${history.length} prior observations): ${msg}`);
    }
    // Needle native contract → AgentDecision translation.
    let rawText = res.text;
    if (provider === needle) {
      try {
        const native = JSON.parse(rawText);
        const calls = native.function_calls || [];
        if (native.type === 'respond') {
          rawText = JSON.stringify({ action: 'complete', result: native.reasoning || calls, reasoning: native.reasoning });
        } else if (!calls.length) {
          rawText = JSON.stringify({ action: 'escalate', reason: 'needle refused: no declared tool serves this request', context: native });
        } else if (!needle.isConfident(res.text)) {
          rawText = JSON.stringify({ action: 'escalate', reason: `needle confidence ${needle.confidenceOf(res.text)} below threshold`, context: native });
        } else {
          rawText = JSON.stringify({ action: 'call_tool', tool: calls[0].name, args: calls[0].arguments || {}, reasoning: native.reasoning });
        }
      } catch { /* fall through to malformed path */ }
    }
    let decision: AgentDecision;
    try {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
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
      // Saturation guard: identical re-call means the model has nothing new;
      // finish with the last result instead of looping or escalating.
      const sig = `${decision.tool}:${JSON.stringify(decision.args)}`;
      if (sig === lastCallSig && lastToolResult !== undefined) {
        return { decision: { action: 'complete', result: lastToolResult, reasoning: 'repeated identical call — task saturated' }, toolCalls, iterations: i, escalated };
      }
      lastCallSig = sig;
      if (++toolCalls > limits.maxToolCalls) throw new Error('agent loop: tool call limit exceeded');
      try {
        const result = await input.executor.executeTool(decision.tool, decision.args, input.signal);
        lastToolResult = result;
        history.push({ tool: decision.tool, result });
      } catch (e) {
        history.push({ tool: decision.tool, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  throw new Error('agent loop: iteration limit exceeded');
  } finally {
    needle.stopServer();
  }
}

/**
 * Milestone 3: Needle-first task decomposition.
 * Declares ONLY a `define_step` pseudo-tool so the grammar admits exactly
 * plan steps; validates into AgentPlan. Falls back to OpenRouter, then to
 * the legacy heuristic (kept until benchmarks justify removal).
 */
export async function planTask(task: string, availableToolsSummary: string, signal?: AbortSignal): Promise<AgentPlan> {
  const needle = new NeedleProvider();
  try {
    const res = await needle.generate({
      prompt: `Break this task into ordered steps. Emit one define_step call per step.\n\nTask: ${task}\n\nAvailable capabilities:\n${availableToolsSummary.slice(0, 1500)}`,
      signal,
      tools: [{
        name: 'define_step',
        description: 'Define one ordered plan step: which real tool to use and what it should do',
        schema: {
          type: 'object',
          properties: {
            step: { type: 'integer', description: '1-based order' },
            task: { type: 'string', description: 'what this step does' },
            tool: { type: 'string', description: 'real tool to use' },
            dependsOn: { type: 'array', items: { type: 'integer' } },
          },
          required: ['step', 'task'],
        },
      }],
    });
    const native = JSON.parse(res.text);
    const calls = native.function_calls || [];
    if (calls.length) {
      const plan = AgentPlanSchema.parse({
        task,
        steps: calls.map((c: { arguments: Record<string, unknown> }) => ({ dependsOn: [], ...c.arguments })),
      });
      if (plan.steps.length) return plan;
    }
  } catch { /* fall through to escalation */ }
  finally { needle.stopServer(); }

  const escalation = new OpenRouterProvider();
  try {
    const res = await escalation.generate({
      prompt: `Decompose into 3-6 ordered steps as JSON array [{"step":1,"task":"...","recommendedCategory":"..."}]. Task: ${task}. Tools: ${availableToolsSummary.slice(0, 1500)}`,
      systemPrompt: 'You are a task decomposition engine. Output valid JSON only, no fences.',
      signal,
    });
    const cleaned = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const steps = JSON.parse(cleaned);
    return AgentPlanSchema.parse({ task, steps: steps.map((s: Record<string, unknown>) => ({ dependsOn: [], ...s })) });
  } catch { /* legacy heuristic last resort */ }

  return {
    task,
    steps: [
      { step: 1, task: `Analyze requirements for ${task}`, recommendedCategory: 'analysis', dependsOn: [] },
      { step: 2, task: `Execute main operation for ${task}`, recommendedCategory: 'utility', dependsOn: [1] },
      { step: 3, task: 'Verify and summarize results', recommendedCategory: 'validation', dependsOn: [2] },
    ],
  };
}
