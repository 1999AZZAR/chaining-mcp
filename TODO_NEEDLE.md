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

## Milestone 3 — Replace `decomposeTask()` [x] planner fixed live
- [x] `planTask()` single-shot with REAL tools declared → whole chain in one `function_calls` turn → validated `AgentPlan`
- [x] Key finding: `define_step` pseudo-tool and meta "next step?" framing both refused; bare-task + real tools works
- [x] No confidence gate in planning (no side effects; multi-call chains calibrate low)
- [x] Fallback chain: Needle → OpenRouter → legacy heuristic
- [x] `llm_decompose_task` + `runAgentWorkflow` pass structured decls
- [ ] Parallelizable steps (currently linear dependsOn chain)

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

## Milestone 8 — MCP surface [x] live, 48/48 green
- [x] Transport bound in `server.ts` to real `handleToolCall` with non-reentrancy guard (`workflow_orchestrator`, `agent_run` refused inside runs)
- [x] `agent_run` tool (gated on `MITOSIS_AGENT_ENABLED`), `workflow_status` + `workflow_cancel` (always listed)
- [x] `agent_run` honors its own budget over the 10s interactive tool timeout (capped 300s)
- [x] Legacy notices on `sequentialthinking`, `llm_decompose_task`, `llm_suggest_route`; behavior untouched
- [x] `tests/agent/surface.test.mjs` — handler-level status/cancel/transport/disabled + live `agent_run`
- [x] `stopServer()` SIGKILL fallback (no lingering engines)
- [x] Live-test policy: retry stochastic model assertions (≤3), accept escalation-shaped outcomes keyless

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
- [x] M7 evidence (`tests/agent/compare.test.mjs`): heuristic 0/3 expected-tool hits BY CONSTRUCTION (emits categories only); Needle 3/3 with real tools (~1.5–4.5s first-try). OpenRouter arm skipped keyless.
- [ ] Still needs: OpenRouter arm with key + repeated runs for variance bounds before deleting anything

## Benchmarks (`tests/agent/`) [x] suite live, 55/55 green (1 skipped: openrouter arm, keyless)
- [x] `npm run test:agent` — 47 mock-provider tests (routing, limits, escalation, saturation, malformed, recovery, state, workflow/transport/registry, surface, replan, parallel, circular, failFast)
- [x] `npm run test:agent:live` (`NEEDLE_LIVE=1`) — 8 engine tests (health, call shape+confidence, planTask, serve multi-turn, handler `agent_run`, 3-case comparison)
- [x] `chaining://agent/status` diagnostics resource (spawn-free, no keys)
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
