# Enterprise Chaining MCP Server


> **Part of the [HeLa MCP Ecosystem](https://github.com/1999AZZAR/hela-mcp-ecosystem)** — This server is **HeLa Mitosis (`hela-mitosis`)** — the *Orchestrator* component of the HeLa cellular architecture. See the [ecosystem docs](https://github.com/1999AZZAR/hela-mcp-ecosystem) for profiles, workflows, and multi-client setup.

A refined and unified Model Context Protocol (MCP) server that combines intelligent tool chaining, route optimization, time management, development guidance, monitoring, analytics, security, and compliance capabilities. This server discovers available MCP servers on your system, analyzes their tools, validates tool chains, and provides a complete enterprise-grade toolkit for complex task execution with real awesome-copilot MCP server integration.

## Agent Runtime (Needle 2, bundled)

Mitosis runs a local agent — no model env vars required:

```
User
 ↓
Mitosis
 ├─ Needle 2 (bundled engine, auto-enabled when present)
 │    ↓ structured decision
 ├─ state / observation (AgentState: observations, decisions,
 │    tool calls, results, revisions, branches)
 │    ↓
 ├─ workflow executor (WorkflowOrchestrator: registry-guarded,
 │    transported, retried, cancellable)
 │    ↓
 └─ MCP capabilities
      ↓ result
   Needle 2 → next decision (…until complete / escalate / limits)
```

- **Bundled engine**: fetch once with `npm run needle:fetch` (downloads the ~15MB Needle 2 engine + weights from `Cactus-Compute/needle2` into gitignored `assets/needle/`). The runtime auto-enables when the engine is present; `MITOSIS_AGENT_ENABLED=false` opts out.
- **Agent-first tools**: `agent_run` (full plan → execute → observe loop), `sequentialthinking` (one Needle-backed observe → decide → execute step over shared `AgentState`), `analyze_with_sequential_thinking` (the validated plan IS the analysis), plus `workflow_status` / `workflow_cancel`.
- **Prompt guidance in context**: task-relevant prebuilt prompts (keyword + `expectedTools` overlap, top-2, ≤600 chars, local only) are injected into planning and turn-1 context — the 42-prompt registry now steers the agent, not just human callers.
- **Escalation, not fallback**: OpenRouter (`OPENROUTER_API_KEY`) is used only on low confidence, refusal, malformed output, provider failure, or repeated tool failures — budgeted (`AGENT_MAX_ESCALATIONS`, default 1) with a recorded trail. Without a key the agent still runs fully offline.
- **Diagnostics**: `chaining://agent/status` reports readiness without spawning the engine and never exposes keys.
- **Verified**: `node scripts/test-agent.mjs` (mock suite) and `NEEDLE_LIVE=1 node scripts/test-agent.mjs` (live engine suite) — see [Testing](#building--testing).

## Table of Contents

- [Features](#features)
  - [Core Chaining Capabilities](#core-chaining-capabilities)
  - [Awesome Copilot Integration](#awesome-copilot-integration)
  - [Advanced Thinking Capabilities](#advanced-thinking-capabilities)
  - [Time Management](#time-management)
  - [Enterprise Capabilities](#enterprise-capabilities)
  - [Technical Features](#technical-features)
- [Prebuilt Prompts & Resource Sets](#prebuilt-prompts--resource-sets)
  - [Prebuilt Prompts](#prebuilt-prompts)
  - [Resource Sets](#resource-sets)
  - [Tool Chain Verification Examples](#tool-chain-verification-examples)
  - [Benefits for Models](#benefits-for-models)
- [Installation](#installation)
- [Available Tools](#available-tools)
- [Available Resources](#available-resources)
- [Usage Examples](#usage-examples)
  - [Basic Server Discovery](#basic-server-discovery)
  - [Tool Analysis](#tool-analysis)
  - [Route Generation](#route-generation)
  - [Sequential Thinking Analysis](#sequential-thinking-analysis)
  - [Awesome Copilot Integration](#awesome-copilot-integration-1)
  - [Sequential Thinking](#sequential-thinking)
  - [Brainstorming](#brainstorming)
  - [Workflow Orchestration](#workflow-orchestration)
  - [Time Management](#time-management-1)
  - [Prebuilt Prompts & Resources](#prebuilt-prompts--resources)
  - [Accessing Resources](#accessing-resources)
- [Environment Variables](#environment-variables)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Building](#building)
  - [Testing](#testing)
- [Integration with Other MCP Servers](#integration-with-other-mcp-servers)
  - [Awesome Copilot Integration](#awesome-copilot-integration-2)
  - [Project-Guardian Integration](#project-guardian-integration)
- [License](#license)
- [Contributing](#contributing)
- [Support](#support)

## Features

### Core Chaining Capabilities

![Blotcat exploring a dark cave with a lantern, finding glowing server nodes](assets/chaining-illustrations/01-discovery.jpg)

- **Smart Server Discovery**: Automatically discovers MCP servers from `~/.cursor/mcp.json` and other configuration locations
- **Tool Analysis**: Analyzes available tools and their capabilities
- **Route Optimization**: Generates intelligent suggestions for tool chaining based on optimization criteria
- **Sequential Thinking Integration**: Thinking is handled locally by the bundled Needle 2 agent — no external sequential-thinking MCP required
- **Tool Chain Validation**: Validates tool chains for correctness, dependencies, and security issues
- **Performance Analysis**: Analyzes tool chain performance with optimization recommendations

### Awesome Copilot Integration

- **Real MCP Server Integration**: Direct communication with the official awesome-copilot MCP server
- **GitHub API Access**: Seamless access to GitHub-hosted development resources and instructions
- **Token-Based Authentication**: Secure access using GitHub Personal Access Tokens
- **Live Data**: Always up-to-date content from the awesome-copilot repository

### Advanced Thinking Capabilities

- **Needle Agent Runtime**: Every thinking tool is backed by the bundled Needle 2 model — no remote sequential-thinking MCP, no canned template thoughts
- **Sequential Thinking**: One observe → decide → execute agent step per call, recorded in shared `AgentState`; pass `sessionId` to continue a session
- **Thought Branching**: Revisions and branch markers map to first-class state events
- **Context Preservation**: Bounded per-session history (observations, decisions, tool calls/results) feeds each turn
- **Brainstorming**: Generate creative ideas using multiple approaches (creative, analytical, practical, innovative)
- **Idea Evaluation**: Automatic evaluation and prioritization of generated ideas
- **Workflow Orchestration**: Execute complex multi-server workflows with dependency management

### Time Management

- **Timezone Support**: Get current time in any IANA timezone
- **Time Conversion**: Convert times between different timezones
- **DST Handling**: Automatic daylight saving time detection

### Built-in LLM Intelligence Engine

- **Multi-Provider Support**: Built-in native client supporting OpenRouter and OpenAI-compatible endpoints
- **Escalation Backend**: OpenRouter (`openrouter/free` with auto-fallback to `openrouter/auto`) is invoked only when the local Needle agent escalates — low confidence, refusal, malformed output, provider failure, repeated tool failures
- **Zero Host Token Waste**: Offloads task decomposition, route ranking, and summarization to fast sub-models
- **Task Decomposition**: `llm_decompose_task` routes via the Needle planner first, then OpenRouter, then a deterministic fallback
- **High-Density Summarization**: Summarizes lengthy command outputs and logs without polluting the main agent's context window
- **Offline-First**: Without `OPENROUTER_API_KEY` the agent still runs fully on the bundled engine

### Enterprise Capabilities

- **Monitoring & Analytics**: System health monitoring, performance bottleneck analysis, tool usage analytics
- **Security & Compliance**: Vulnerability assessment, compliance audit workflows, data privacy protection
- **Tool Chain Verification**: Validate tool chains for correctness, dependencies, and security issues
- **Performance Optimization**: Analyze and optimize tool chain performance with actionable recommendations

### Technical Features

- **Comprehensive Validation**: Uses Zod schemas for robust data validation
- **Production Ready**: Clean project structure with proper `.gitignore` and build system
- **Unified Interface**: Single server providing all functionality
- **In-Memory Caching with TTL**: 60s TTL for server and tool discovery with bounded directory traversal
- **Per-Tool Timeout Safeguards**: 10s default execution timeout preventing process hangs
- **Enhanced Components**: Refined implementations of agent runtime and time management
- **Robust Error Handling**: Improved validation and error handling across all components
- **Enhanced Time Management**: Better timezone handling with proper DST detection
- **Agent-Backed Sequential Thinking**: Every thought is a Needle observe → decide → execute step over shared state
- **Awesome Copilot Integration**: Direct access to curated development collections and instructions
- **42 Prompts & 12 Resource Sets**: Comprehensive collection covering development, orchestration, MCP ecosystem workflows, monitoring, analytics, security, and compliance guidance
- **Intelligent Tool Guidance**: Structured guidance to help models effectively use available toolsets

## Prebuilt Prompts & Resource Sets

The chaining MCP server now includes a comprehensive collection of **42 prebuilt prompts and 11 resource sets** designed to help models effectively use the available toolsets for development, debugging, orchestration, monitoring, analytics, security, and compliance workflows. The collection now includes extensive **tool-chaining resources** with ready-made chains for common development scenarios, plus enterprise-grade monitoring and security resources.

The prompts are organized into specialized categories including MCP ecosystem exploration, cross-server orchestration, time-sensitive operations, intelligent routing, collaborative development, and **advanced tool chaining**.

**Tool Chaining Resources:**

- **5 specialized resource sets** for tool chaining covering project analysis, implementation, debugging, cross-server orchestration, and CI/CD
- **6 advanced tool-chaining prompts** for complex workflows and enterprise-scale orchestration
- **Comprehensive chain templates** with step-by-step execution guides
- **Cross-server workflow patterns** leveraging multiple MCP servers
- **Production-ready orchestration** chains for enterprise environments

**Enterprise Resources:**

- **5 monitoring & analytics prompts** for system health, performance analysis, and optimization
- **5 security & compliance prompts** for vulnerability assessment, audit workflows, and incident response
- **Enterprise-grade resource sets** for observability, reliability, security assessment, and compliance management

### Prebuilt Prompts

Prebuilt prompts provide structured guidance for specific development tasks:

- **Development Prompts**: Project analysis, feature implementation, code refactoring
- **Debugging Prompts**: Error tracing, performance optimization, security auditing, multi-server debugging
- **Analysis Prompts**: Dependency analysis, tool chaining basics, capability mapping
- **MCP Ecosystem**: Server discovery, cross-server orchestration, intelligent routing
- **Orchestration**: Time-sensitive tasks, dynamic workflows, enterprise integration
- **Integration**: Awesome Copilot workflows, knowledge graph enhanced chaining
- **Collaboration**: Team development orchestration, quality assurance automation
- **Optimization**: Predictive workflows, intelligent resource discovery
- **Sequential Thinking**: Complex problem-solving and thought processing workflows
- **Monitoring & Analytics**: System health monitoring, performance bottleneck analysis, tool usage analytics, workflow reliability assessment, cost optimization
- **Security & Compliance**: Vulnerability assessment, compliance audit workflows, data privacy protection, access control audit, incident response planning

Each prompt includes:

- Clear task description and objectives
- Step-by-step guidance
- Expected tools to use
- Complexity level (low/medium/high)
- Relevant tags for easy discovery

### Resource Sets

Resource sets are curated collections of prompts, workflows, templates, and examples for specific scenarios:

- **Development Starter Kit**: Essential resources for new development tasks
- **Debugging Toolbox**: Comprehensive debugging techniques and workflows
- **Performance Optimization Kit**: Tools for performance analysis and improvement
- **Tool Chaining Mastery**: Advanced techniques for complex tool orchestration
- **Awesome Copilot Collections**: Curated collections of development resources
- **Observability Suite**: Comprehensive monitoring and observability resources for MCP ecosystems
- **Analytics Toolkit**: Advanced analytics tools and resources for MCP ecosystem optimization
- **Reliability Engineering Kit**: Resources for building and maintaining reliable MCP server ecosystems
- **Security Assessment Suite**: Comprehensive security assessment and vulnerability management resources
- **Compliance Management Suite**: Resources for managing regulatory compliance and governance
- **Privacy Protection Framework**: Resources for implementing and maintaining data privacy protections
- **Incident Response Playbook**: Comprehensive incident response resources and procedures

Each resource set contains:

- Multiple resources (prompts, workflows, templates, examples)
- Complexity rating
- Category classification
- Descriptive tags

### Tool Chain Verification Examples

#### Tool Chain Validation

```javascript
// Validate a tool chain for correctness and security
const validation = await mcpClient.callTool('validate_tool_chain', {
  toolChain: [
    {
      serverName: 'filesystem-mcp',
      toolName: 'read_file',
      parameters: { path: 'config.json' }
    },
    {
      serverName: 'filesystem-mcp',
      toolName: 'search_replace',
      parameters: { path: 'config.json', old_string: '"debug": false', new_string: '"debug": true' },
      dependsOn: ['read_file']
    }
  ],
  checkCircularDependencies: true,
  checkToolAvailability: true,
  checkParameterCompatibility: true
});
console.log(validation);
```

#### Performance Analysis

```javascript
// Analyze tool chain performance and get optimization suggestions
const analysis = await mcpClient.callTool('analyze_tool_chain_performance', {
  toolChain: [
    {
      serverName: 'filesystem-mcp',
      toolName: 'list_dir',
      parameters: { path: 'src' }
    },
    {
      serverName: 'grep-mcp',
      toolName: 'grep',
      parameters: { pattern: 'TODO|FIXME', path: 'src' },
      dependsOn: ['list_dir']
    }
  ],
  includeExecutionMetrics: true,
  includeComplexityAnalysis: true,
  includeOptimizationSuggestions: true
});
console.log(analysis);
```

#### Monitoring & Analytics Prompts

```javascript
// Use the system health monitoring prompt
const healthPrompt = await mcpClient.callTool('get_prompt', {
  id: 'system-health-monitoring'
});

// Use the performance bottleneck analysis prompt
const perfPrompt = await mcpClient.callTool('get_prompt', {
  id: 'performance-bottleneck-analysis'
});
```

#### Security & Compliance Prompts

```javascript
// Use the security vulnerability assessment prompt
const securityPrompt = await mcpClient.callTool('get_prompt', {
  id: 'security-vulnerability-assessment'
});

// Use the compliance audit workflow prompt
const compliancePrompt = await mcpClient.callTool('get_prompt', {
  id: 'compliance-audit-workflow'
});
```

### Benefits for Models

These prebuilt prompts and resource sets help models:

1. **Understand Tool Capabilities**: Learn how to effectively combine and use available tools
2. **Follow Best Practices**: Apply proven workflows and techniques
3. **Handle Complex Tasks**: Break down complex problems into manageable steps
4. **Maintain Consistency**: Use standardized approaches across similar tasks
5. **Accelerate Learning**: Access expert guidance and best practices from awesome-copilot

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

### Configuration

Add the chaining MCP server to your MCP client configuration (`~/.cursor/mcp.json`, `~/.gemini/antigravity-cli/mcp_config.json`, `~/.config/opencode/opencode.json`, `~/.config/zed/settings.json`, etc.).

Minimal opencode config — Needle and sequential thinking are bundled and always on:

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

**Note:** Replace `/path/to/chaining-mcp` with your actual path, then run `npm run needle:fetch` once inside it to download the bundled engine. No `MITOSIS_AGENT_ENABLED` / `NEEDLE_*` / `SEQUENTIAL_THINKING_*` vars needed.

**Important:**
- `OPENROUTER_API_KEY`: Optional — feeds escalation only (agent runs fully offline without it). Set `AGENT_ESCALATION_ENABLED=false` to disable escalation entirely.
- `GITHUB_TOKEN`: Optional, required only for live syncing of remote GitHub Awesome Copilot instructions. (Local fallback is used if omitted).

## Available Tools

### Core Chaining Tools

#### 1. `list_mcp_servers`

Lists all discovered MCP servers on the system.

**Input**: None

**Output**: JSON object containing server information including name, command, args, environment variables, and capabilities.

#### 2. `analyze_tools`

Analyzes available tools from discovered MCP servers.

**Input**:

- `serverName` (optional): Filter by specific server name
- `category` (optional): Filter by tool category

**Output**: JSON object containing tool analysis, grouped by server and category.

#### 3. `generate_route_suggestions`

Generates optimal route suggestions for a given task.

![Blotcat drawing a red continuous route map on a wall to connect scattered tools](assets/chaining-illustrations/02-route.jpg)

**Input**:

- `task` (required): The task or problem to solve
- `criteria` (optional): Optimization criteria object

**Criteria Options**:

- `prioritizeSpeed`: Optimize for speed
- `prioritizeSimplicity`: Optimize for simplicity
- `prioritizeReliability`: Optimize for reliability
- `maxComplexity`: Maximum complexity level (1-10)
- `maxDuration`: Maximum duration in milliseconds
- `requiredCapabilities`: Array of required capabilities
- `excludedTools`: Array of tools to exclude

**Output**: JSON object containing suggested routes with tools, estimated duration, complexity, confidence, and reasoning.

#### 4. `analyze_with_sequential_thinking`

Analyzes complex problems with the Needle agent: the returned plan IS the analysis — one validated tool chain grounded in registry tools.

![Blotcat sitting cross-legged, branching thought bubbles emerging from its head](assets/chaining-illustrations/03-sequential.jpg)
**Input**:

- `problem` (required): The problem to analyze

**Output**: JSON object with `thoughts` (one per planned step), `analysis`, `suggestions` (validated tool chain with registry-resolution confidence), all sourced from the agent (`source: 'needle-agent'`).

#### 5. `get_tool_chain_analysis`

Gets comprehensive analysis of available tools and suggested routes.

**Input**:

- `input` (required): Input description for analysis
- `criteria` (optional): Optimization criteria

**Output**: JSON object containing comprehensive analysis including total tools, average complexity, and route recommendations.

### Awesome Copilot Tools

#### 6. `search_instructions`

Searches custom instructions based on keywords in their descriptions.

**Input**:

- `keywords` (required): Keywords to search for in instruction descriptions

**Output**: JSON object with matching instructions and their metadata. Requires GITHUB_TOKEN environment variable to be configured.

#### 7. `load_instruction`

Loads a custom instruction from the repository.

**Input**:

- `mode` (required): Instruction mode (instructions, prompts, chatmodes)
- `filename` (required): Filename of the instruction to load

**Output**: JSON object containing the instruction content and metadata. Requires GITHUB_TOKEN environment variable to be configured.

### Agent Runtime Tools

#### 8. `sequentialthinking`

Think one step with the Mitosis agent: your thought is recorded as an observation in shared `AgentState`, Needle decides the next action (`call_tool` / `revise` / `complete` / `escalate`), and a `call_tool` decision executes immediately through the workflow orchestrator.

**Input**:

- `thought` (required): Your current thinking step (recorded as the step observation)
- `nextThoughtNeeded` (required): Whether another thought step is needed
- `thoughtNumber` (required): Current thought number (mirrored from state)
- `totalThoughts` (required): Estimated total thoughts needed
- `task` (optional): Ongoing task this step belongs to (defaults to the thought)
- `sessionId` (optional): Continue an existing agent session
- `execute` (optional): Execute a `call_tool` decision immediately (default: true)
- `isRevision` / `revisesThought` / `branchFromThought` / `branchId` (optional): Recorded as first-class state events
- `needsMoreThoughts` (optional): If more thoughts are needed

**Output**: JSON object with legacy-shaped fields (`thoughtNumber`, `totalThoughts`, `nextThoughtNeeded`) plus agent fields (`source: 'needle-agent'`, `sessionId`, `decision`, `result`, `escalated`, `state`, `recentState`).

#### 9. `brainstorming`

Generate creative ideas and solutions for problems using different brainstorming approaches.

**Input**:

- `topic` (required): The topic or problem to brainstorm about
- `context` (optional): Additional context or background information
- `approach` (optional): The brainstorming approach ('creative', 'analytical', 'practical', 'innovative') - defaults to 'creative'
- `ideaCount` (optional): Number of ideas to generate (3-20) - defaults to 10
- `includeEvaluation` (optional): Whether to include evaluation and prioritization - defaults to true
- `constraints` (optional): Array of constraints or requirements to consider

**Output**: JSON object containing generated ideas with feasibility, innovation, and effort metrics, plus evaluation and recommendations.

**Approaches**:

- `creative`: Generate innovative and unconventional ideas
- `analytical`: Data-driven and logical solution generation
- `practical`: Realistic and implementable solutions
- `innovative`: Cutting-edge approaches combining multiple perspectives

#### 10. `workflow_orchestrator`

Execute complex multi-server workflows across the MCP ecosystem with dependency management and error handling. Steps execute against the real local tool implementations (transport-bound), with genuine retries, cancellation support, and a non-reentrancy guard.

![Blotcat acting as a factory manager, operating conveyor belts for data handoffs](assets/chaining-illustrations/04-workflow.jpg)
**Input**:

- `workflowId` (required): Unique identifier for the workflow
- `name` (required): Human-readable name for the workflow
- `description` (optional): Description of what this workflow does
- `steps` (required): Array of workflow steps to execute
  - `id`: Unique identifier for this step
  - `serverName`: Name of the MCP server to execute on
  - `toolName`: Name of the tool to execute
  - `parameters`: Parameters to pass to the tool
  - `dependsOn` (optional): IDs of steps that must complete before this step
  - `outputMapping` (optional): Map outputs from this step to input parameters for dependent steps
  - `retryOnFailure` (optional): Whether to retry this step on failure
  - `maxRetries` (optional): Maximum number of retries
- `failFast` (optional): Whether to stop execution on first failure
- `timeout` (optional): Maximum execution time in milliseconds
- `variables` (optional): Global variables available to all steps

**Output**: JSON object containing workflow execution results, step-by-step status, execution time, and aggregated results.

**Key Features**:

- **Dependency Management**: Automatic handling of step dependencies and execution order
- **Parameter Passing**: Automatic passing of outputs from one step as inputs to dependent steps
- **Error Handling**: Configurable retry logic and failure handling strategies
- **Progress Tracking**: Real-time status monitoring of workflow execution
- **Timeout Support**: Configurable execution timeouts for long-running workflows
- **State Persistence**: Workflow state tracking and recovery capabilities

### Time Management Tools

#### 11. `get_current_time`

Get current time in a specific timezone.

**Input**:

- `timezone` (required): IANA timezone name (e.g., 'America/New_York', 'Europe/London')

**Output**: JSON object with timezone, datetime, day of week, and DST status.

#### 12. `convert_time`

Convert time between timezones.

**Input**:

- `source_timezone` (required): Source IANA timezone name
- `time` (required): Time to convert in 24-hour format (HH:MM)
- `target_timezone` (required): Target IANA timezone name

**Output**: JSON object with source and target times, plus time difference.

#### 13. `get_prompt`

Get a specific prebuilt prompt by ID.

**Input**:

- `id` (required): The ID of the prompt to retrieve

**Output**: JSON object containing the complete prompt with its content and metadata.

#### 14. `search_prompts`

Search for prompts by keywords, category, or tags.

**Input**:

- `query` (required): Search query to match against prompt names, descriptions, categories, or tags
- `category` (optional): Filter by category (development, debugging, etc.)
- `complexity` (optional): Filter by complexity level (low, medium, high)

**Output**: JSON object with matching prompts and their metadata.

#### 15. `get_resource_set`

Get a specific resource set by ID.

**Input**:

- `id` (required): The ID of the resource set to retrieve

**Output**: JSON object containing the complete resource set with all its resources.

#### 16. `search_resource_sets`

Search for resource sets by keywords, category, or tags.

**Input**:

- `query` (required): Search query to match against resource set names, descriptions, categories, or tags
- `category` (optional): Filter by category (development, debugging, etc.)
- `complexity` (optional): Filter by complexity level (low, medium, high)

**Output**: JSON object with matching resource sets and their metadata.

#### 17. `validate_tool_chain`

Validate tool chains for correctness, dependencies, and potential issues. Checks for circular dependencies, tool availability, and parameter compatibility.

**Input**:

- `toolChain` (required): Array of tool chain steps with server name, tool name, parameters, and dependencies
- `checkCircularDependencies` (optional): Whether to check for circular dependencies (default: true)
- `checkToolAvailability` (optional): Whether to verify tools exist on their servers (default: true)
- `checkParameterCompatibility` (optional): Whether to check parameter compatibility (default: true)

**Output**: JSON object with validation results including errors, warnings, and overall validity status.

#### 18. `analyze_tool_chain_performance`

Analyze performance metrics and efficiency of tool chains. Provides execution time estimates, complexity analysis, and optimization suggestions.

**Input**:

- `toolChain` (required): Array of tool chain steps to analyze
- `includeExecutionMetrics` (optional): Whether to include execution time estimates (default: true)
- `includeComplexityAnalysis` (optional): Whether to analyze complexity metrics (default: true)
- `includeOptimizationSuggestions` (optional): Whether to provide optimization suggestions (default: true)

**Output**: JSON object with performance metrics, complexity analysis, and optimization recommendations.

### Built-in LLM Engine Tools

#### 19. `llm_query`

Execute direct queries and reasoning tasks through OpenRouter / OpenAI endpoints without consuming the parent agent's tokens.

**Input**:

- `prompt` (required): User prompt or query to execute
- `systemPrompt` (optional): Custom system instructions for persona/formatting

**Output**: JSON object with model response, tokens used, latency, and status.

#### 20. `llm_decompose_task`

Intelligently decomposes complex multi-step development goals into structured, ordered subtasks with tool categorization recommendations.

**Input**:

- `task` (required): High-level task description to decompose

**Output**: JSON object containing array of subtasks, recommended categories, and suggested workflow steps.

#### 21. `llm_suggest_route`

Analyzes task requirements and uses internal AI to rank and score the optimal tool execution chain, with instant heuristic fallback when LLM is offline.

**Input**:

- `task` (required): Task to optimize routes for
- `criteria` (optional): Routing constraints (speed, reliability, complexity)

**Output**: JSON object with top routes, confidence scores, and reasoning breakdown.

#### 22. `llm_summarize`

Generates high-density summaries of extensive logs, search results, or multi-tool outputs.

**Input**:

- `content` (required): Long-form text content to summarize
- `maxWords` (optional): Target word count bound (default: 150)

**Output**: JSON object with concise summary.

### Agent Runtime Tools (continued)

#### 23. `agent_run`

Run a task through the full Needle loop: plan with the local model, execute tools via the workflow orchestrator, observe results, escalate to OpenRouter only on low confidence or failure.

**Input**:

- `task` (required): The task or objective for the agent to accomplish
- `maxIterations` (optional): Maximum decide-act-observe iterations (1-20, default: 8)
- `maxToolCalls` (optional): Maximum tool executions per run (1-30, default: 12)
- `maxExecutionMs` (optional): Run wall-clock budget in ms (default: 60000, cap: 300000)

**Output**: JSON object with `workflowId`, `sessionId`, validated `plan`, final `decision`, `toolCalls`, `iterations`, `escalated` + `escalations` trail, and `stateStats`.

#### 24. `workflow_status`

Get the current status and step results of a workflow executed by `workflow_orchestrator` or `agent_run`.

**Input**:

- `workflowId` (required): Workflow identifier returned by `workflow_orchestrator` or `agent_run`

#### 25. `workflow_cancel`

Request cancellation of a running workflow.

**Input**:

- `workflowId` (required): Workflow identifier to cancel

## Available Resources

### `chaining://servers`

Returns a JSON list of all discovered MCP servers.

### `chaining://tools`

Returns a JSON list of all available tools from discovered servers.

### `chaining://analysis`

Returns a JSON summary of the current analysis state.

### `chaining://prompts`

Returns a JSON collection of all available prebuilt prompts for common development tasks.

### `chaining://resources`

Returns a JSON collection of curated resource sets for different development scenarios.

### `chaining://prompts/overview`

Returns a JSON overview of available prompts by category and complexity level.

### `chaining://awesome-copilot/collections`

Returns a JSON collection of all available awesome-copilot collections with their metadata.

### `chaining://awesome-copilot/instructions`

Returns a JSON collection of all available awesome-copilot instructions with their metadata.

### `chaining://awesome-copilot/status`

Returns a JSON object with the current status of awesome-copilot integration.

### `chaining://sequential/state`

Returns live AgentState sessions (observations, decisions, tool calls/results, revisions, branches, escalation, termination) backing the Needle-driven sequential thinking.

### `chaining://agent/status`

Returns configuration and readiness of the local Needle agent runtime and escalation policy (spawn-free, never exposes keys).

### `chaining://workflows/status`

Returns a JSON object with the status of active and completed workflow orchestrations, including execution progress and results.

### `chaining://tool-chains`

Returns a JSON collection of comprehensive tool chaining resources including prompts and resource sets specifically designed for complex development workflows and orchestration patterns.

### `chaining://tool-chains/overview`

Returns a JSON overview of available tool chaining resources organized by category and complexity level, providing insights into the tool chaining capabilities.

### `chaining://health`

Returns a live health check status of the server and sub-components.

### `chaining://cache/stats`

Returns discovery caching metrics (hits, misses, TTL status).

### `chaining://llm/status`

Returns internal LLM engine state, configured model, and availability.

### `chaining://llm/usage`

Returns session-level token consumption and API call tracking metrics.

## Usage Examples

### Basic Server Discovery

```javascript
// List all discovered MCP servers
const servers = await mcpClient.callTool('list_mcp_servers', {});
console.log(servers);
```

### Tool Analysis

```javascript
// Analyze tools by category
const analysis = await mcpClient.callTool('analyze_tools', {
  category: 'filesystem'
});
console.log(analysis);
```

### Route Generation

```javascript
// Generate route suggestions for a task
const routes = await mcpClient.callTool('generate_route_suggestions', {
  task: 'Read a file and search for specific content',
  criteria: {
    prioritizeSpeed: true,
    maxComplexity: 5
  }
});
console.log(routes);
```

### Sequential Thinking Analysis

```javascript
// Analyze complex workflow with sequential thinking
const analysis = await mcpClient.callTool('analyze_with_sequential_thinking', {
  problem: 'Design a complex data processing pipeline',
  criteria: {
    prioritizeReliability: true,
    maxDuration: 10000
  },
  maxThoughts: 15
});
console.log(analysis);
```

### Awesome Copilot Integration

```javascript
// Search for development instructions
const instructions = await mcpClient.callTool('search_instructions', {
  keywords: 'mcp server'
});

// Load a specific instruction
const instruction = await mcpClient.callTool('load_instruction', {
  mode: 'instructions',
  filename: 'typescript-mcp-server.instructions.md'
});

// Note: These tools require GITHUB_TOKEN environment variable to be configured
// Get a token from https://github.com/settings/tokens and set it in your environment
```

### Sequential Thinking

```javascript
// Think one agent step: thought recorded, Needle decides, result feeds back
const step1 = await mcpClient.callTool('sequentialthinking', {
  thought: 'I need the Jakarta weather first',
  task: 'get weather in Jakarta',
  nextThoughtNeeded: true,
  thoughtNumber: 1,
  totalThoughts: 5
});
// → { source: 'needle-agent', sessionId, decision, result, state, recentState }

// Continue the same session
const step2 = await mcpClient.callTool('sequentialthinking', {
  thought: 'Weather known, wrap up',
  task: 'get weather in Jakarta',
  sessionId: step1.sessionId,
  nextThoughtNeeded: false,
  thoughtNumber: 2,
  totalThoughts: 5
});
```

### Agent Run

```javascript
// Full plan → execute → observe loop through the Needle agent
const run = await mcpClient.callTool('agent_run', {
  task: 'get weather in Jakarta and summarize it',
  maxIterations: 8,
  maxToolCalls: 12
});
// → { workflowId, sessionId, plan, decision, toolCalls, escalations, stateStats }

// Inspect / cancel via lifecycle tools
const status = await mcpClient.callTool('workflow_status', { workflowId: run.workflowId });
await mcpClient.callTool('workflow_cancel', { workflowId: run.workflowId });
```

### Brainstorming

```javascript
// Generate creative ideas for a product feature
const creativeIdeas = await mcpClient.callTool('brainstorming', {
  topic: 'user onboarding experience',
  approach: 'creative',
  ideaCount: 8,
  constraints: ['must be mobile-friendly', 'budget under $50k']
});

// Generate practical solutions for a technical problem
const practicalSolutions = await mcpClient.callTool('brainstorming', {
  topic: 'database performance optimization',
  context: 'high-traffic e-commerce platform',
  approach: 'practical',
  ideaCount: 6,
  includeEvaluation: true
});

// Generate analytical approaches for data analysis
const analyticalIdeas = await mcpClient.callTool('brainstorming', {
  topic: 'customer churn prediction',
  approach: 'analytical',
  constraints: ['must use existing data', 'prediction accuracy > 85%']
});
```

### Workflow Orchestration

```javascript
// Execute a multi-server research workflow
const researchWorkflow = await mcpClient.callTool('workflow_orchestrator', {
  workflowId: 'research-workflow-001',
  name: 'AI Technology Research Pipeline',
  description: 'Comprehensive research on AI technologies using multiple MCP servers',
  steps: [
    {
      id: 'search-trends',
      serverName: 'google-search-mcp',
      toolName: 'search_trends',
      parameters: {
        topics: ['artificial intelligence', 'machine learning'],
        timeframe: '6M',
        includePredictions: true
      }
    },
    {
      id: 'academic-research',
      serverName: 'google-search-mcp',
      toolName: 'academic_search',
      parameters: {
        query: 'artificial intelligence trends 2024',
        maxResults: 5
      },
      dependsOn: ['search-trends']
    },
    {
      id: 'content-analysis',
      serverName: 'google-search-mcp',
      toolName: 'content_summarizer',
      parameters: {
        urls: ['output://academic-research.results'], // Using output mapping
        maxLength: 500
      },
      dependsOn: ['academic-research'],
      outputMapping: {
        'urls': 'academic-research.results.urls' // Map output to input
      }
    }
  ],
  failFast: false,
  timeout: 300000 // 5 minutes
});

// Check workflow status
const workflowStatus = await mcpClient.readResource('chaining://workflows/status');
console.log('Active workflows:', workflowStatus);
```

### Time Management

```javascript
// Get current time in different timezones
const nyTime = await mcpClient.callTool('get_current_time', {
  timezone: 'America/New_York'
});

const londonTime = await mcpClient.callTool('get_current_time', {
  timezone: 'Europe/London'
});

// Convert time between timezones
const conversion = await mcpClient.callTool('convert_time', {
  source_timezone: 'America/New_York',
  time: '14:30',
  target_timezone: 'Asia/Tokyo'
});
```

### Built-in LLM Intelligence Tools

```javascript
// Decompose a complex project goal into ordered subtasks
const decomposition = await mcpClient.callTool('llm_decompose_task', {
  task: 'Build and deploy a fullstack TypeScript application with automated database migrations'
});
console.log(decomposition.subtasks);

// Generate AI-scored and ranked tool execution route
const aiRoute = await mcpClient.callTool('llm_suggest_route', {
  task: 'Optimize PostgreSQL slow queries using indexing and memory caches',
  criteria: { prioritizeReliability: true }
});
console.log(aiRoute.routes);

// High-density log & output summarization
const summary = await mcpClient.callTool('llm_summarize', {
  content: 'Extensive build error logs or raw JSON command outputs...',
  maxWords: 100
});
console.log(summary.summary);
```

### Prebuilt Prompts & Resources

```javascript
// Get a specific prebuilt prompt
const prompt = await mcpClient.callTool('get_prompt', {
  id: 'analyze-project-structure'
});
console.log(prompt);

// Search for prompts by keyword
const searchResults = await mcpClient.callTool('search_prompts', {
  query: 'debugging',
  category: 'development',
  complexity: 'medium'
});
console.log(searchResults);

// Get a resource set
const resourceSet = await mcpClient.callTool('get_resource_set', {
  id: 'development-starter-kit'
});
console.log(resourceSet);

// Search for resource sets
const resourceSearch = await mcpClient.callTool('search_resource_sets', {
  query: 'performance',
  complexity: 'high'
});
console.log(resourceSearch);
```

### Accessing Resources

```javascript
// Get all available prompts
const allPrompts = await mcpClient.readResource('chaining://prompts');
console.log(allPrompts);

// Get all resource sets
const allResources = await mcpClient.readResource('chaining://resources');
console.log(allResources);

// Get server health & uptime status
const health = await mcpClient.readResource('chaining://health');
console.log(health);

// Get discovery cache hit/miss statistics
const cacheStats = await mcpClient.readResource('chaining://cache/stats');
console.log(cacheStats);

// Get internal LLM engine status & token usage
const llmStatus = await mcpClient.readResource('chaining://llm/status');
const llmUsage = await mcpClient.readResource('chaining://llm/usage');
console.log(llmStatus, llmUsage);
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAINING_TOOL_TIMEOUT_MS` | `10000` | Hard timeout (ms) for any tool execution (`agent_run` / agent-fronted `sequentialthinking` honor their own budget instead, capped at 300000) |
| `OPENROUTER_API_KEY` | *optional* | Escalation backend key (`sk-or-v1-...`). Agent runs fully offline without it |
| `AGENT_ESCALATION_ENABLED` | `true` | Set `false` to disable OpenRouter escalation entirely |
| `AGENT_MAX_ESCALATIONS` | `1` | Budgeted one-way escalation trips per run |
| `AGENT_REPEATED_FAILURE_THRESHOLD` | `3` | Consecutive tool errors that force escalation |
| `MITOSIS_AGENT_ENABLED` | *auto* | Bundled engine present = on. Set `false` to opt out |
| `NEEDLE_ENGINE_PATH` | `assets/needle/needle` | Override for non-standard engine locations |
| `NEEDLE_MODEL_PATH` | `assets/needle/needle2.cact` | Reserved: reported by health checks; the CLI runs the baked base model (no `--weights` flag yet — tuned `.cact` needs a future libneedle path) |
| `NEEDLE_TOOL_INDEX_PATH` | `assets/needle/tools.idx` | Persisted tool-embedding cache; engine keys it by schema+model fingerprint, safe across toolsets and restarts |
| `NEEDLE_CONFIDENCE_THRESHOLD` | `0.6` | Act at/above, escalate below |
| `NEEDLE_PORT` | `18080` | Preferred serve port (free port picked on conflict) |
| `CHAINING_LLM_ENABLED` | `false` | Enable built-in OpenRouter LLM intelligence features |
| `OPENROUTER_API_KEY` | *optional* | API Key for OpenRouter (`sk-or-v1-...`) |
| `CHAINING_LLM_MODEL` | `openrouter/free` | Primary model identifier (auto-falls back to `openrouter/auto`) |
| `CHAINING_LLM_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter or OpenAI-compatible endpoint URL |
| `CHAINING_LLM_MAX_TOKENS` | `1024` | Maximum tokens per internal generation request |
| `CHAINING_LLM_TIMEOUT_MS` | `4000` | AbortController timeout for LLM network requests |
| `CHAINING_LLM_APP_NAME` | `hela-mitosis` | OpenRouter `X-Title` app attribution |
| `CHAINING_LLM_APP_URL` | `https://github.com/1999AZZAR/hela-mcp-ecosystem` | OpenRouter `HTTP-Referer` app attribution |
| `GITHUB_TOKEN` | *optional* | Personal access token for remote GitHub instruction syncing |
| `MCP_DISCOVERY_CONFIG_PATHS` | *auto* | JSON array of paths to custom MCP config files |
| `MCP_SERVERS` | *none* | Direct JSON definition of MCP servers |
| `MEMORY_FILE_PATH` | `./data/memory.json` | Path to persistent cache file |

### Zero-Key & Offline Autonomous Operation

The server is built to run seamlessly in 100% offline, zero-key environments:
- **No `OPENROUTER_API_KEY`**: The Needle agent still plans, decides, executes, and completes locally. Escalation paths report a budgeted, recorded failure instead of working.
- **No `GITHUB_TOKEN`**: Awesome Copilot tools (`search_instructions`, `load_instruction`) operate from the local bundled catalog with zero network requirements.
- **No model env vars**: The Needle 2 engine is bundled (`npm run needle:fetch`) and auto-enables when present.
- **Core Orchestration**: All core tools, agent runtime, brainstorming, workflow runners, time management, prompts, and resources run locally.

## Development

### Project Structure

```
src/
├── index.ts                           # Main entry point (stdio JSON-RPC transport)
├── server.ts                          # Clean orchestrator (modular server lifecycle)
├── types.ts                           # Type definitions and Zod schemas
├── core/
│   ├── discovery.ts                   # Server discovery logic with 60s TTL caching
│   └── optimizer.ts                   # Route optimization & fallback algorithms
├── managers/
│   ├── brainstorming-manager.ts       # Multi-approach brainstorming generator
│   ├── workflow-orchestrator.ts       # Workflow execution: transport seam, real retries, cancellation
│   ├── reliability-manager.ts         # System reliability & health monitoring
│   ├── time-manager.ts                # Time and timezone management with DST
│   ├── memory-manager.ts              # Memory and knowledge graph management
│   └── llm-manager.ts                 # Native OpenRouter/OpenAI API manager (escalation backend)
├── agent/                             # Needle 2 agent runtime (bundled engine)
│   ├── agent.ts                       # Agent loop, single step, planner, decision protocol
│   ├── schemas.ts                     # ModelProvider seam, AgentDecision/AgentPlan schemas
│   ├── needle-provider.ts             # Bundled engine: serve mode + one-shot
│   ├── openrouter-provider.ts         # Escalation adapter over LLMManager
│   ├── state.ts                       # AgentStateManager + shared session store
│   ├── escalation.ts                  # Budgeted one-way escalation policy
│   ├── workflow.ts                    # Plan→workflow bridge, runAgentWorkflow
│   └── diagnostics.ts                 # Bundled-first enablement + spawn-free status
├── integrations/
│   └── awesome-copilot-integration.ts # Awesome Copilot integration & local catalog
├── prompts/
│   ├── prompt-definitions.ts          # Prompt and resource set data definitions
│   ├── prompt-handlers.ts             # Dynamic prompt generation and validation logic
│   └── prompt-registry.ts             # Registry for managing 42 prompts & 12 resource sets
├── handlers/
│   └── request-handlers.ts            # Central tool execution dispatcher with timeout guards
├── tools/
│   ├── tool-registry.ts               # Tool definitions and listing (agent tools gated on bundled engine)
│   ├── core-chaining-tools.ts         # Core chaining tool schemas (6 tools)
│   ├── awesome-copilot-tools.ts       # Awesome Copilot tool schemas (2 tools)
│   ├── sequential-thinking-tools.ts   # Sequential thinking tool schemas (2 tools)
│   ├── agent-tools.ts                 # agent_run + workflow_status/workflow_cancel schemas
│   ├── time-management-tools.ts       # Time management tool schemas (2 tools)
│   ├── prompt-resource-tools.ts       # Prompt/resource tool schemas (4 tools)
│   ├── validation-analysis-tools.ts   # Validation/analysis tool schemas (2 tools)
│   └── llm-tools.ts                   # LLM engine tool schemas (4 tools)
└── resources/
    ├── resource-registry.ts           # Resource registry dispatcher
    ├── resource-definitions.ts        # Static resource metadata (17 resources)
    └── resource-handlers.ts           # Dynamic resource content generation
```

### Building & Testing

```bash
# Fetch the bundled Needle 2 engine + weights (once)
npm run needle:fetch

# Build TypeScript to JavaScript
npm run build

# Run comprehensive end-to-end smoke test suite (22 tools, 17 resources)
npm test

# Run live OpenRouter integration test (requires OPENROUTER_API_KEY)
npm run test:llm

# Run the agent benchmark suite (mock providers, no engine needed)
node scripts/test-agent.mjs

# Run the agent suite against the live bundled engine
NEEDLE_LIVE=1 node scripts/test-agent.mjs

# Run the 20-task planning battery (repeated runs, live engine)
NEEDLE_LIVE=1 node scripts/bench-battery.mjs
```

## Integration with Other MCP Servers

This server is designed to work seamlessly with other MCP servers in your ecosystem. Sequential thinking is handled locally by the bundled Needle 2 agent — no external sequential-thinking MCP server is required or consulted:

### Awesome Copilot Integration

The server integrates with the official awesome-copilot MCP server to provide:

1. Real-time access to GitHub-hosted development instructions and prompts
2. Direct communication with the awesome-copilot repository via MCP protocol
3. Secure authentication using GitHub Personal Access Tokens
4. Live updates from the awesome-copilot community resources

### Project-Guardian Integration

The chaining server complements Project-Guardian by:

1. Providing high-level coordination and orchestration
2. Offering development guidance and workflow management
3. Avoiding duplicate functionality (database operations are handled by Project-Guardian)

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please create an issue in the repository.
