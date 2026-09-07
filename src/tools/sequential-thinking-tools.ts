import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const sequentialThinkingTools: Tool[] = [
  {
    name: 'brainstorming',
    description: 'Generate creative ideas via a generative model (requires CHAINING_LLM_ENABLED with OPENROUTER_API_KEY; fails honestly without a key — no template ideas)',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The topic or problem to brainstorm about' },
        context: { type: 'string', description: 'Additional context or background information' },
        approach: {
          type: 'string',
          enum: ['creative', 'analytical', 'practical', 'innovative'],
          default: 'creative',
          description: 'The brainstorming approach'
        },
        ideaCount: { type: 'number', minimum: 3, maximum: 20, default: 10, description: 'Number of ideas to generate' },
        includeEvaluation: { type: 'boolean', default: true, description: 'Whether to include evaluation and prioritization' },
        constraints: { type: 'array', items: { type: 'string' }, description: 'Array of constraints or requirements to consider' },
      },
      required: ['topic'],
    },
  },
  {
    name: 'workflow_orchestrator',
    description: 'Execute complex multi-server workflows across the MCP ecosystem with dependency management and error handling',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Unique identifier for the workflow' },
        name: { type: 'string', description: 'Human-readable name for the workflow' },
        description: { type: 'string', description: 'Description of what this workflow does' },
        steps: {
          type: 'array',
          description: 'Array of workflow steps to execute',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique identifier for this step' },
              serverName: { type: 'string', description: 'Name of the MCP server to execute on' },
              toolName: { type: 'string', description: 'Name of the tool to execute' },
              parameters: { type: 'object', description: 'Parameters to pass to the tool' },
              dependsOn: { type: 'array', items: { type: 'string' }, description: 'IDs of steps that must complete before this step' },
              outputMapping: { type: 'object', description: 'Map outputs from this step to input parameters for dependent steps' },
              retryOnFailure: { type: 'boolean', description: 'Whether to retry this step on failure' },
              maxRetries: { type: 'number', description: 'Maximum number of retries' },
            },
            required: ['id', 'serverName', 'toolName', 'parameters'],
          },
        },
        failFast: { type: 'boolean', description: 'Whether to stop execution on first failure' },
        timeout: { type: 'number', description: 'Maximum execution time in milliseconds' },
        variables: { type: 'object', description: 'Global variables available to all steps' },
      },
      required: ['workflowId', 'name', 'steps'],
    },
  },
];
