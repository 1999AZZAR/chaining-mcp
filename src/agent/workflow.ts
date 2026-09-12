/**
 * Milestone 5: agentic workflow loop — the Mitosis runtime structure:
 *
 *   User
 *    ↓
 *   Mitosis
 *    ├─ Needle 2 (bundled engine, auto-enabled when present)
 *    │    ↓ structured decision
 *    ├─ state / observation (AgentState: observations, decisions,
 *    │    tool calls, results, revisions, branches)
 *    │    ↓
 *    ├─ workflow executor (WorkflowOrchestrator: registry-guarded,
 *    │    transported, retried, cancellable)
 *    │    ↓
 *    └─ MCP capabilities
 *         ↓ result
 *      Needle 2 → next decision (…until complete / escalate / limits)
 *
 * The agent never touches the transport directly — every tool call passes
 * through orchestrator.executeTool (registry + transport).
 */
import { WorkflowOrchestrator } from '../managers/workflow-orchestrator.js';
import type { WorkflowOrchestratorInput } from '../types.js';
import { agentRun, planTask, type AgentToolExecutor } from './agent.js';
import type { AgentPlan } from './schemas.js';
import { AgentStateManager } from './state.js';
import { RunStore } from './run-store.js';
import type { ModelProvider } from './schemas.js';
import type { NeedleProvider } from './needle-provider.js';

/** Map a validated AgentPlan (1-based step numbers) onto workflow step ids. */
export function planToWorkflow(
  plan: AgentPlan,
  opts: { workflowId?: string; name?: string; serverName?: string } = {},
): WorkflowOrchestratorInput {
  const idOf = (n: number): string => `step-${n}`;
  return {
    workflowId: opts.workflowId || `wf-${Date.now().toString(36)}`,
    name: opts.name || plan.task.slice(0, 80),
    description: plan.task,
    steps: plan.steps.map(s => ({
      id: idOf(s.step),
      serverName: opts.serverName || 'local',
      toolName: s.tool || 'unknown',
      parameters: { task: s.task },
      dependsOn: (s.dependsOn || []).map(idOf),
    })),
  };
}

export interface AgentWorkflowInput {
  task: string;
  toolSchemas: Array<{ name: string; description?: string; schema?: unknown }>;
  orchestrator: WorkflowOrchestrator;
  serverName?: string;
  signal?: AbortSignal;
  providers?: { primary?: NeedleProvider; escalation?: ModelProvider };
  limits?: { maxIterations?: number; maxToolCalls?: number; maxExecutionMs?: number };
  /** Task-relevant prompt guidance forwarded to planning and turn-1 context. */
  guidance?: string;
}

/**
 * Full loop: plan with Needle → guard the registry to planned+known tools →
 * run the agent with the orchestrator as its only executor, recording state
 * against the workflow id.
 */
export async function runAgentWorkflow(input: AgentWorkflowInput): Promise<{
  plan: AgentPlan;
  workflowId: string;
  run: Awaited<ReturnType<typeof agentRun>>;
  state: AgentStateManager;
}> {
  const state = new AgentStateManager();
  const toolsSummary = input.toolSchemas.map(t => `${t.name}: ${t.description || ''}`).join('\n');
  const plan = await planTask(
    input.task, toolsSummary, input.signal, input.providers,
    input.toolSchemas.map(t => ({ name: t.name, description: t.description, schema: t.schema })),
    input.guidance,
  );

  const registry = new Set(input.toolSchemas.map(t => t.name));
  for (const s of plan.steps) if (s.tool) registry.add(s.tool);
  input.orchestrator.setAllowedTools([...registry]);

  const workflowId = `agent-${Date.now().toString(36)}`;
  // P0-B1: durable twin of the in-memory AgentState. Store open failure
  // degrades to memory-only; the agent loop itself never depends on SQLite.
  let store: RunStore | undefined;
  try {
    store = new RunStore();
    input.orchestrator.attachRunStore(store);
    store.createRun(input.task, { runId: workflowId, workflowId });
  } catch {
    store = undefined;
  }
  let callSeq = 0;
  const executor: AgentToolExecutor = {
    executeTool: (tool, args, signal) => {
      callSeq += 1;
      return input.orchestrator.executeTool(tool, (args as Record<string, unknown>) || {}, {
        serverName: input.serverName,
        signal,
        run: store ? { run_id: workflowId, step_id: `call-${callSeq}`, attempt: 1, policy_profile: 'full-access' } : undefined,
      });
    },
  };
  try {
    const run = await agentRun({
      task: input.task,
      toolSchemas: input.toolSchemas,
      executor,
      signal: input.signal,
      limits: input.limits,
      providers: input.providers,
      guidance: input.guidance,
      state: { manager: state, workflowId },
    });
    if (store) {
      store.recordEvent(workflowId, 'agent_end', { action: run.decision.action });
      store.finishRun(workflowId, run.decision.action === 'complete' ? 'completed' : 'failed');
    }
    return { plan, workflowId, run, state };
  } finally {
    input.orchestrator.clearAllowedTools();
  }
}
