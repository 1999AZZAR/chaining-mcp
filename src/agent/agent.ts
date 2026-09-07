import { AgentDecisionSchema, AgentPlanSchema, type AgentDecision, type AgentPlan, type ModelProvider, type ModelRequest } from './schemas.js';
import { NeedleProvider } from './needle-provider.js';
import { OpenRouterProvider } from './openrouter-provider.js';
import type { AgentStateManager, TerminationReason } from './state.js';
import { sharedAgentState } from './state.js';
import { EscalationController, escalationPolicyFromEnv, type EscalationPolicy, type EscalationRecord, type EscalationTrigger } from './escalation.js';

export interface AgentLoopLimits { maxIterations: number; maxToolCalls: number; maxExecutionMs: number }
export interface AgentToolExecutor { executeTool(tool: string, args: unknown, signal?: AbortSignal): Promise<unknown> }
export interface AgentRunInput {
  task: string;
  toolSchemas: Array<{ name: string; description?: string; schema?: unknown }>;
  executor: AgentToolExecutor;
  signal?: AbortSignal;
  limits?: Partial<AgentLoopLimits>;
  /** Test seam: override the default Needle-first / OpenRouter-escalation pair. */
  providers?: { primary?: ModelProvider; escalation?: ModelProvider };
  /** Opt-in agent state recording (Milestone 4). Absent = no recording. */
  state?: { manager: AgentStateManager; sessionId?: string; workflowId?: string };
  /** Escalation budget override (Milestone 6). Absent = env/defaults. */
  escalationPolicy?: EscalationPolicy;
  /** Task-relevant prompt guidance (built by buildGuidance). Appended to turn-1 context only. */
  guidance?: string;
}

const DEFAULT_LIMITS: AgentLoopLimits = { maxIterations: 8, maxToolCalls: 12, maxExecutionMs: 60000 };

function compact(value: unknown, max = 160): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** True when text carries the native Needle contract ({type, function_calls}). */
function looksNative(text: string): boolean {
  try {
    const p = JSON.parse(text);
    return !!p && typeof p.type === 'string' && Array.isArray((p as { function_calls?: unknown }).function_calls);
  } catch {
    return false;
  }
}

type NeedleApi = Pick<NeedleProvider, 'isConfident' | 'confidenceOf'> | null;

/**
 * Translate one raw model output into a strict AgentDecision. Shared by the
 * full loop and the single-step (sequentialthinking) path.
 */
export function translateNativeDecision(rawText: string, needleApi: NeedleApi): string {
  if (!looksNative(rawText)) return rawText;
  try {
    const native = JSON.parse(rawText);
    const calls = native.function_calls || [];
    if (native.type === 'respond') {
      return JSON.stringify({ action: 'complete', result: native.reasoning || calls, reasoning: native.reasoning });
    } else if (!calls.length) {
      return JSON.stringify({ action: 'escalate', reason: 'needle refused: no declared tool serves this request', context: native });
    } else if (needleApi && !needleApi.isConfident(rawText)) {
      return JSON.stringify({ action: 'escalate', reason: `needle confidence ${needleApi.confidenceOf(rawText)} below threshold`, context: native });
    }
    return JSON.stringify({ action: 'call_tool', tool: calls[0].name, args: calls[0].arguments || {}, reasoning: native.reasoning });
  } catch {
    return rawText;
  }
}

export function parseDecision(rawText: string): AgentDecision {
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return AgentDecisionSchema.parse(JSON.parse(cleaned));
}

