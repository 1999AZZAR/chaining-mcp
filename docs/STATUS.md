# Chaining MCP Server — Tool & Component Status

> **Last Updated:** 2026-08-29
> **Status:** ✅ Stable & Fully Verified (22/22 Tools, 17/17 Resources Passing — Smoke Test Duration ~4.2s)

---

## 🛠️ Tool Status Matrix

| Category | Tool Name | Status | Typical Latency | Notes |
|----------|-----------|--------|-----------------|-------|
| **Core** | `list_mcp_servers` | ✅ Active | < 2ms | Returns cached servers with 60s TTL |
| **Core** | `analyze_tools` | ✅ Active | < 2ms | Scans and categorizes tools across servers |
| **Core** | `generate_route_suggestions` | ✅ Active | < 30ms | Heuristic & pattern matching with dynamic fallbacks |
| **Core** | `analyze_with_sequential_thinking` | ✅ Active | < 5ms | Fast structured analysis with bounded thought tree |
| **Core** | `get_tool_chain_analysis` | ✅ Active | < 2ms | Computes tool distribution and recommendations |
| **Core** | `sequentialthinking` | ✅ Active | < 2ms | Step-by-step reasoning with revision tracking |
| **Awesome Copilot** | `search_instructions` | ✅ Active | < 2ms | Local instruction lookup with degraded mode support |
| **Awesome Copilot** | `load_instruction` | ✅ Active | < 2ms | Loads local or remote MCP guidelines & prompt modes |
| **Thinking** | `brainstorming` | ✅ Active | < 2ms | Multi-approach idea generator (creative/analytical) |
| **Thinking** | `workflow_orchestrator` | ✅ Active | < 20ms | Bounded step runner with error boundaries |
| **Time** | `get_current_time` | ✅ Active | < 5ms | Accurate timezone query with DST calculation |
| **Time** | `convert_time` | ✅ Active | < 2ms | Cross-timezone time converter |
| **Prompts** | `get_prompt` | ✅ Active | < 2ms | Case-insensitive ID/name prompt retriever |
| **Prompts** | `search_prompts` | ✅ Active | < 2ms | Flexible query search across 40+ prebuilt prompts |
| **Resources** | `get_resource_set` | ✅ Active | < 2ms | Curated toolkits & workflow resources |
| **Resources** | `search_resource_sets` | ✅ Active | < 2ms | Resource set search by keyword & complexity |
| **Validation** | `validate_tool_chain` | ✅ Active | < 2ms | Auto-normalizes step IDs & validates dependency cycles |
| **Validation** | `analyze_tool_chain_performance` | ✅ Active | < 2ms | Computes latency bottlenecks and parallel potential |
| **LLM Engine** | `llm_query` | ✅ Active | < 2.5s | Direct prompt execution via OpenRouter API |
| **LLM Engine** | `llm_decompose_task` | ✅ Active | < 2.5s | Structured subtask extraction & tool categorization |
| **LLM Engine** | `llm_suggest_route` | ✅ Active | < 2.5s | AI-ranked route suggestion with instant fallback |
| **LLM Engine** | `llm_summarize` | ✅ Active | < 2.5s | High-density tool & output summarization |

---

## 📦 Resource Endpoints

| URI | Description | Status |
|-----|-------------|--------|
| `chaining://servers` | Discovered MCP servers list | ✅ 200 OK |
| `chaining://tools` | Discovered tools catalog | ✅ 200 OK |
| `chaining://analysis` | Tool and server summary metrics | ✅ 200 OK |
| `chaining://prompts` | All 40+ prebuilt prompts | ✅ 200 OK |
| `chaining://resources` | All curated resource sets | ✅ 200 OK |
| `chaining://prompts/overview` | Categorized prompt overview | ✅ 200 OK |
| `chaining://awesome-copilot/collections` | Curated collections metadata | ✅ 200 OK |
| `chaining://awesome-copilot/instructions` | Available instruction guides | ✅ 200 OK |
| `chaining://awesome-copilot/status` | Copilot integration health | ✅ 200 OK |
| `chaining://sequential/state` | Active thinking session status | ✅ 200 OK |
| `chaining://workflows/status` | Active workflow execution state | ✅ 200 OK |
| `chaining://tool-chains` | Tool chaining prompts & sets | ✅ 200 OK |
| `chaining://tool-chains/overview` | Chaining capabilities overview | ✅ 200 OK |
| `chaining://health` | Live server health & uptime | ✅ 200 OK |
| `chaining://cache/stats` | Discovery cache hit/miss stats | ✅ 200 OK |
| `chaining://llm/status` | Internal LLM engine state & model config | ✅ 200 OK |
| `chaining://llm/usage` | Session token counts & API call metrics | ✅ 200 OK |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAINING_TOOL_TIMEOUT_MS` | `10000` | Hard timeout (ms) for any tool execution |
| `CHAINING_LLM_ENABLED` | `false` | Enable built-in OpenRouter LLM intelligence features |
| `OPENROUTER_API_KEY` | *optional* | API Key for OpenRouter (`sk-or-v1-...`) |
| `CHAINING_LLM_MODEL` | `openrouter/free` | Primary model identifier (auto-falls back to `openrouter/auto`) |
| `CHAINING_LLM_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter or OpenAI-compatible endpoint URL |
| `CHAINING_LLM_MAX_TOKENS` | `1024` | Maximum tokens per internal generation request |
| `CHAINING_LLM_TIMEOUT_MS` | `4000` | AbortController timeout for LLM network requests |
| `GITHUB_TOKEN` | *optional* | Personal access token for remote GitHub instruction syncing |
| `DISABLE_THOUGHT_LOGGING` | `false` | When true, suppresses terminal thought rendering in sequential thinking |
| `MCP_DISCOVERY_CONFIG_PATHS` | *auto* | JSON array of paths to custom MCP config files |
| `MCP_SERVERS` | *none* | Direct JSON definition of MCP servers |
| `MEMORY_FILE_PATH` | `./data/memory.json` | Path to persistent cache file |

---

## 🛡️ Zero-Key & Offline Standalone Operation

The server is engineered to operate 100% autonomously without any API keys configured:

- **No `OPENROUTER_API_KEY`**: LLM tools gracefully and instantly degrade to local heuristic planning (`llm_suggest_route` returns heuristic routing in <30ms, `llm_decompose_task` returns structured subtasks in <1ms, `llm_summarize` uses local text bounds).
- **No `GITHUB_TOKEN`**: Awesome Copilot tools operate completely offline using the built-in local catalog.
- **Zero Process Hangs**: All tools have deterministic bounded timeouts with structured error and fallback responses.
