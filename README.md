# Enterprise Chaining MCP Server (HeLa Mitosis)

> **Part of the [HeLa MCP Ecosystem](https://github.com/1999AZZAR/hela-mcp-ecosystem)** — this server is **HeLa Mitosis (`hela-mitosis`)**, the *Orchestrator* component of the HeLa cellular architecture.

A Model Context Protocol (MCP) server that orchestrates other MCP servers: discovers tools, plans execution with a **bundled local tool-calling model (Needle 2)**, executes through a registry-guarded workflow engine, records reasoning in an agent-state store, and escalates to OpenRouter only when the local model is not confident. Also ships time management, prompt/resource libraries, skills-catalog management, memory graph, monitoring, and security guidance.

---

## Agent Runtime (Needle 2, bundled) — how it actually works

![Blotcat sitting cross-legged, branching thought bubbles emerging from its head](assets/chaining-illustrations/03-sequential.jpg)

```
User
 ↓
Mitosis
 ├─ Needle 2 (bundled 45M tool-calling engine, auto-enabled when present)
 │    ↓ structured decision (JSON, grammar-constrained to real tools)
 ├─ state / observation (AgentState: observations, decisions, tool
 │    calls, results, revisions, branches, escalation, termination)
 │    ↓
 ├─ workflow executor (WorkflowOrchestrator: transport-bound, real
 │    retries, cancellation, registry guard, no self-recursion)
 │    ↓
 └─ MCP capabilities (tools + skills + prebuilt prompts)
      ↓ result
   Needle 2 → next decision (…until complete / escalate / limits)
```

**Sequential thinking is built in — there is no external sequential-thinking MCP.** `sequentialthinking`, `analyze_with_sequential_thinking`, and `agent_run` all resolve to this one loop on the MCP layer:

```
Needle 2 (local)
  │  refusal / low-confidence / malformed output / provider failure
  ▼
OpenRouter (escalation layer, auto-detected, budgeted one-way trip, recorded trail)
  │  also fails / unparseable / NO provider key configured
  ▼
the calling agent (last layer) — auto-detected handoff: when no OpenRouter /
OpenAI key is present, Mitosis skips the dead-end call and returns a structured
`handoff` outcome (`decision: escalate`, `handoff: true`, reason + AgentState
trail) so the user's agent takes over directly.
```

Escalation provider is **auto-detected** from the environment (`OPENROUTER_API_KEY`, else `OPENAI_API_KEY`; `AGENT_ESCALATION_ENABLED=false` disables). Responses expose `escalation: { configured, provider }` so the calling agent always knows whether a real backend exists.

### What this gives you (verified)

| Capability | Status |
|---|---|
| Real tool selection | Measured 3/3 expected-tool hits (heuristic baseline was 0/3 by construction); grammar prevents hallucinated tool names (proven with a 7-tool catalogue) |
| Offline autonomy | Fully local planning/deciding/executing in ~21–28MB RAM, 200–400 tok/s on CPU, no key required |
| Parallel plans | Evidence-based `dependsOn`: steps whose args are task-grounded run in parallel (20-task battery: parallel share 0.97) |
| Honest escalation | Confidence-gated, budgeted (`AGENT_MAX_ESCALATIONS`, default 1), one-way, with reasons + timestamps recorded |
| State you can read | `chaining://sequential/state` lists live sessions; `chaining://agent/status` reports readiness without spawning the engine and never exposes keys |
| Prompt + skill guidance | Top relevant prebuilt prompts (keyword + `expectedTools` overlap) and skill descriptions are injected into planning/turn-1 context |

### Honest limitations (read before relying on it)

- **Small model ceiling.** Needle 2 is a 45M *tool-calling* model, not a general reasoner. Multi-hop reasoning, open-ended prose, and creative writing are NOT its job — those are exactly when the escalation layer should fire. Planning is a router: it picks tools and fills args, it does not argue.
- **Stochastic variance.** Identical prompts can score 0.97 → 0.005 confidence across runs and occasionally refuse outright. Every mitigation (retry-tolerant planner, saturation guard, escalation budget, honest failures) exists because we hit this live. Plan for retries; never assume a deterministic answer.
- **Measured planning quality (20-task battery × 3 runs):** 18/20 fully valid, mean expected-tool recall 0.825, mean ~1.3s/plan. **Known weak phrasing:** vague commands refuse ("turn off all the lights", "check disk usage"); 3 two-tool tasks produced partial chains. Sharper phrasing ("dim the living room lights to 30") scores 1.0. Tool *descriptions* in discovery drive recall more than the model size does.
- **Session state is in-memory.** AgentState and workflows are lost on restart. The persistent `memory.db` knowledge graph is a separate system, not yet fused with agent sessions.
- **Tuned `.cact` models are not loadable yet.** The current CLI has no `--weights` flag, so `NEEDLE_MODEL_PATH` is reported by health checks and reserved for a future libneedle path. The bundled base model is what runs.
- **Skills are discoverable, retrievable, and recommended — not executed.** A skill is instructions (SKILL.md); running its scripts is the harness's job. `suggest_skill_chain` attaches deterministic per-step skill hints, labeled as such (the model doesn't fuse them).
- **`brainstorming` needs a generative model.** Without `OPENROUTER_API_KEY` it fails honestly — we removed template ideas with random scores rather than fake them.
- **OpenRouter escalation only works with a key — auto-detected.** Without `OPENROUTER_API_KEY`/`OPENAI_API_KEY`, Mitosis detects the absence and hands control to the calling agent (`handoff: true`) instead of attempting a doomed call.
- **Discovery connectivity fallbacks** add known tools for common server types when a server can't be reached — that's network resilience, not cognition.