function buildObservation(task: string, tools: AgentRunInput['toolSchemas'], history: unknown[], guidance?: string): string {
  const toolList = tools.map(t => `- ${t.name}${t.description ? ': ' + compact(t.description, 80) : ''}`).slice(0, 20).join('\n');
  const guide = guidance ? `\n\nGuidance:\n${guidance}` : '';
  const trail = (history.slice(-6) as Array<Record<string, unknown>>).map((h, i) => {
    if (h.tool) return `${i + 1}. ${String(h.tool)}(${compact(h.args ?? {}, 100)}) -> ${h.error ? 'ERROR ' + compact(h.error) : 'ok ' + compact(h.result)}`;
    if (h.rejectedUnknownTool) return `${i + 1}. rejected unknown tool ${String(h.rejectedUnknownTool)}`;
    if (h.revised) return `${i + 1}. revised: ${compact(h.revised, 100)}`;
    if (h.escalated) return `${i + 1}. escalated: ${compact(h.escalated, 100)}`;
    if (h.malformedOutput) return `${i + 1}. malformed output, retry`;
    return `${i + 1}. ${compact(h, 120)}`;
  }).join('\n');
  return `Task: ${compact(task, 300)}\n\nTools:\n${toolList}\n\nDone so far:\n${trail || '(nothing yet — pick the first tool call)'}${guide}`;
}

/**
 * Milestone 2: Needle-first agent loop with OpenRouter escalation.
 * Parses + validates every decision via AgentDecisionSchema; rejects unknown tools.
 */
