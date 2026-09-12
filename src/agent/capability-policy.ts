/**
 * HeLa capability policy (P0-A6).
 *
 * Canonical machine-readable contract for every high-impact tool, per
 * `research/hela-tool-contract-matrix.md` and `design/capability-contract.md`:
 *
 *   capability -> policy -> normalized target -> execution -> redacted result -> provenance
 *
 * Risk tiers:
 *   R0 observation            — no approval, output limits, minimal logging.
 *   R1 reversible mutation    — policy-controlled, RunStore required.
 *   R2 destructive mutation   — policy + explicit approval (profile-dependent).
 *   R3 privileged execution   — explicit capability grant, isolated, audited.
 *     Never treat R3 as an ordinary tool merely because MCP exposes it.
 */

export type RiskTier = 'read' | 'write' | 'destructive' | 'privileged';
export type SecretsExposure = 'none' | 'possible' | 'direct';

export interface HelaCapabilityContract {
  capability: string;
  operation: string;
  risk: RiskTier;
  idempotent: boolean;
  openWorld: boolean;
  requiresApproval: boolean;
  allowedTargets?: string[];
  timeoutMs: number;
  maxOutputBytes?: number;
  sideEffects: string[];
  secretsExposure: SecretsExposure;
  provenanceRequired: boolean;
}

export interface PolicyProfile {
  name: string;
  /** R2 tools need explicit approval when true. */
  approveDestructive: boolean;
  /** R3 tools need an explicit per-capability grant when true. */
  approvePrivileged: boolean;
  /** Maximum output bytes accepted from any single tool call. */
  maxOutputBytes: number;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
}

export const POLICY_PROFILES: Record<string, PolicyProfile> = {
  /** Solo-operator default: full access, destructive + privileged allowed, everything audited. */
  'full-access': { name: 'full-access', approveDestructive: false, approvePrivileged: false, maxOutputBytes: 1_000_000 },
  /** Constrained profile: destructive and privileged calls need explicit approval. */
  'constrained': { name: 'constrained', approveDestructive: true, approvePrivileged: true, maxOutputBytes: 250_000 },
};

export function resolveProfile(name?: string): PolicyProfile {
  if (name && POLICY_PROFILES[name]) return POLICY_PROFILES[name];
  const env = (process.env.HELA_POLICY_PROFILE || '').trim();
  if (env && POLICY_PROFILES[env]) return POLICY_PROFILES[env];
  return POLICY_PROFILES['full-access'];
}

/**
 * Pure policy check: decide whether a capability may run under a profile.
 * Side-effect enforcement (roots, network, approval UX) lives in providers;
 * this is the shared vocabulary Mitosis routes on before dispatch.
 */
export function checkCapability(contract: HelaCapabilityContract, profile: PolicyProfile): PolicyDecision {
  switch (contract.risk) {
    case 'read':
      return { allowed: true, reason: 'R0 observation', requiresApproval: false };
    case 'write':
      return { allowed: true, reason: 'R1 reversible mutation under policy', requiresApproval: contract.requiresApproval };
    case 'destructive':
      if (profile.approveDestructive || contract.requiresApproval) {
        return { allowed: false, reason: `R2 destructive '${contract.capability}' requires explicit approval under profile '${profile.name}'`, requiresApproval: true };
      }
      return { allowed: true, reason: `R2 destructive '${contract.capability}' permitted by profile '${profile.name}'`, requiresApproval: false };
    case 'privileged':
      if (profile.approvePrivileged || contract.requiresApproval) {
        return { allowed: false, reason: `R3 privileged '${contract.capability}' requires explicit grant under profile '${profile.name}'`, requiresApproval: true };
      }
      return { allowed: true, reason: `R3 privileged '${contract.capability}' permitted by profile '${profile.name}'`, requiresApproval: false };
  }
}

/** Invocation metadata Mitosis attaches so runs are traceable end to end. */
export interface HelaInvocationMeta {
  run_id: string;
  step_id: string;
  attempt: number;
  parent_step_id?: string;
  policy_profile: string;
}