---

## Prebuilt Prompts & Resource Sets

![Blotcat exploring a dark cave with a lantern, finding glowing server nodes](assets/chaining-illustrations/01-discovery.jpg)

**40 prompts + 12 resource sets**, all with bodies of 487–2,284 chars, zero stubs, covering development, debugging, orchestration, MCP-ecosystem workflows, monitoring, analytics, security, and compliance.

They're reachable four ways:
1. **Tools:** `get_prompt` / `search_prompts` / `get_resource_set` / `search_resource_sets`
2. **Resources:** `chaining://prompts`, `chaining://resources`, `chaining://prompts/overview`, `chaining://tool-chains`, `chaining://tool-chains/overview`
3. **Agent context:** task-relevant prompts (keyword + `expectedTools` overlap, top-2, ≤600 chars) are injected into planning and turn-1 agent context
4. **Skills catalog:** `list_skills` / `search_skills` / `get_skill` / `suggest_skill_chain` over the opencode AgentSkills layout

### Prebuilt Prompts

- **Development**: analyze-project-structure, feature-implementation, code-refactoring, security-audit, performance-optimization, debug-error-tracing, dependency-analysis, tool-chaining-basics, memory-knowledge-management, sequential-thinking-workflows, mcp-ecosystem-exploration, cross-server-data-flow, awesome-copilot-integration-workflow, time-sensitive-task-orchestration, multi-server-debugging-orchestration, intelligent-route-optimization, server-capability-mapping, dynamic-workflow-adaptation, knowledge-graph-enhanced-chaining, collaborative-development-orchestration, automated-quality-assurance, intelligent-resource-discovery, predictive-workflow-optimization, enterprise-integration-orchestration
- **Advanced chains**: comprehensive-project-assessment-chain, full-stack-feature-implementation-chain, production-debugging-orchestration, cross-server-data-pipeline-orchestration, ai-enhanced-development-workflow, enterprise-scale-architecture-orchestration
- **Monitoring & Analytics**: system-health-monitoring, performance-bottleneck-analysis, tool-usage-analytics, workflow-reliability-assessment, cost-optimization-analysis
- **Security & Compliance**: security-vulnerability-assessment, compliance-audit-workflow, data-privacy-protection, access-control-audit, incident-response-planning

### Resource Sets

development-starter-kit, debugging-toolbox, performance-optimization-kit, tool-chaining-mastery, awesome-copilot-collections, observability-suite, analytics-toolkit, reliability-engineering-kit, security-assessment-suite, compliance-management-suite, privacy-protection-framework, incident-response-playbook

---

## Installation

