import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const llmTools: Tool[] = [
  {
    name: 'llm_query',
    description: 'Execute a direct query using the internal LLM engine (OpenRouter/OpenAI compatible, disabled by default)',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt to send to the internal LLM' },
        systemPrompt: { type: 'string', description: 'Optional system prompt override' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'llm_decompose_task',
    description: 'Decompose a complex goal into ordered subtasks with recommended tool categories. [Legacy compat API — routes via the Needle planner when MITOSIS_AGENT_ENABLED=true.]',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The complex task or objective to decompose' },
      },
      required: ['task'],
    },
  },
  {
    name: 'llm_suggest_route',
    description: 'Use LLM intelligence to score and rank optimal multi-tool execution routes. [Legacy compat API — prefer agent_run when MITOSIS_AGENT_ENABLED=true.]',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description' },
        criteria: {
          type: 'object',
          properties: {
            prioritizeSpeed: { type: 'boolean' },
            prioritizeSimplicity: { type: 'boolean' },
            prioritizeReliability: { type: 'boolean' },
          },
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'llm_summarize',
    description: 'Compress verbose tool outputs, logs, or multi-step execution results',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Raw content to summarize' },
        maxWords: { type: 'number', description: 'Target maximum words (default 100)' },
      },
      required: ['content'],
    },
  },
];
