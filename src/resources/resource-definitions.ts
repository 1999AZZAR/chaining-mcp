import { Resource } from '@modelcontextprotocol/sdk/types.js';

export const chainingResources: Resource[] = [
  {
    uri: 'chaining://servers',
    name: 'MCP Servers',
    description: 'Returns a JSON list of all discovered MCP servers',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://tools',
    name: 'Available Tools',
    description: 'Returns a JSON list of all available tools from discovered servers',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://analysis',
    name: 'Tool Chain Analysis',
    description: 'Returns a JSON summary of the current analysis state',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://prompts',
    name: 'Prebuilt Prompts',
    description: 'Returns a JSON collection of all available prebuilt prompts for common development tasks',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://resources',
    name: 'Resource Sets',
    description: 'Returns a JSON collection of curated resource sets for different development scenarios',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://prompts/overview',
    name: 'Prompts Overview',
    description: 'Returns a JSON overview of available prompts by category and complexity level',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://awesome-copilot/collections',
    name: 'Awesome Copilot Collections',
    description: 'Returns a JSON collection of all available awesome-copilot collections with their metadata',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://awesome-copilot/instructions',
    name: 'Awesome Copilot Instructions',
    description: 'Returns a JSON collection of all available awesome-copilot instructions with their metadata',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://awesome-copilot/status',
    name: 'Awesome Copilot Integration Status',
    description: 'Returns a JSON object with the current status of awesome-copilot integration',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://sequential/state',
    name: 'Sequential Thinking State',
    description: 'Returns a JSON object with the current state of sequential thinking sessions, including thought history and active session status',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://workflows/status',
    name: 'Workflow Orchestrator Status',
    description: 'Returns a JSON object with the status of active and completed workflow orchestrations, including execution progress and results',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://tool-chains',
    name: 'Tool Chaining Resources',
    description: 'Returns a JSON collection of comprehensive tool chaining resources including prompts and resource sets specifically designed for complex development workflows and orchestration patterns',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://tool-chains/overview',
    name: 'Tool Chaining Overview',
    description: 'Returns a JSON overview of available tool chaining resources organized by category and complexity level, providing insights into the tool chaining capabilities',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://health',
    name: 'Server Health Status',
    description: 'Returns real-time health status of all tools, discovery services, and integrations',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://cache/stats',
    name: 'Cache Statistics',
    description: 'Returns cache hit/miss statistics and discovery cache state',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://llm/status',
    name: 'Internal LLM Engine Status',
    description: 'Returns status and configuration of internal LLM engine (never exposes keys)',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://llm/usage',
    name: 'Internal LLM Usage Statistics',
    description: 'Returns token usage and call volume for the internal LLM engine',
    mimeType: 'application/json',
  },
  {
    uri: 'chaining://agent/status',
    name: 'Needle Agent Runtime Status',
    description: 'Returns configuration and readiness of the local Needle agent runtime and escalation policy (never exposes keys)',
    mimeType: 'application/json',
  },
];