export async function agentRun(input: AgentRunInput): Promise<{ decision: AgentDecision; toolCalls: number; iterations: number; escalated: boolean; sessionId?: string; escalations: EscalationRecord[] }> {
  const limits = { ...DEFAULT_LIMITS, ...input.limits };
  const t0 = Date.now();
  const needle = input.providers?.primary instanceof NeedleProvider
    ? input.providers.primary as NeedleProvider
    : (input.providers?.primary ? null : new NeedleProvider());
  const primary: ModelProvider = needle ?? input.providers!.primary!;
  const needleApi: Pick<NeedleProvider, 'isConfident' | 'confidenceOf' | 'resetConversation' | 'stopServer'> | null = needle;
  const escalation: ModelProvider = input.providers?.escalation ?? new OpenRouterProvider();
  const knownTools = new Set(input.toolSchemas.map(t => t.name));
  const history: unknown[] = [];
  let toolCalls = 0;
  let lastCallSig: string | undefined;
  let lastToolResult: unknown;

  const isPrimary = (p: ModelProvider): boolean => p === primary;
  const esc = new EscalationController(input.escalationPolicy ?? escalationPolicyFromEnv());
  let provider: ModelProvider = primary;
  const stated = input.state;
  const session = stated ? stated.manager.create(input.task, stated.sessionId, stated.workflowId) : undefined;
  const rec = (e: Parameters<AgentStateManager['record']>[1]): void => {
    if (stated && session) try { stated.manager.record(session.id, e); } catch { /* recording never breaks the loop */ }
  };
  const end = (reason: TerminationReason, detail?: string): void => {
    if (stated && session) try { stated.manager.terminate(session.id, reason, detail); } catch { /* best effort */ }
  };
  /** Single choke point for every provider switch: budgeted, recorded, one-way. */
  const doEscalate = (trigger: EscalationTrigger, detail?: string): void => {
    const record = esc.escalate(trigger, detail); // throws when budget spent
    provider = escalation;
    history.push({ escalated: trigger, detail, at: record.at });
    rec({ kind: 'escalation', reason: `${trigger}${detail ? ': ' + detail : ''}`, provider: 'escalation' });
  };
  const primaryHealth: { ok: boolean; detail?: string } = await primary.health().catch(() => ({ ok: false, detail: 'health check threw' }));
  if (!primaryHealth.ok) {
    try {
      doEscalate('unhealthy_primary', primaryHealth.detail);
    } catch (e) {
      end('provider_failure', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  try {

  if (isPrimary(provider)) await needleApi?.resetConversation().catch(() => undefined);
  for (let i = 1; i <= limits.maxIterations; i++) {
    if (Date.now() - t0 > limits.maxExecutionMs) { end('time_limit'); throw new Error('agent loop: execution time limit exceeded'); }
    if (input.signal?.aborted) { end('aborted'); throw new Error('agent loop: aborted'); }

    // Needle contract: turn 1 frames task+tools; later turns feed the raw
    // tool result back so the model continues the loop (result-forward).
    // Anything else (prose wrappers) degrades its confidence.
    const lastResult = [...history].reverse().find((h): h is { tool: unknown; result: unknown } =>
      typeof h === 'object' && h !== null && 'tool' in h && 'result' in h);
    const prompt = (isPrimary(provider) && lastResult)
      ? `Result of ${String((lastResult as { tool: unknown }).tool)}: ${compact((lastResult as { result: unknown }).result, 400)}\nTask reminder: ${compact(input.task, 200)}`
      : buildObservation(input.task, input.toolSchemas, history, history.length ? undefined : input.guidance);
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
      if (provider !== escalation) {
        try {
          doEscalate('provider_failure', msg);
        } catch (e) {
          end('provider_failure', e instanceof Error ? e.message : String(e));
          throw e;
        }
        continue;
      }
      end('provider_failure', msg);
      throw new Error(`agent loop: escalation provider failed after primary (${history.length} prior observations): ${msg}`);
    }
    // Native Needle contract → AgentDecision translation. Applies to the real
    // NeedleProvider and to any primary whose output carries the native shape
    // (type + function_calls); confidence gating only when a Needle API exists.
    let rawText = res.text;
    if (isPrimary(provider)) rawText = translateNativeDecision(rawText, needleApi);
    let decision: AgentDecision;
    try {
      decision = parseDecision(rawText);
    } catch {
      history.push({ malformedOutput: res.text.slice(0, 500) });
      rec({ kind: 'malformed_output', excerpt: res.text.slice(0, 200) });
      if (isPrimary(provider)) {
        try {
          doEscalate('malformed_output', res.text.slice(0, 200));
        } catch (e) {
          end('provider_failure', e instanceof Error ? e.message : String(e));
          throw e;
        }
        continue;
      }
      end('provider_failure', 'escalation returned malformed decision');
      throw new Error('agent loop: escalation provider returned malformed decision');
    }

    rec({ kind: 'decision', decision });
    if (decision.action === 'complete') { end(esc.escalated ? 'escalated' : 'completed'); return { decision, toolCalls, iterations: i, escalated: esc.escalated, sessionId: session?.id, escalations: esc.trail }; }
    if (decision.action === 'escalate') {
      const trigger: EscalationTrigger = /refus/i.test(decision.reason) ? 'refusal'
        : /confidence/i.test(decision.reason) ? 'low_confidence'
        : /malformed/i.test(decision.reason) ? 'malformed_output' : 'provider_failure';
      try {
        doEscalate(trigger, decision.reason);
      } catch (e) {
        end('escalated', e instanceof Error ? e.message : String(e));
        throw e;
      }
      history.push({ escalated: decision.reason, context: (decision as { context?: unknown }).context });
      continue;
    }
    if (decision.action === 'revise') { history.push({ revised: decision.note }); rec({ kind: 'revision', note: decision.note }); continue; }
    if (decision.action === 'call_tool') {
      if (!knownTools.has(decision.tool)) { history.push({ rejectedUnknownTool: decision.tool }); rec({ kind: 'rejected_tool', tool: decision.tool }); continue; }
      // Saturation guard: identical re-call means the model has nothing new;
      // finish with the last result instead of looping or escalating.
      const sig = `${decision.tool}:${JSON.stringify(decision.args)}`;
      if (sig === lastCallSig && lastToolResult !== undefined) {
        end(esc.escalated ? 'escalated' : 'completed', 'saturated');
        return { decision: { action: 'complete', result: lastToolResult, reasoning: 'repeated identical call — task saturated' }, toolCalls, iterations: i, escalated: esc.escalated, sessionId: session?.id, escalations: esc.trail };
      }
      lastCallSig = sig;
      if (++toolCalls > limits.maxToolCalls) { end('tool_call_limit'); throw new Error('agent loop: tool call limit exceeded'); }
      rec({ kind: 'tool_call', tool: decision.tool, args: decision.args });
      try {
        const result = await input.executor.executeTool(decision.tool, decision.args, input.signal);
        lastToolResult = result;
        esc.noteToolResult(true);
        history.push({ tool: decision.tool, result });
        rec({ kind: 'tool_result', tool: decision.tool, result });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        history.push({ tool: decision.tool, error: errMsg });
        rec({ kind: 'tool_result', tool: decision.tool, error: errMsg });
        // Repeated failures escalate only when a switch is still available;
        // an already-escalated run records and continues — nowhere else to go.
        if (esc.noteToolResult(false) && provider !== escalation) {
          try {
            doEscalate('repeated_tool_failure', `${decision.tool}: ${errMsg}`.slice(0, 200));
          } catch (budget) {
            end('provider_failure', budget instanceof Error ? budget.message : String(budget));
            throw budget;
          }
        }
      }
    }
  }
  end('iteration_limit');
  throw new Error('agent loop: iteration limit exceeded');
  } finally {
    needleApi?.stopServer();
  }
}

export interface AgentStepInput {
  /** Ongoing task this step belongs to. */
  task: string;
  /** New observation (the caller's thought) recorded before deciding. */
  observation?: string;
  /** Resume this session; created when absent. */
  sessionId?: string;
  workflowId?: string;
  tools: Array<{ name: string; description?: string; schema?: unknown }>;
  /** When true and the decision is call_tool, execute immediately via executor. */
  execute?: boolean;
  executor?: AgentToolExecutor;
  signal?: AbortSignal;
  providers?: { primary?: ModelProvider; escalation?: ModelProvider };
  state?: AgentStateManager;
  /** Optional revision/branch markers mapped into state events. */
  revision?: string;
  branch?: { branchId: string; fromEvent?: number };
  /** Task-relevant prompt guidance. Appended to first-step context only. */
  guidance?: string;
}

/**
 * One agent turn: observe → decide (→ optionally execute) with everything
 * recorded in AgentState. This is what the refined `sequentialthinking` tool
 * calls — Mitosis thinking IS an agent step, not caller-supplied prose.
 */
export async function agentStep(input: AgentStepInput): Promise<{
  sessionId: string;
  decision: AgentDecision;
  result?: unknown;
  error?: string;
  escalated: boolean;
  stats: ReturnType<AgentStateManager['stats']>;
  tail: string[];
}> {
  const manager = input.state ?? sharedAgentState();
  const existing = input.sessionId ? manager.snapshot(input.sessionId) : undefined;
  const session = existing ?? manager.create(input.task, input.sessionId, input.workflowId);
  const rec = (e: Parameters<AgentStateManager['record']>[1]): void => {
    try { manager.record(session.id, e); } catch { /* recording never breaks the step */ }
  };
  if (input.observation) rec({ kind: 'observation', text: input.observation });
  if (input.revision) rec({ kind: 'revision', note: input.revision });
  if (input.branch) rec({ kind: 'branch', branchId: input.branch.branchId, fromEvent: input.branch.fromEvent ?? 0 });

  const primary: ModelProvider = input.providers?.primary ?? new NeedleProvider();
  const escalation: ModelProvider = input.providers?.escalation ?? new OpenRouterProvider();
  const needleApi: NeedleApi = primary instanceof NeedleProvider ? primary : null;
  const knownTools = new Set(input.tools.map(t => t.name));
  const tail = manager.tail(session.id, 6);
  const guide = input.guidance && tail.length <= 1 ? `\n\nGuidance:\n${input.guidance}` : '';
  const prompt = tail.length
    ? `Task: ${compact(input.task, 300)}\n\nTools:\n${input.tools.slice(0, 20).map(t => `- ${t.name}`).join('\n')}\n\nSo far:\n${tail.join('\n')}${guide}`
    : `Task: ${compact(input.task, 300)}${guide}`;

  let provider: ModelProvider = primary;
  let escalated = false;
  let rawText: string;
  try {
    const res = await provider.generate({
      prompt, signal: input.signal, timeoutMs: 15000,
      tools: input.tools.map(t => ({ name: t.name, description: t.description, schema: t.schema })),
    });
    rawText = translateNativeDecision(res.text, needleApi);
  } catch (e) {
    // Single budgeted escalation hop, then surface the outcome.
    provider = escalation;
    escalated = true;
    rec({ kind: 'escalation', reason: 'primary provider failed', provider: 'escalation' });
    const res = await provider.generate({ prompt, signal: input.signal, timeoutMs: 15000 });
    rawText = res.text;
  } finally {
    (primary as Partial<NeedleProvider>).stopServer?.();
  }

  let decision: AgentDecision;
  try {
    decision = parseDecision(rawText);
  } catch {
    rec({ kind: 'malformed_output', excerpt: rawText.slice(0, 200) });
    throw new Error('agent step: model returned malformed decision');
  }
  rec({ kind: 'decision', decision });

  let result: unknown;
  let error: string | undefined;
  if (decision.action === 'call_tool') {
    if (!knownTools.has(decision.tool)) {
      error = `tool '${decision.tool}' is not in the agent tool registry`;
      rec({ kind: 'rejected_tool', tool: decision.tool });
    } else if (input.execute && input.executor) {
      rec({ kind: 'tool_call', tool: decision.tool, args: decision.args });
      try {
        result = await input.executor.executeTool(decision.tool, decision.args, input.signal);
        rec({ kind: 'tool_result', tool: decision.tool, result });
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        rec({ kind: 'tool_result', tool: decision.tool, error });
      }
    } else {
      rec({ kind: 'tool_call', tool: decision.tool, args: decision.args });
    }
  } else if (decision.action === 'escalate') {
    escalated = true;
    rec({ kind: 'escalation', reason: decision.reason });
  } else if (decision.action === 'revise') {
    rec({ kind: 'revision', note: decision.note });
  } else if (decision.action === 'complete') {
    try { manager.terminate(session.id, escalated ? 'escalated' : 'completed'); } catch { /* best effort */ }
  }
  return { sessionId: session.id, decision, result, error, escalated, stats: manager.stats(session.id), tail: manager.tail(session.id, 6) };
}

export interface PlanToolDecl { name: string; description?: string; schema?: unknown }

/** Single-shot planner: one bare-task turn with real tools declared; the
 *  model emits the whole chain as function_calls. No confidence gate —
 *  planning has no side effects and multi-call chains calibrate low. */
async function planIterative(
  needle: NeedleProvider | ModelProvider,
  task: string,
  toolDecls: PlanToolDecl[],
  signal?: AbortSignal,
  maxSteps = 6,
  guidance?: string,
): Promise<AgentPlan> {
  const tools = toolDecls.map(t => ({ name: t.name, description: t.description || t.name, schema: t.schema || { type: 'object' } }));
  const known = new Set(tools.map(t => t.name));
  const api = needle as Partial<NeedleProvider>;
  let lastError: Error | undefined;
  try {
    // Small model + single-shot chains occasionally emit truncated JSON or an
    // empty refusal; one transparent retry smooths the stochastic tail before
    // falling back to OpenRouter.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const prompt = guidance ? `${task.slice(0, 500)}\n\nGuidance:\n${guidance}` : task.slice(0, 500);
        const res = await needle.generate({ prompt, signal, tools });
        const native = JSON.parse(res.text);
        const calls = (native.function_calls || []).filter((c: { name: string }) => known.has(c.name)).slice(0, maxSteps);
        if (!calls.length) {
          lastError = new Error('needle produced no plan steps');
          continue;
        }
        const rawSteps = calls.map((c: { name: string; arguments: unknown }, i: number) => ({
          step: i + 1,
          task: describeArgs(c.name, c.arguments),
          tool: c.name,
          args: c.arguments,
        }));
        const chained = parallelize(rawSteps, task);
        return AgentPlanSchema.parse({
          task,
          steps: chained.map(({ step, task: t, tool, dependsOn }) => ({ step, task: t, tool, dependsOn })),
        });
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (signal?.aborted) throw e;
      }
    }
    throw lastError ?? new Error('needle produced no plan steps');
  } finally {
    api.stopServer?.();
  }
}

