import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const coreChainingTools: Tool[] = [
  {
    name: 'list_mcp_servers',
    description: 'Lists all discovered MCP servers on the system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'analyze_tools',
    description: 'Analyzes available tools from discovered MCP servers',
    inputSchema: {
      type: 'object',
      properties: {
        serverName: { type: 'string', description: 'Filter by specific server name' },
        category: { type: 'string', description: 'Filter by tool category' },
      },
    },
  },
  {
    name: 'generate_route_suggestions',
    description: 'Generates optimal route suggestions for a given task',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task or problem to solve' },
        criteria: {
          type: 'object',
          description: 'Optimization criteria',
          properties: {
            prioritizeSpeed: { type: 'boolean', description: 'Optimize for speed' },
            prioritizeSimplicity: { type: 'boolean', description: 'Optimize for simplicity' },
            prioritizeReliability: { type: 'boolean', description: 'Optimize for reliability' },
            maxComplexity: { type: 'number', minimum: 1, maximum: 10, description: 'Maximum complexity level' },
            maxDuration: { type: 'number', description: 'Maximum duration in milliseconds' },
            requiredCapabilities: { type: 'array', items: { type: 'string' }, description: 'Required capabilities' },
            excludedTools: { type: 'array', items: { type: 'string' }, description: 'Tools to exclude' },
          },
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'analyze_with_sequential_thinking',
    description: 'Analyzes complex workflows using sequential thinking',
    inputSchema: {
      type: 'object',
      properties: {
        problem: { type: 'string', description: 'The problem to analyze' },
        criteria: {
          type: 'object',
          description: 'Optimization criteria',
        },
        maxThoughts: { type: 'number', minimum: 1, maximum: 20, default: 10, description: 'Maximum number of thoughts' },
      },
      required: ['problem'],
    },
  },
  {
    name: 'get_tool_chain_analysis',
    description: 'Gets comprehensive analysis of available tools and suggested routes',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input description for analysis' },
        criteria: {
          type: 'object',
          description: 'Optimization criteria',
        },
      },
      required: ['input'],
    },
  },
  {
    name: 'sequentialthinking',
    description: 'Think one step with the Mitosis agent: your thought is recorded as an observation in AgentState, Needle decides the next action (call_tool/revise/complete/escalate), and the result feeds the next step. Pass sessionId to continue a session. [Legacy caller-supplied-thought mode when MITOSIS_AGENT_ENABLED is off.]',
    inputSchema: {
      type: 'object',
      properties: {
        thought: { type: 'string', description: 'Your current thinking step' },
        nextThoughtNeeded: { type: 'boolean', description: 'Whether another thought step is needed' },
        thoughtNumber: { type: 'number', description: 'Current thought number' },
        totalThoughts: { type: 'number', description: 'Estimated total thoughts needed' },
        isRevision: { type: 'boolean', description: 'Whether this revises previous thinking' },
        revisesThought: { type: 'number', description: 'Which thought is being reconsidered' },
        branchFromThought: { type: 'number', description: 'Branching point thought number' },
        branchId: { type: 'string', description: 'Branch identifier' },
        needsMoreThoughts: { type: 'boolean', description: 'If more thoughts are needed' },
        task: { type: 'string', description: 'Ongoing task this step belongs to (agent mode; defaults to the thought)' },
        sessionId: { type: 'string', description: 'Continue an existing agent session (agent mode)' },
        execute: { type: 'boolean', default: true, description: 'Execute a call_tool decision immediately (agent mode)' },
      },
      required: ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts'],
    },
  },
];
