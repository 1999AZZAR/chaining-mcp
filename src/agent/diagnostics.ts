import { existsSync } from 'node:fs';

/**
 * Agent enablement: the Needle engine is bundled (assets/needle), so the
 * runtime is ON whenever the engine is present unless explicitly disabled
 * with MITOSIS_AGENT_ENABLED=false. No model env vars required.
 */
export function bundledEnginePath(): string {
  const exe = process.platform === 'win32' ? 'needle.exe' : 'needle';
  return process.env.NEEDLE_ENGINE_PATH || `assets/needle/${exe}`;
}

export function isAgentEnabled(): boolean {
  if ((process.env.MITOSIS_AGENT_ENABLED || '').toLowerCase() === 'false') return false;
  if ((process.env.MITOSIS_AGENT_ENABLED || '').toLowerCase() === 'true') return true;
  return existsSync(bundledEnginePath());
}

/**
 * Cheap, spawn-free agent diagnostics for chaining://agent/status.
 * Never exposes keys; never starts the engine (health() does that).
 */
export function agentStatus(): {
  enabled: boolean;
  provider: string;
  engine: { path: string; present: boolean };
  model: { path: string; present: boolean };
  confidenceThreshold: number;
  servePort: number;
  useServer: boolean;
  escalation: { enabled: boolean; provider: string; maxEscalations: number; repeatedFailureThreshold: number; hasKey: boolean };
} {
  const exe = process.platform === 'win32' ? 'needle.exe' : 'needle';
  const enginePath = bundledEnginePath();
  const modelPath = process.env.NEEDLE_MODEL_PATH || 'assets/needle/needle2.cact';
  return {
    enabled: isAgentEnabled(),
    provider: process.env.MITOSIS_AGENT_PROVIDER || 'needle',
    engine: { path: enginePath, present: existsSync(enginePath) },
    model: { path: modelPath, present: existsSync(modelPath) },
    confidenceThreshold: parseFloat(process.env.NEEDLE_CONFIDENCE_THRESHOLD || '0.6'),
    servePort: parseInt(process.env.NEEDLE_PORT || '18080', 10),
    useServer: (process.env.NEEDLE_USE_SERVER || 'true').toLowerCase() !== 'false',
    escalation: {
      enabled: (process.env.AGENT_ESCALATION_ENABLED || 'true').toLowerCase() !== 'false',
      provider: process.env.AGENT_ESCALATION_PROVIDER || 'openrouter',
      maxEscalations: parseInt(process.env.AGENT_MAX_ESCALATIONS || '1', 10),
      repeatedFailureThreshold: parseInt(process.env.AGENT_REPEATED_FAILURE_THRESHOLD || '3', 10),
      hasKey: Boolean(process.env.OPENROUTER_API_KEY),
    },
  };
}