```bash
npm install            # automatically fetches the bundled Needle 2 engine if missing
npm run build          # prebuild also ensures the engine; tsc compiles
npm run needle:fetch   # manual re-fetch / platform override (only needed if auto-fetch failed)
```

**Existing users:** `git pull` then `npm install` (or `npm run build`) — the engine is fetched automatically; no manual step. The fetch is non-fatal if offline (warns, install/build still complete; retry later with `npm run needle:fetch`).

### Configuration (minimal opencode example)

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

**Note:** Replace `/path/to/chaining-mcp`, run `npm run needle:fetch` once. No `MITOSIS_AGENT_ENABLED` / `NEEDLE_*` / `SEQUENTIAL_THINKING_*` needed — the agent auto-enables when the bundled engine is present (`MITOSIS_AGENT_ENABLED=false` opts out).

**Important:**
- `OPENROUTER_API_KEY`: optional — feeds escalation and `brainstorming` only; the agent runs fully offline without it.
- `GITHUB_TOKEN`: optional — live Awesome Copilot syncing; local catalog fallback otherwise.

---

## Tools (29, all enabled by default)

Core: `list_mcp_servers`, `analyze_tools`, `generate_route_suggestions` (Needle-planned), `analyze_with_sequential_thinking` (Needle plan IS the analysis), `get_tool_chain_analysis`, `sequentialthinking` (Needle-backed step over AgentState).
Awesome Copilot: `search_instructions`, `load_instruction`.
Agent runtime: `agent_run`, `workflow_status`, `workflow_cancel`.
Thinking/generative: `brainstorming` (OpenRouter-backed, key required), `workflow_orchestrator`.
Time: `get_current_time`, `convert_time`. Prompt/resource: `get_prompt`, `search_prompts`, `get_resource_set`, `search_resource_sets`. Validation: `validate_tool_chain`, `analyze_tool_chain_performance`. Skills: `list_skills`, `search_skills`, `get_skill`, `suggest_skill_chain`.
LLM: `llm_query`, `llm_decompose_task` (Needle-planned), `llm_suggest_route` (Needle-planned), `llm_summarize` — listed by default (`CHAINING_LLM_ENABLED` defaults true); the keyless `llm_*` tools fail honestly or fall back to truncation, never fake answers. Set `CHAINING_LLM_ENABLED=false` to hide them.

## Resources (18)

`chaining://servers`, `tools`, `analysis`, `prompts`, `resources`, `prompts/overview`, `awesome-copilot/collections`, `awesome-copilot/instructions`, `awesome-copilot/status`, `sequential/state`, `workflows/status`, `tool-chains`, `tool-chains/overview`, `health`, `cache/stats`, `llm/status`, `llm/usage`, `agent/status`.

---

## Environment Variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `CHAINING_TOOL_TIMEOUT_MS` | `10000` | Interactive tool timeout; model-backed tools (`agent_run`, `brainstorming`, `analyze_with_sequential_thinking`, `suggest_skill_chain`, agent-fronted `sequentialthinking`) use their own budget instead (cap 300s) |
| `MITOSIS_AGENT_ENABLED` | *auto* | On when `assets/needle/needle` exists; `false` opts out |
| `NEEDLE_ENGINE_PATH` | `assets/needle/needle` | Engine location override |
| `NEEDLE_MODEL_PATH` | `assets/needle/needle2.cact` | Reserved (CLI runs baked base; reported by health, not loadable yet) |
| `NEEDLE_TOOL_INDEX_PATH` | `assets/needle/tools.idx` | Persisted tool-embedding cache (engine fingerprints by schema+model) |
| `NEEDLE_CONFIDENCE_THRESHOLD` | `0.6` | Act at/above, escalate below |
| `NEEDLE_PORT` / `NEEDLE_USE_SERVER` | `18080` / `true` | Serve-mode port + toggle (`false` = one-shot spawn) |
| `MITOSIS_SKILLS_DIRS` | `~/.config/opencode/skills` | Colon-separated skills catalog dirs |
| `AGENT_ESCALATION_ENABLED` | `true` | `false` disables OpenRouter escalation |
| `AGENT_MAX_ESCALATIONS` | `1` | One-way escalation budget per run |
| `AGENT_REPEATED_FAILURE_THRESHOLD` | `3` | Consecutive tool errors that force escalation |
| `OPENROUTER_API_KEY` | *optional* | Escalation + brainstorming key |
| `CHAINING_LLM_*` | … | OpenRouter endpoint/model/max-tokens for the `llm_*` tools (`CHAINING_LLM_ENABLED` defaults `true`; set `false` to hide them) |
| `GITHUB_TOKEN` | *optional* | Live Awesome Copilot syncing |
| `MCP_DISCOVERY_CONFIG_PATHS` / `MCP_SERVERS` | *auto* | Discovery config |
| `MEMORY_FILE_PATH` | `./data/memory.json` | Persistent cache file |

