# Needle Agent Runtime — `feat/needle-agent-runtime`

Base: `main` @ `b22a843`. Main stays stable; all work here.

## Milestone 1 — Needle provider [x] engine bundled, serve mode live
- [x] `ModelProvider` seam (`src/agent/schemas.ts`)
- [x] `NeedleProvider` spawns bundled CLI (`src/agent/needle-provider.ts`)
- [x] `OpenRouterProvider` adapter, no behavior change
- [x] `scripts/fetch-needle.mjs` + `npm run needle:fetch` (engine + `needle2.cact`, gitignored)
- [x] Engine smoke-tested (0.84 one-shot, 0.77 via serve)
- [x] Persistent `--serve` mode (`NEEDLE_PORT`, `NEEDLE_USE_SERVER=false` → one-shot)
- [x] Tool-index persistence by default (`assets/needle/tools.idx`; engine fingerprints by schema+model); 7-tool catalogue live test proves retrieval path + grammar constraint
- [x] Tuned `.cact` status honest: CLI has no `--weights` flag → runs baked base model; `NEEDLE_MODEL_PATH` reported by health, reserved for a future libneedle path
- [x] Diagnostics via `chaining://agent/status` + MCP status exposure

## Milestone 2 — Agent decision protocol [x] verified live
- [x] Strict `AgentDecision` zod schema + validation
- [x] `agentRun()` loop — live: call→execute→escalate path confirmed
- [x] Native→decision translation (refusal→escalate, respond→complete, low-conf→escalate)
- [x] Escalation failure carries Needle observation count
- [ ] `tests/agent/` limits + malformed-output tests

## Milestone 3 — Replace `decomposeTask()` [x] planner + parallelization live
- [x] `planTask()` single-shot with REAL tools declared → whole chain in one `function_calls` turn → validated `AgentPlan`
- [x] Key finding: `define_step` pseudo-tool and meta "next step?" framing both refused; bare-task + real tools works
- [x] No confidence gate in planning (no side effects; multi-call chains calibrate low)
- [x] `parallelize()` — evidence-based dependsOn: step chains only on args referencing non-task values (placeholders, looked-up ids); task-grounded literals run parallel
- [x] Fallback chain: Needle → OpenRouter → honest throw (M7: no heuristic)
- [x] `llm_decompose_task` + `runAgentWorkflow` pass structured decls + guidance

## Loop reliability fixes (live findings)
- [x] Compact observations (was: full history JSON blob → confidence collapse)
- [x] Result-forward turns per Needle contract (feed raw result, not prose wrapper)
- [x] HTTP keep-alive fix (`Connection: close` + one retry; engine hung 2nd request)
- [x] Saturation guard: identical re-call → `complete` with last result
- [ ] Model variance across identical prompts (0.97 vs 0.005 conf) — needs benchmark + finetune; loop handles via escalation

## Milestone 4 — Sequential thinking → agent state [x] live, refined
- [x] `src/agent/state.ts` — `AgentStateManager`: sessions, typed events, bounded history + drop count, termination reasons, `tail()`, `stats()`, workflow association, `sharedAgentState()` singleton
- [x] `agentRun(state: {manager, sessionId?, workflowId?})` records decisions/calls/results/revisions/escalations/rejections/malformed + termination; absent = zero behavior change
- [x] `agentStep()` — one observe → decide (→ optionally execute) turn against shared state
- [x] `sequentialthinking` refined: agent-enabled → Needle-backed step (thought = observation, revision/branch mapped to state events, call_tool executed via orchestrator transport); legacy path when disabled; legacy response fields preserved
- [x] `translateNativeDecision()` / `parseDecision()` extracted and shared by loop + step
- [x] `tests/agent/step.test.mjs` — 7 tests; live handler test proves session continuity across thoughts
- [x] `sequentialthinking` inherits the agent time budget when fronting the agent

