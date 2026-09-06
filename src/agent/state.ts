/**
 * Milestone 4: agent state infrastructure.
 * The legacy SequentialThinkingManager stays as the MCP-facing compat API.
 * This manager is the agent runtime's memory: observations, decisions, tool
 * calls/results, revisions, branches, escalation, and termination — bounded
 * per session and associable with a workflow.
 */

export type TerminationReason =
  | 'completed' | 'escalated' | 'iteration_limit' | 'tool_call_limit'
  | 'time_limit' | 'aborted' | 'provider_failure' | 'cancelled';

export type AgentEvent =
  | { kind: 'observation'; text: string }
  | { kind: 'decision'; decision: unknown }
  | { kind: 'tool_call'; tool: string; args: unknown }
  | { kind: 'tool_result'; tool: string; result?: unknown; error?: string }
  | { kind: 'revision'; note: string }
  | { kind: 'branch'; branchId: string; fromEvent: number }
  | { kind: 'escalation'; reason: string; provider?: string }
  | { kind: 'rejected_tool'; tool: string }
  | { kind: 'malformed_output'; excerpt: string };

export interface AgentSession {
  id: string;
  task: string;
  workflowId?: string;
  createdAt: string;
  updatedAt: string;
  events: Array<AgentEvent & { seq: number; at: string }>;
  terminated?: { reason: TerminationReason; at: string; detail?: string };
  droppedEvents: number;
}

const DEFAULT_MAX_EVENTS = 100;

export class AgentStateManager {
  private sessions = new Map<string, AgentSession>();
  constructor(private maxEvents: number = DEFAULT_MAX_EVENTS) {}

  create(task: string, sessionId?: string, workflowId?: string): AgentSession {
    const id = sessionId || `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const now = new Date().toISOString();
    const session: AgentSession = { id, task, workflowId, createdAt: now, updatedAt: now, events: [], droppedEvents: 0 };
    this.sessions.set(id, session);
    return this.snapshot(id)!;
  }

  record(sessionId: string, event: AgentEvent): number {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`unknown agent session ${sessionId}`);
    if (s.terminated) throw new Error(`session ${sessionId} already terminated (${s.terminated.reason})`);
    const seq = (s.events.length ? s.events[s.events.length - 1].seq + 1 : 1);
    s.events.push({ ...event, seq, at: new Date().toISOString() });
    while (s.events.length > this.maxEvents) { s.events.shift(); s.droppedEvents++; }
    s.updatedAt = new Date().toISOString();
    return seq;
  }

  terminate(sessionId: string, reason: TerminationReason, detail?: string): AgentSession {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`unknown agent session ${sessionId}`);
    s.terminated = { reason, at: new Date().toISOString(), detail };
    s.updatedAt = s.terminated.at;
    return this.snapshot(sessionId)!;
  }

  snapshot(sessionId: string): AgentSession | undefined {
    const s = this.sessions.get(sessionId);
    return s ? { ...s, events: [...s.events], terminated: s.terminated ? { ...s.terminated } : undefined } : undefined;
  }

  /** Compact tail for model context: last N events as short lines. */
  tail(sessionId: string, n = 6): string[] {
    const s = this.sessions.get(sessionId);
    if (!s) return [];
    return s.events.slice(-n).map(e => {
      switch (e.kind) {
        case 'tool_call': return `call ${e.tool}(${JSON.stringify(e.args).slice(0, 100)})`;
        case 'tool_result': return e.error ? `${e.tool} ERROR ${String(e.error).slice(0, 100)}` : `${e.tool} ok ${JSON.stringify(e.result).slice(0, 100)}`;
        case 'decision': return `decision ${JSON.stringify(e.decision).slice(0, 120)}`;
        case 'escalation': return `escalated: ${e.reason.slice(0, 120)}`;
        case 'revision': return `revised: ${e.note.slice(0, 120)}`;
        case 'branch': return `branch ${e.branchId} from #${e.fromEvent}`;
        case 'rejected_tool': return `rejected ${e.tool}`;
        case 'malformed_output': return `malformed: ${e.excerpt.slice(0, 80)}`;
        case 'observation': return e.text.slice(0, 140);
      }
    });
  }

  stats(sessionId: string): { events: number; toolCalls: number; errors: number; escalations: number; revisions: number; droppedEvents: number; terminated?: TerminationReason } | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    return {
      events: s.events.length,
      toolCalls: s.events.filter(e => e.kind === 'tool_call').length,
      errors: s.events.filter(e => e.kind === 'tool_result' && e.error).length,
      escalations: s.events.filter(e => e.kind === 'escalation').length,
      revisions: s.events.filter(e => e.kind === 'revision').length,
      droppedEvents: s.droppedEvents,
      terminated: s.terminated?.reason,
    };
  }

  sessionsForWorkflow(workflowId: string): string[] {
    return [...this.sessions.values()].filter(s => s.workflowId === workflowId).map(s => s.id);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}
