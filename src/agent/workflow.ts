/**
 * Milestone 5: agentic workflow loop.
 * Needle plans and decides; WorkflowOrchestrator executes; observations flow
 * back into the agent. The agent never touches the transport directly — every
 * tool call passes through orchestrator.executeTool (registry + transport).
 */
import { WorkflowOrchestrator } from '../managers/workflow-orchestrator.js';
import type { WorkflowOrchestratorInput } from '../types.js';
import { agentRun, planTask, type AgentToolExecutor } from './agent.js';
import type { AgentPlan } from './schemas.js';
import { AgentStateManager } from './state.js';
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
  const plan = await planTask(input.task, toolsSummary, input.signal, input.providers);

  const registry = new Set(input.toolSchemas.map(t => t.name));
  for (const s of plan.steps) if (s.tool) registry.add(s.tool);
  input.orchestrator.setAllowedTools([...registry]);

  const workflowId = `agent-${Date.now().toString(36)}`;
  const executor: AgentToolExecutor = {
    executeTool: (tool, args, signal) =>
      input.orchestrator.executeTool(tool, (args as Record<string, unknown>) || {}, { serverName: input.serverName, signal }),
  };
  try {
    const run = await agentRun({
      task: input.task,
      toolSchemas: input.toolSchemas,
      executor,
      signal: input.signal,
      limits: input.limits,
      providers: input.providers,
      state: { manager: state, workflowId },
    });
    return { plan, workflowId, run, state };
  } finally {
    input.orchestrator.clearAllowedTools();
  }
}
