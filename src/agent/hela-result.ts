/**
 * HeLaResult envelope (P1-C1, Mitosis adapter).
 *
 * Canonical auditable result shape for every consequential tool call:
 *
 *   ok / summary / data / artifacts / provenance /
 *   warnings / sideEffects / execution / redaction
 *
 * Field-name reconciliation (todo E4, decided here): the contract doc uses
 * `data`, the tool-contract matrix uses `structured`. Canonical is `data`;
 * providers still returning `structured` are normalized on wrap, never
 * passed through as a second field.
 *
 * Additive by design: raw tool payloads are untouched. Mitosis wraps them
 * into envelopes at the transport seam (`executeTool` opts.envelope) and
 * RunStore keeps persisting the raw payload so resume restores raw results.
 */

import type { HelaCapabilityContract, HelaInvocationMeta } from './capability-policy.js';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

export interface HelaArtifactRef {
  uri: string;
  sha256?: string;
  size?: number;
  media_type?: string;
}

export interface HelaProvenanceRef {
  source: string;
  retrieved_at?: string;
  confidence?: number;
  freshness?: string;
}

export interface HelaRedaction {
  applied: boolean;
  fields: string[];
}

export interface HelaExecutionMeta {
  serverName?: string;
  toolName?: string;
  run_id?: string;
  step_id?: string;
  attempt?: number;
  executionTimeMs?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface HelaResult<T = any> {
  ok: boolean;
  summary: string;
  /** Canonical payload field (reconciles matrix `structured` vs contract `data`). */
  data: T;
  artifacts: HelaArtifactRef[];
  provenance: HelaProvenanceRef[];
  warnings: string[];
  sideEffects: string[];
  execution: HelaExecutionMeta;
  redaction: HelaRedaction;
  error?: string;
}

export interface HelaWrapOptions {
  serverName?: string;
  toolName?: string;
  contract?: HelaCapabilityContract;
  run?: HelaInvocationMeta;
  summary?: string;
  executionTimeMs?: number;
  startedAt?: string;
  completedAt?: string;
}

function baseExecution(opts: HelaWrapOptions): HelaExecutionMeta {
  return {
    ...(opts.serverName !== undefined ? { serverName: opts.serverName } : {}),
    ...(opts.toolName !== undefined ? { toolName: opts.toolName } : {}),
    ...(opts.run?.run_id !== undefined ? { run_id: opts.run.run_id } : {}),
    ...(opts.run?.step_id !== undefined ? { step_id: opts.run.step_id } : {}),
    ...(opts.run?.attempt !== undefined ? { attempt: opts.run.attempt } : {}),
    ...(opts.executionTimeMs !== undefined ? { executionTimeMs: opts.executionTimeMs } : {}),
    ...(opts.startedAt !== undefined ? { startedAt: opts.startedAt } : {}),
    ...(opts.completedAt !== undefined ? { completedAt: opts.completedAt } : {}),
  };
}

/** Type guard: distinguishes envelopes from raw payloads (idempotent wrap). */
export function isHelaResult(value: unknown): value is HelaResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.ok === 'boolean'
    && typeof v.summary === 'string'
    && 'data' in v
    && Array.isArray(v.artifacts)
    && Array.isArray(v.provenance)
    && Array.isArray(v.warnings)
    && Array.isArray(v.sideEffects)
    && typeof v.execution === 'object'
    && typeof v.redaction === 'object';
}

/**
 * Wrap a raw tool payload into the canonical envelope. Already-enveloped
 * values pass through untouched (idempotent). A legacy `{ structured }`
 * payload is normalized into `data` with a warning, never dual-fielded.
 */
export function wrapHelaResult(raw: any, opts: HelaWrapOptions = {}): HelaResult {
  if (isHelaResult(raw)) return raw;
  const startedAt = opts.startedAt || new Date().toISOString();
  let data = raw;
  const warnings: string[] = [];
  if (typeof raw === 'object' && raw !== null && 'structured' in raw && !('data' in raw)) {
    const { structured, ...rest } = raw as Record<string, any>;
    void rest;
    data = structured;
    warnings.push('legacy `structured` field normalized to canonical `data`');
  }
  return {
    ok: true,
    summary: opts.summary || (opts.toolName ? `${opts.toolName} ok` : 'ok'),
    data,
    artifacts: [],
    provenance: [],
    warnings,
    sideEffects: opts.contract ? [...opts.contract.sideEffects] : [],
    execution: { ...baseExecution(opts), startedAt, completedAt: opts.completedAt || new Date().toISOString() },
    redaction: { applied: false, fields: [] },
  };
}