## Milestone 5 — Agentic workflow loop [x] live, 36/36 green
- [x] `MCPTransport` seam: `setTransport()` (e.g. `RequestHandlers.handleToolCall`); unset = legacy placeholder, zero behavior change
- [x] Real retry execution (`retryOnFailure` + `maxRetries` actually re-run; `retryCount` real)
- [x] Cancellation via `AbortSignal` (per-step checks, stops between batches, `cancelled` survives aggregation — fixed overwrite bug)
- [x] `executeTool()` agent capability: registry-guarded, transported, pre-execution abort check
- [x] `src/agent/workflow.ts`: `planToWorkflow()` + `runAgentWorkflow()` (plan → registry → agent↔orchestrator loop with state)
- [x] Native-shape translation generalized (any primary emitting `{type, function_calls}`; confidence gate only for real Needle)
- [x] `tests/agent/workflow.test.mjs` — 11 tests (transport, retries, cancel, registry, end-to-end, escape-proof)

## Milestone 8 — MCP surface [x] live, 68/68 green (1 skipped: openrouter arm)
- [x] Transport bound in `server.ts` to real `handleToolCall` with non-reentrancy guard (`workflow_orchestrator`, `agent_run` refused inside runs)
- [x] `agent_run` tool (auto-enabled with bundled engine), `workflow_status` + `workflow_cancel` (always listed)
- [x] `agent_run` honors its own budget over the 10s interactive tool timeout (capped 300s)
- [x] `analyze_with_sequential_thinking` Needle-backed (plan IS the analysis; canned templates only when agent off — no remote MCP involved, logic was local)
- [x] Bundled-first enablement via `isAgentEnabled()`: on when engine present unless `MITOSIS_AGENT_ENABLED=false`; no env needed
- [x] Runtime structure formalized in `workflow.ts` header (Needle → decision → state → executor → MCP → result → Needle)
- [x] Legacy notices on `sequentialthinking`, `llm_decompose_task`, `llm_suggest_route`; behavior untouched
- [x] `tests/agent/surface.test.mjs` + `diagnostics.test.mjs` — handler status/cancel/transport/opt-out, enablement logic, live `agent_run`/`sequentialthinking`/analysis
- [x] `stopServer()` SIGKILL fallback (no lingering engines)
- [x] Live-test policy: retry stochastic model assertions (≤3), accept escalation-shaped outcomes keyless

## Milestone 6 — OpenRouter escalation policy [x] live, 44/44 green
- [x] `src/agent/escalation.ts` — `EscalationController`: budgeted one-way trip, triggers (low_confidence, refusal, malformed_output, provider_failure, repeated_tool_failure, unhealthy_primary), trail with timestamps
- [x] Single choke point `doEscalate()` — every switch recorded to history + state; budget-spent ends the run instead of looping
- [x] Repeated tool failures escalate mid-run (threshold `AGENT_REPEATED_FAILURE_THRESHOLD`, default 3; success resets)
- [x] `AGENT_ESCALATION_ENABLED=false` / `AGENT_MAX_ESCALATIONS` honored from env, overridable per-run
- [x] Run result carries `escalations[]` trail (reason, latency context, provider)
- [x] `tests/agent/escalation.test.mjs` — 8 tests (budget, threshold, no ping-pong, refusal mapping, disabled flag)

