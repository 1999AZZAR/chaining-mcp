# Needle Agent Runtime — `feat/needle-agent-runtime`

Base: `main` @ `b22a843`. Main stays stable; all work here.

## Milestone 1 — Needle provider [x] engine bundled, serve mode live
- [x] `ModelProvider` seam (`src/agent/schemas.ts`)
- [x] `NeedleProvider` spawns bundled CLI (`src/agent/needle-provider.ts`)
- [x] `OpenRouterProvider` adapter, no behavior change
- [x] `scripts/fetch-needle.mjs` + `npm run needle:fetch` (engine + `needle2.cact`, gitignored)
- [x] Engine smoke-tested (0.84 one-shot, 0.77 via serve)
- [x] Persistent `--serve` mode (`NEEDLE_PORT`, `NEEDLE_USE_SERVER=false` → one-shot)
- [ ] `NEEDLE_TOOL_INDEX_PATH` for large catalogues
- [ ] Diagnostics via MCP status tool
- [ ] Tuned `.cact` flow (`NEEDLE_MODEL_PATH`) once we finetune

## Milestone 2 — Agent decision protocol [x] verified live
- [x] Strict `AgentDecision` zod schema + validation
- [x] `agentRun()` loop — live: call→execute→escalate path confirmed
- [x] Native→decision translation (refusal→escalate, respond→complete, low-conf→escalate)
- [x] Escalation failure carries Needle observation count
- [ ] `tests/agent/` limits + malformed-output tests

## Milestone 3 — Replace `decomposeTask()` [~] Needle-first planner live
- [x] `planTask()` — constrained `define_step` pseudo-tool → validated `AgentPlan`
- [x] Fallback chain: Needle → OpenRouter → legacy heuristic
- [x] `llm_decompose_task` handler routes via `planTask()` when `MITOSIS_AGENT_ENABLED=true` (legacy shape preserved, `source` field added)
- [ ] Single-step plans for trivial tasks; parallelizable steps (quality tuning)
- [ ] Remove hardcoded fallback (only after benchmark)

## Loop reliability fixes (live findings)
- [x] Compact observations (was: full history JSON blob → confidence collapse)
- [x] Result-forward turns per Needle contract (feed raw result, not prose wrapper)
- [x] HTTP keep-alive fix (`Connection: close` + one retry; engine hung 2nd request)
- [x] Saturation guard: identical re-call → `complete` with last result
- [ ] Model variance across identical prompts (0.97 vs 0.005 conf) — needs benchmark + finetune; loop handles via escalation

## Milestone 4 — Sequential thinking → agent state [x] live, 25/25 green
- [x] `src/agent/state.ts` — `AgentStateManager`: sessions, typed events, bounded history + drop count, termination reasons, `tail()`, `stats()`, workflow association
- [x] `agentRun(state: {manager, sessionId?, workflowId?})` records decisions/calls/results/revisions/escalations/rejections/malformed + termination; absent = zero behavior change
- [x] `tests/agent/state.test.mjs` — 7 tests (lifecycle, bounds, tail, workflow grouping, limit-breach termination)
- [x] Fixed live flakes: per-instance free serve ports (was: fixed 18080 → cross-test bind conflicts), startup readiness probe
- [ ] Legacy `SequentialThinkingManager` stays as compat shim (untouched)
- [ ] Expose session snapshot via MCP tool (Milestone 8)

## Milestone 5 — Agentic workflow loop [x] live, 36/36 green
- [x] `MCPTransport` seam: `setTransport()` (e.g. `RequestHandlers.handleToolCall`); unset = legacy placeholder, zero behavior change
- [x] Real retry execution (`retryOnFailure` + `maxRetries` actually re-run; `retryCount` real)
- [x] Cancellation via `AbortSignal` (per-step checks, stops between batches, `cancelled` survives aggregation — fixed overwrite bug)
- [x] `executeTool()` agent capability: registry-guarded, transported, pre-execution abort check
- [x] `src/agent/workflow.ts`: `planToWorkflow()` + `runAgentWorkflow()` (plan → registry → agent↔orchestrator loop with state)
- [x] Native-shape translation generalized (any primary emitting `{type, function_calls}`; confidence gate only for real Needle)
- [x] `tests/agent/workflow.test.mjs` — 11 tests (transport, retries, cancel, registry, end-to-end, escape-proof)
- [ ] Bind `RequestHandlers.handleToolCall` as transport in `server.ts` (wiring, Milestone 8)
- [ ] `execute_workflow` MCP tool routes plans through `runAgentWorkflow` when agent enabled (Milestone 8)

## Milestone 6 — OpenRouter escalation policy [x] live, 44/44 green
- [x] `src/agent/escalation.ts` — `EscalationController`: budgeted one-way trip, triggers (low_confidence, refusal, malformed_output, provider_failure, repeated_tool_failure, unhealthy_primary), trail with timestamps
- [x] Single choke point `doEscalate()` — every switch recorded to history + state; budget-spent ends the run instead of looping
- [x] Repeated tool failures escalate mid-run (threshold `AGENT_REPEATED_FAILURE_THRESHOLD`, default 3; success resets)
- [x] `AGENT_ESCALATION_ENABLED=false` / `AGENT_MAX_ESCALATIONS` honored from env, overridable per-run
- [x] Run result carries `escalations[]` trail (reason, latency context, provider)
- [x] `tests/agent/escalation.test.mjs` — 8 tests (budget, threshold, no ping-pong, refusal mapping, disabled flag)

## Milestone 7 — Remove heuristic cognition (only after benchmark wins)
- [ ] Delete hardcoded fallbacks, generic-utility assumptions, fake reasoning
- [ ] Keep deterministic validation/safety/fast paths

## Benchmarks (`tests/agent/`) [x] suite live, 36/36 green
- [x] `npm run test:agent` — 31 mock-provider tests (routing, limits, escalation, saturation, malformed, recovery, state, workflow/transport/registry)
- [x] `npm run test:agent:live` (`NEEDLE_LIVE=1`) — 5 engine tests (health, call shape+confidence, planTask, serve multi-turn)
- [ ] Replanning / multi-observation / circular-dependency cases
- [ ] Heuristic vs Needle vs OpenRouter comparison harness (success, accuracy, latency, tokens, escalation rate)

## Env (target)
```
MITOSIS_AGENT_ENABLED=true / MITOSIS_AGENT_PROVIDER=needle
NEEDLE_ENGINE_PATH=assets/needle/needle
NEEDLE_MODEL_PATH=assets/needle/needle2.cact
NEEDLE_CONFIDENCE_THRESHOLD=0.6
NEEDLE_PORT=18080 / NEEDLE_USE_SERVER=true
AGENT_ESCALATION_ENABLED=true / AGENT_ESCALATION_PROVIDER=openrouter
AGENT_MAX_ESCALATIONS=1 / AGENT_REPEATED_FAILURE_THRESHOLD=3
OPENROUTER_API_KEY=... OPENROUTER_MODEL=...
```
