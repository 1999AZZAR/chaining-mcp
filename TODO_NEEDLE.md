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

## Milestone 4 — Sequential thinking → agent state
- [ ] Keep state machinery; add `AgentState` (observations, decisions, tool calls/results, revisions, branches, escalation, termination)
- [ ] Bounded history + session/workflow association
- [ ] Legacy MCP tools stay as compat shims

## Milestone 5 — Agentic workflow loop
- [ ] `WorkflowOrchestrator.executeTool()` for agent runtime
- [ ] Real MCP transport in `callMCPServerTool()` (currently placeholder)
- [ ] Real retries; cancellation into active calls; registry-guarded tool names

## Milestone 6 — OpenRouter escalation policy
- [ ] Explicit triggers (low confidence, complexity, repeated failure, malformed output, user request)
- [ ] Escalation budget + loop prevention + reason/latency/token logging

## Milestone 7 — Remove heuristic cognition (only after benchmark wins)
- [ ] Delete hardcoded fallbacks, generic-utility assumptions, fake reasoning
- [ ] Keep deterministic validation/safety/fast paths

## Benchmarks (`tests/agent/`)
- [ ] routing, decomposition, tool-selection, argument-generation, replanning, escalation, failure-recovery, limits
- [ ] Compare heuristic vs Needle vs OpenRouter vs Needle→OpenRouter (success, accuracy, invalid calls, latency, mem/CPU, tokens, escalation rate)

## Env (target)
```
MITOSIS_AGENT_ENABLED=true / MITOSIS_AGENT_PROVIDER=needle
NEEDLE_MODEL_PATH=... NEEDLE_MAX_TOKENS=... NEEDLE_TIMEOUT_MS=...
AGENT_ESCALATION_ENABLED=true / AGENT_ESCALATION_PROVIDER=openrouter
OPENROUTER_API_KEY=... OPENROUTER_MODEL=...
```
