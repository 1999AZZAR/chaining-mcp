import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { coreChainingTools } from './core-chaining-tools.js';
import { awesomeCopilotTools } from './awesome-copilot-tools.js';
import { sequentialThinkingTools } from './sequential-thinking-tools.js';
import { timeManagementTools } from './time-management-tools.js';
import { promptResourceTools } from './prompt-resource-tools.js';
import { validationAnalysisTools } from './validation-analysis-tools.js';
import { llmTools } from './llm-tools.js';
import { agentTools, workflowLifecycleTools } from './agent-tools.js';
import { skillTools } from './skill-tools.js';
import { isAgentEnabled } from '../agent/diagnostics.js';

const isLlmEnabled = (process.env.CHAINING_LLM_ENABLED || 'true').toLowerCase() !== 'false';
const agentOn = isAgentEnabled();

export const allTools: Tool[] = [
  ...coreChainingTools,
  ...awesomeCopilotTools,
  ...sequentialThinkingTools,
  ...timeManagementTools,
  ...promptResourceTools,
  ...validationAnalysisTools,
  ...workflowLifecycleTools,
  ...skillTools,
  ...(isLlmEnabled ? llmTools : []),
  ...(agentOn ? agentTools : []),
];

export {
  coreChainingTools,
  awesomeCopilotTools,
  sequentialThinkingTools,
  timeManagementTools,
  promptResourceTools,
  validationAnalysisTools,
  llmTools,
  agentTools,
  workflowLifecycleTools,
  skillTools,
};