## Milestone 7 — Remove heuristic cognition [x] done, 82/82 green (keyed)
- [x] Deleted `src/managers/sequential-thinking-manager.ts` (caller-supplied thought storage)
- [x] Deleted `src/integrations/sequential-integration.ts` (canned templates + Math.random "reasoning")
- [x] Deleted `planTask` hardcoded `analysis → utility → validation` fallback — throws honestly when Needle + OpenRouter both fail
- [x] Deleted dead `define_step` pseudo-tool path (proven refused by the model)
- [x] `LLMManager.decomposeTask` returns `{ok:false, error}` instead of fake subtasks
- [x] Handler drops `legacy_fallback` merge — `llm_decompose_task` returns Needle plan or honest error
- [x] Deleted `src/managers/brainstorming-manager.ts` (template ideas + random 6-10 feasibility/innovation/effort) — `brainstorming` is OpenRouter-backed or honest `{ok:false}` (Needle routes, it doesn't generate prose)
- [x] `generate_route_suggestions` + `llm_suggest_route` reimplemented as Needle-planned single routes; heuristic `generateRoutes` ranker disconnected (optimizer kept for deterministic validation/analysis of caller-supplied chains only)
- [x] `handleLLMTool` blanket guard → per-case guards (Needle-backed cases work without an LLM manager instance)
- [x] `sequentialthinking` + `analyze_with_sequential_thinking` are Needle-only paths now (no env gating, no legacy branches)
- [x] `chaining://sequential/state` rebacked on shared AgentState (URI preserved, content = live sessions)
- [x] Kept: deterministic validation/registry/retries/budgets/saturation/limits, `summarize` truncation, discovery fallback tools (connectivity, not cognition)
- [x] M7 evidence: heuristic 0/3 expected-tool hits BY CONSTRUCTION; Needle 3/3 (~2.5–7.5s); OpenRouter arm proven live against vault key

## Benchmarks (`tests/agent/`) [x] suite live, 82/82 green (keyed, 0 skipped) + 20-task battery
- [x] `npm run test:agent` — 68 mock-provider tests (incl. `parallelize` evidence rules)
- [x] `npm run test:agent:live` (`NEEDLE_LIVE=1`) — 12 engine tests (incl. keyed OpenRouter arm, 3-case comparison, handler `agent_run`, refined steps, Needle-backed analysis, 7-tool catalogue)
- [x] `bench:battery` (`scripts/bench-battery.mjs`, 20 tasks × 3 runs, live): 18/20 fully valid, mean recall 0.825, mean 1270ms/plan, parallel share 0.97
- [x] Known weak spots (honest): vague tasks refuse ("turn off all the lights", "check disk usage" 0/3); partial chains on 3 two-tool tasks (0.5 recall)

## Prompt guidance in agent context [x] live, planning 3/3 preserved
- [x] `src/agent/guidance.ts` — `buildGuidance()`: keyword hits + `expectedTools` overlap scoring, top-2 prompts, ≤600 chars, local only
- [x] Threaded as `guidance` into `planTask` (single-shot prompt), `agentRun` (turn-1 only), `agentStep` (first-step only), `runAgentWorkflow`
- [x] Handler resolves via real `PromptRegistry` for `agent_run`, `sequentialthinking`, `analyze_with_sequential_thinking`, `llm_decompose_task`
- [x] `tests/agent/guidance.test.mjs` — retrieval, empty case, overlap-only, caps

## Opencode config (minimal — needle + sequential thinking always on, bundled)
```json
{
  "hela-mitosis": {
    "type": "local",
    "enabled": true,
    "command": ["node", "/path/to/chaining-mcp/dist/index.js"],
    "environment": {
      "CHAINING_TOOL_TIMEOUT_MS": "10000",
      "MEMORY_FILE_PATH": "/path/to/chaining-mcp/data/memory.json",
      "AWESOME_COPILOT_ENABLED": "true",
      "RELIABILITY_MONITORING_ENABLED": "true",
      "GITHUB_TOKEN": "ghp_xxxx",
      "OPENROUTER_API_KEY": "sk-or-xxx"
    }
  }
}
```
Notes: no `MITOSIS_AGENT_ENABLED` / `NEEDLE_*` (auto-on when `assets/needle/needle` exists; fetch via `npm run needle:fetch`). `OPENROUTER_API_KEY` only feeds escalation (`AGENT_ESCALATION_ENABLED=false` to disable). `CHAINING_LLM_*` only matters for the standalone `llm_*` tools.

## Env reference (tuning only)
```
# Only needed to OPT OUT: MITOSIS_AGENT_ENABLED=false
NEEDLE_ENGINE_PATH=assets/needle/needle       # default; override per platform
NEEDLE_MODEL_PATH=assets/needle/needle2.cact
NEEDLE_CONFIDENCE_THRESHOLD=0.6
NEEDLE_PORT=18080 / NEEDLE_USE_SERVER=true
AGENT_ESCALATION_ENABLED=true / AGENT_ESCALATION_PROVIDER=openrouter
AGENT_MAX_ESCALATIONS=1 / AGENT_REPEATED_FAILURE_THRESHOLD=3
OPENROUTER_API_KEY=... OPENROUTER_MODEL=...
```