/** Failure envelope for a thrown tool error (throw path stays throwable). */
export function wrapHelaError(error: unknown, opts: HelaWrapOptions = {}): HelaResult<null> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    ok: false,
    summary: opts.summary || (opts.toolName ? `${opts.toolName} failed: ${message}` : `failed: ${message}`),
    data: null,
    artifacts: [],
    provenance: [],
    warnings: [],
    sideEffects: opts.contract ? [...opts.contract.sideEffects] : [],
    execution: { ...baseExecution(opts), completedAt: new Date().toISOString() },
    redaction: { applied: false, fields: [] },
    error: message,
  };
}

/* ------------------------------------------------------------------ *
 * P1-C3: artifact addressing + redaction metadata (shared helpers).  *
 * Providers copy this shape; Mitosis is the reference implementation.*
 * ------------------------------------------------------------------ */

/** sha256 hex of bytes or utf-8 string (test-verifiable known vectors). */
export function sha256Hex(input: Uint8Array | string): string {
  const buf = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return createHash('sha256').update(buf).digest('hex');
}

export interface HelaArtifactOptions {
  uri?: string;
  media_type?: string;
}

/**
 * Build an artifact ref from in-memory bytes. Default uri is content-
 * addressed (`bytes:sha256:<hex>`) so identical payloads dedupe.
 */
export function artifactFromBytes(
  bytes: Uint8Array | string,
  opts: HelaArtifactOptions = {},
): HelaArtifactRef {
  const buf = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const hex = sha256Hex(buf);
  return {
    uri: opts.uri ?? `bytes:sha256:${hex}`,
    sha256: hex,
    size: buf.byteLength,
    ...(opts.media_type !== undefined ? { media_type: opts.media_type } : {}),
  };
}

/**
 * Build an artifact ref from a file on disk. Default uri is `file://<path>`;
 * size comes from stat (not the buffer) so sparse/large files report true size.
 */
export function artifactFromFile(
  path: string,
  opts: HelaArtifactOptions = {},
): HelaArtifactRef {
  const buf = readFileSync(path);
  const size = statSync(path).size;
  return {
    uri: opts.uri ?? `file://${path}`,
    sha256: sha256Hex(buf),
    size,
    ...(opts.media_type !== undefined ? { media_type: opts.media_type } : {}),
  };
}

export interface RedactRule {
  /** Exact object-key match at any depth (case-insensitive). Whole value replaced. */
  field?: string;
  /** Tested against string values; matches replaced in place. */
  pattern?: RegExp;
  replacement?: string;
}

const DEFAULT_REPLACEMENT = '[REDACTED]';

/** Ready-made rules for the usual secret-bearing keys. */
export function commonSecretRules(): RedactRule[] {
  return [
    'api_key', 'apikey', 'api-key', 'token', 'access_token', 'refresh_token',
    'password', 'passwd', 'secret', 'client_secret', 'authorization', 'auth',
    'cookie', 'set-cookie', 'session', 'private_key',
  ].map((field) => ({ field }));
}

/**
 * Recursively scrub secrets from a payload. Returns the scrubbed copy plus
 * the redaction metadata that belongs on `HelaResult.redaction`. Pure: the
 * input is never mutated. `fields` lists every key/pattern that fired.
 */
export function redactFields<T>(data: T, rules: RedactRule[]): { data: T; redaction: HelaRedaction } {
  const fired = new Set<string>();
  const scrub = (value: unknown, key?: string): unknown => {
    if (typeof value === 'string') {
      for (const rule of rules) {
        if (
          rule.field !== undefined
          && key !== undefined
          && key.toLowerCase() === rule.field.toLowerCase()
        ) {
          fired.add(key);
          return rule.replacement ?? DEFAULT_REPLACEMENT;
        }
      }
      let out = value;
      for (const rule of rules) {
        if (!rule.pattern) continue;
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(out)) {
          rule.pattern.lastIndex = 0;
          out = out.replace(rule.pattern, rule.replacement ?? DEFAULT_REPLACEMENT);
          fired.add(key ?? '(value)');
        }
      }
      return out;
    }
    if (Array.isArray(value)) return value.map((item) => scrub(item));
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrub(v, k);
      return out;
    }
    return value;
  };
  const redacted = scrub(data) as T;
  const fields = [...fired];
  return { data: redacted, redaction: { applied: fields.length > 0, fields } };
}