### Zero-Key & Offline

Fully offline, zero-key by default: the Needle agent plans, decides, executes, and completes locally. Escalation paths record a budgeted failure without a key; `brainstorming` fails honestly. No model env vars required.

---

## Development & Verification (honest layer-by-layer)

```bash
# Pre-commit gate (installed): tsc build + deterministic mock suite (~95s) on every commit
pre-commit run --all-files          # or just commit; the hook runs it

# Layer 1 — mock suite (no engine, deterministic): 78 tests
node scripts/test-agent.mjs

# Layer 2 — live suite (bundled engine + optional key): 91 tests
NEEDLE_LIVE=1 node scripts/test-agent.mjs

# Layer 3 — planning battery (live, 20 tasks × 3 runs): validity/recall/latency/parallel
NEEDLE_LIVE=1 node scripts/bench-battery.mjs

# Layer 4 — e2e against the SHIPPED dist/ over real MCP stdio (initialize→tools→calls→resources)
OPENROUTER_API_KEY=sk-or-xxx CHAINING_LLM_ENABLED=true node scripts/test-e2e.mjs
```

What each layer **does not** prove: the mock suite doesn't touch the engine; the live suite needs the engine fetched; the battery is n=3 (variance bounds want n=20); the e2e needs a network + key for the escalation branch and exercises the shipped build (re-run after every `npm run build`).

### Project Structure

```
src/
├── index.ts / server.ts             # MCP stdio entry + orchestrator (transport binding, non-reentrancy guard)
├── core/                            # discovery (TTL cache, connectivity fallbacks), optimizer (deterministic validation only)
├── managers/                        # workflow-orchestrator (transport seam, real retries, cancel), time, memory, reliability, llm
├── agent/                           # agent.ts (loop/step/planner/decision), needle-provider, openrouter-provider,
│                                    # state, escalation, workflow bridge, guidance, diagnostics
├── skills/                          # skill-discovery (frontmatter, search, TTL cache, read-only)
├── integrations/                    # awesome-copilot (local catalog)
├── prompts/                         # 40 prompts + 12 resource sets + registry
├── handlers/                        # request-handlers (dispatcher, per-tool timeouts, honest failures)
├── tools/                           # tool schemas (core, agent, skills, time, prompts, validation, llm)
└── resources/                       # 18 chaining:// resources
```

---

## Integration with Other MCP Servers

Discovery scans your MCP config files, connects to real servers, and executes their tools through the workflow transport.

![Blotcat drawing a red continuous route map on a wall to connect scattered tools](assets/chaining-illustrations/02-route.jpg)
![Blotcat acting as a factory manager, operating conveyor belts for data handoffs](assets/chaining-illustrations/04-workflow.jpg)

**Sequential thinking needs no external server** — the bundled Needle agent provides it. `awesome-copilot` is an optional dotnet-based server (local catalog used when the binary is absent). Project-Guardian complements this server: Mitosis orchestrates, Project-Guardian owns the database. No heuristic "reasoning" layer exists: every plan, route, decomposition, and thought is model-grounded (Needle → OpenRouter) or a deterministic runtime rule.

## License

MIT License — see LICENSE file for details.

## Contributing

1. Fork. 2. Branch. 3. Change. 4. Add/update tests (mock + live + battery + e2e as appropriate). 5. `pre-commit run --all-files` must pass. 6. PR.