function describeArgs(tool: string, args: unknown): string {
  const entries = args && typeof args === 'object'
    ? Object.entries(args as Record<string, unknown>).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')
    : '';
  return entries ? `${tool}(${entries})` : tool;
}

/**
 * Evidence-based parallelization (deterministic, not heuristic cognition):
 * step K depends on step K-1 only if one of its argument values references
 * something NOT present in the task text (i.e. it must come from a prior
 * step's output — placeholders, generated ids, looked-up values). Fully
 * task-grounded literals are independent and may run in the same batch.
 */
export function parallelize(
  steps: Array<{ step: number; task: string; tool: string; args?: unknown }>,
  taskText: string,
): Array<{ step: number; task: string; tool: string; dependsOn: number[] }> {
  const haystack = taskText.toLowerCase();
  return steps.map((s, i) => {
    if (i === 0) return { step: s.step, task: s.task, tool: s.tool, dependsOn: [] as number[] };
    const values: string[] = [];
    const collect = (v: unknown): void => {
      if (typeof v === 'string') values.push(v);
      else if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    collect((s as { args?: unknown }).args);
    const needsPrior = values.some(v => v.length > 0 && !haystack.includes(v.toLowerCase()));
    return { step: s.step, task: s.task, tool: s.tool, dependsOn: needsPrior ? [s.step - 1] : [] };
  });
}

/**
 * Milestone 3: Needle-first task decomposition.
 * Declares the REAL tools and builds the plan iteratively: each turn asks
 * Needle for the next step given the planned steps so far, stopping on
 * respond/refusal/repeat/low confidence (max 6 steps). A `define_step`
 * pseudo-tool does NOT work — the model semantically matches the task
 * against declared tools and refuses meta-tools with an empty call.
 * Falls back to OpenRouter. M7: no heuristic fallback — when both
 * providers fail the call throws an honest error instead of a fake
 * analysis → utility → validation plan.
 */
export async function planTask(
  task: string,
  availableToolsSummary: string,
  signal?: AbortSignal,
  providers?: { primary?: NeedleProvider; escalation?: ModelProvider },
  toolDecls?: PlanToolDecl[],
  guidance?: string,
): Promise<AgentPlan> {
  const needle = providers?.primary ?? new NeedleProvider();
  try {
    if (toolDecls && toolDecls.length) {
      return await planIterative(needle, task, toolDecls, signal, 6, guidance);
    }
    // No structured decls: skip straight to escalation (the define_step
    // pseudo-tool is refused by the model — removed in M7).
  } catch { /* fall through to escalation */ }
  finally { (needle as Partial<NeedleProvider>).stopServer?.(); }

  const escalation = providers?.escalation ?? new OpenRouterProvider();
  const res = await escalation.generate({
    prompt: `Decompose into 3-6 ordered steps as JSON array [{"step":1,"task":"...","recommendedCategory":"..."}]. Task: ${task}. Tools: ${availableToolsSummary.slice(0, 1500)}`,
    systemPrompt: 'You are a task decomposition engine. Output valid JSON only, no fences.',
    signal,
  });
  const cleaned = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
  if (!cleaned) throw new Error('escalation provider returned an empty plan');
  try {
    const steps = JSON.parse(cleaned);
    return AgentPlanSchema.parse({ task, steps: steps.map((s: Record<string, unknown>) => ({ dependsOn: [], ...s })) });
  } catch (e) {
    throw new Error(`escalation provider returned unparseable plan: ${e instanceof Error ? e.message : String(e)}`);
  }
}
