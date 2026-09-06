/**
 * Milestone 6: explicit escalation policy.
 * Escalation is a budgeted, recorded, one-way trip — never a silent fallback
 * and never a loop. Triggers: low confidence, refusal, malformed output,
 * provider failure, repeated tool failures. The escalation provider failing
 * ends the run with the full trail attached, not a ping-pong.
 */

export type EscalationTrigger =
  | 'low_confidence' | 'refusal' | 'malformed_output'
  | 'provider_failure' | 'repeated_tool_failure' | 'unhealthy_primary';

export interface EscalationRecord {
  trigger: EscalationTrigger;
  detail?: string;
  at: string;
}

export interface EscalationPolicy {
  /** Max times the run may switch to the escalation provider (default 1: one-way trip). */
  maxEscalations: number;
  /** Consecutive tool errors that force escalation (default 3). */
  repeatedToolFailureThreshold: number;
}

export function escalationPolicyFromEnv(): EscalationPolicy {
  const enabled = (process.env.AGENT_ESCALATION_ENABLED || 'true').toLowerCase() !== 'false';
  return {
    maxEscalations: enabled ? parseInt(process.env.AGENT_MAX_ESCALATIONS || '1', 10) : 0,
    repeatedToolFailureThreshold: parseInt(process.env.AGENT_REPEATED_FAILURE_THRESHOLD || '3', 10),
  };
}

export class EscalationController {
  private records: EscalationRecord[] = [];
  private consecutiveToolFailures = 0;
  constructor(private policy: EscalationPolicy = escalationPolicyFromEnv()) {}

  get trail(): EscalationRecord[] {
    return [...this.records];
  }

  get escalated(): boolean {
    return this.records.length > 0;
  }

  noteToolResult(ok: boolean): EscalationTrigger | null {
    this.consecutiveToolFailures = ok ? 0 : this.consecutiveToolFailures + 1;
    if (!ok && this.consecutiveToolFailures >= this.policy.repeatedToolFailureThreshold) {
      return 'repeated_tool_failure';
    }
    return null;
  }

  /** Request a switch to the escalation provider. Throws when the budget is spent. */
  escalate(trigger: EscalationTrigger, detail?: string): EscalationRecord {
    if (this.records.length >= this.policy.maxEscalations) {
      throw new Error(
        `escalation budget spent (${this.records.length}/${this.policy.maxEscalations}); ` +
        `refusing further escalation on '${trigger}'. Trail: ${this.records.map(r => r.trigger).join(' → ')}`,
      );
    }
    const record: EscalationRecord = { trigger, detail, at: new Date().toISOString() };
    this.records.push(record);
    return record;
  }
}
