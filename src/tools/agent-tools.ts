import { Tool } from '@modelcontextprotocol/sdk/types.js';

/** Milestone 8: the agent-first MCP surface. Legacy cognition tools remain listed for compat. */
export const agentTools: Tool[] = [
  {
    name: 'agent_run',
    description: 'Run a task through the Needle agent runtime: plans with the local model, executes tools via the workflow orchestrator, escalates to OpenRouter only on low confidence or failure. Requires MITOSIS_AGENT_ENABLED=true and a fetched engine (npm run needle:fetch).',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task or objective for the agent to accomplish' },
        maxIterations: { type: 'number', minimum: 1, maximum: 20, default: 8, description: 'Maximum agent decide-act-observe iterations' },
        maxToolCalls: { type: 'number', minimum: 1, maximum: 30, default: 12, description: 'Maximum tool executions per run' },
        maxExecutionMs: { type: 'number', minimum: 1000, maximum: 300000, default: 60000, description: 'Maximum run wall-clock time in milliseconds' },
      },
      required: ['task'],
    },
  },
];

export const workflowLifecycleTools: Tool[] = [
  {
    name: 'workflow_status',
    description: 'Get the current status and step results of a workflow executed by workflow_orchestrator or agent_run',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow identifier returned by workflow_orchestrator or agent_run' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'workflow_cancel',
    description: 'Request cancellation of a running workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow identifier to cancel' },
      },
      required: ['workflowId'],
    },
  },
];
