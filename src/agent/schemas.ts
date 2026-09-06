import { z } from 'zod';

export const AgentDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('call_tool'), tool: z.string(), args: z.record(z.any()), reasoning: z.string().optional(), confidence: z.number().min(0).max(1).optional() }),
  z.object({ action: z.literal('complete'), result: z.any(), reasoning: z.string().optional() }),
  z.object({ action: z.literal('revise'), note: z.string(), patch: z.any().optional() }),
  z.object({ action: z.literal('escalate'), reason: z.string(), context: z.any().optional() }),
]);
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export const AgentPlanStepSchema = z.object({
  step: z.number(),
  task: z.string(),
  tool: z.string().optional(),
  recommendedCategory: z.string().optional(),
  dependsOn: z.array(z.number()).default([]),
});
export type AgentPlanStep = z.infer<typeof AgentPlanStepSchema>;
export const AgentPlanSchema = z.object({ task: z.string(), steps: z.array(AgentPlanStepSchema) });
export type AgentPlan = z.infer<typeof AgentPlanSchema>;

export type ProviderFailureCode =
  | 'MODEL_UNAVAILABLE' | 'TIMEOUT' | 'MALFORMED_OUTPUT' | 'AUTH_ERROR' | 'RATE_LIMITED' | 'UNKNOWN';
export interface ProviderError extends Error { code: ProviderFailureCode; retryable: boolean }

export interface ModelRequest {
  prompt: string;
  systemPrompt?: string;
  signal?: AbortSignal;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ModelResponse {
  text: string;
  modelUsed: string;
  latencyMs: number;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface ProviderMetadata { name: string; kind: 'local' | 'remote'; model: string; capabilities: string[] }

export interface ModelProvider {
  generate(req: ModelRequest): Promise<ModelResponse>;
  health(): Promise<{ ok: boolean; detail?: string }>;
  metadata(): ProviderMetadata;
}
