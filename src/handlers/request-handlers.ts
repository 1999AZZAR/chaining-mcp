import { spawn } from 'child_process';
import { MCPServerDiscovery } from '../core/discovery.js';
import { SmartRouteOptimizer } from '../core/optimizer.js';
import { SequentialThinkingIntegration } from '../integrations/sequential-integration.js';
import { SequentialThinkingManager } from '../managers/sequential-thinking-manager.js';
import { TimeManager } from '../managers/time-manager.js';
import { PromptRegistry } from '../prompts/prompt-registry.js';
import { AwesomeCopilotIntegration } from '../integrations/awesome-copilot-integration.js';
import { BrainstormingManager } from '../managers/brainstorming-manager.js';
import { WorkflowOrchestrator } from '../managers/workflow-orchestrator.js';
import { LLMManager } from '../managers/llm-manager.js';
import { runAgentWorkflow } from '../agent/workflow.js';
import { isAgentEnabled } from '../agent/diagnostics.js';

export class RequestHandlers {
  constructor(
    private discovery: MCPServerDiscovery,
    private optimizer: SmartRouteOptimizer,
    private sequentialIntegration: SequentialThinkingIntegration,
    private sequentialThinkingManager: SequentialThinkingManager,
    private timeManager: TimeManager,
    private promptRegistry: PromptRegistry,
    private awesomeCopilotIntegration: AwesomeCopilotIntegration,
    private brainstormingManager: BrainstormingManager,
    private workflowOrchestrator: WorkflowOrchestrator,
    private llmManager?: LLMManager
  ) {}

  async handleToolCall(name: string, args: any): Promise<any> {
    const defaultMs = parseInt(process.env.CHAINING_TOOL_TIMEOUT_MS || '10000', 10);
    // agent_run carries its own budget (plan + multi-turn inference routinely
    // exceeds the interactive tool timeout); honor it with an upper bound.
    // sequentialthinking gets the same treatment when it fronts the agent.
    const agentFronted = name === 'agent_run' ||
      (name === 'sequentialthinking' && isAgentEnabled());
    const timeoutMs = agentFronted
      ? Math.min(Number(args?.maxExecutionMs) || 60000, 300000)
      : defaultMs;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool '${name}' execution timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      return await Promise.race([
        this.executeTool(name, args || {}),
        timeoutPromise
      ]);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tool: name,
      };
    }
  }

  private async executeTool(name: string, args: any): Promise<any> {
    // Core Chaining Tools
    if (['list_mcp_servers', 'analyze_tools', 'generate_route_suggestions', 'analyze_with_sequential_thinking', 'get_tool_chain_analysis', 'sequentialthinking'].includes(name)) {
      return await this.handleCoreChainingTool(name, args);
    }

    // Route Awesome Copilot Tools
    if (['search_instructions', 'load_instruction'].includes(name)) {
      return await this.handleAwesomeCopilotTool(name, args);
    }

    // Sequential Thinking Tools
    if (['brainstorming', 'workflow_orchestrator'].includes(name)) {
      return await this.handleSequentialThinkingTool(name, args);
    }

    // Time Management Tools
    if (['get_current_time', 'convert_time'].includes(name)) {
      return await this.handleTimeManagementTool(name, args);
    }

    // Agent Runtime Tools (Milestone 8)
    if (['agent_run', 'workflow_status', 'workflow_cancel'].includes(name)) {
      return await this.handleAgentTool(name, args);
    }

    // Prompt & Resource Tools
    if (['get_prompt', 'search_prompts', 'get_resource_set', 'search_resource_sets'].includes(name)) {
      return await this.handlePromptResourceTool(name, args);
    }

    // Validation & Analysis Tools
    if (['validate_tool_chain', 'analyze_tool_chain_performance'].includes(name)) {
      return await this.handleValidationAnalysisTool(name, args);
    }

    // Built-in LLM Tools
    if (['llm_query', 'llm_decompose_task', 'llm_suggest_route', 'llm_summarize'].includes(name)) {
      return await this.handleLLMTool(name, args);
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  private async handleLLMTool(name: string, args: any): Promise<any> {
    if (!this.llmManager) {
      return { ok: false, error: 'LLM manager not initialized', tool: name };
    }

    switch (name) {
      case 'llm_query':
        return await this.llmManager.query(args.prompt, args.systemPrompt);

      case 'llm_decompose_task': {
        const tools = this.discovery.getTools();
        const summary = tools.map(t => `${t.name} (${t.category || 'utility'}): ${t.description}`).join('\n');
        // Needle-first planning when the agent runtime is enabled; legacy path otherwise.
        if (isAgentEnabled()) {
          try {
            const { planTask } = await import('../agent/agent.js');
            const plan = await planTask(
              args.task, summary, undefined, undefined,
              tools.map(t => ({ name: t.name, description: t.description, schema: (t.inputSchema as any)?.properties ? t.inputSchema : undefined })),
            );
            return {
              ok: true,
              source: 'needle',
              subtasks: plan.steps.map(s => ({
                step: s.step,
                task: s.task,
                recommendedCategory: s.recommendedCategory || 'utility',
                tool: s.tool,
                dependsOn: s.dependsOn,
              })),
            };
          } catch (e) {
            const reason = e instanceof Error ? e.message : String(e);
            const legacy = await this.llmManager.decomposeTask(args.task, summary);
            return { ...legacy, source: 'legacy_fallback', needleError: reason };
          }
        }
        return await this.llmManager.decomposeTask(args.task, summary);
      }

      case 'llm_suggest_route': {
        const heuristicRoutes = await this.optimizer.generateRoutes(args.task, args.criteria || {});
        if (!this.llmManager.isEnabled()) {
          return {
            ok: true,
            source: 'heuristic_fallback',
            routes: heuristicRoutes,
            reason: 'LLM disabled or OPENROUTER_API_KEY not set',
          };
        }
        const prompt = `Given the task: "${args.task}" and criteria: ${JSON.stringify(args.criteria || {})}, rank and refine these routes:\n${JSON.stringify(heuristicRoutes, null, 2)}`;
        const result = await this.llmManager.query(prompt, 'You are a tool route optimization engine.');
        return {
          ok: true,
          source: result.ok ? 'llm_enhanced' : 'heuristic_fallback',
          routes: heuristicRoutes,
          llmAnalysis: result.text || result.error,
        };
      }

      case 'llm_summarize':
        const summary = await this.llmManager.summarize(args.content, args.maxWords);
        return { ok: true, summary };

      default:
        throw new Error(`Unknown LLM tool: ${name}`);
    }
  }

  private async handleCoreChainingTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'list_mcp_servers':
        const servers = this.discovery.getServers();
        return {
          servers: servers.map(s => ({
            name: s.name,
            command: s.command,
            args: s.args,
            capabilities: s.capabilities,
          })),
          total: servers.length,
        };

      case 'analyze_tools':
        const tools = this.discovery.getTools();
        const filtered = args.serverName
          ? tools.filter(t => t.serverName === args.serverName)
          : args.category
            ? tools.filter(t => t.category === args.category)
            : tools;

        return {
          tools: filtered.map(t => ({
            name: t.name,
            description: t.description,
            server: t.serverName,
            category: t.category,
            complexity: t.estimatedComplexity || 1,
          })),
          total: filtered.length,
          categories: [...new Set(filtered.map(t => t.category))],
        };

      case 'generate_route_suggestions':
        const routes = await this.optimizer.generateRoutes(args.task, args.criteria || {});
        return {
          routes: routes.map(route => ({
            tools: route.tools,
            estimatedDuration: route.estimatedDuration,
            complexity: route.complexity,
            confidence: route.confidence,
            reasoning: route.reasoning,
          })),
          totalRoutes: routes.length,
        };

      case 'analyze_with_sequential_thinking': {
        const availableTools = this.discovery.getTools();
        // Needle-backed: the plan IS the sequential analysis — one validated
        // tool chain instead of canned template thoughts. Legacy heuristic
        // path preserved when the agent runtime is off.
        if (isAgentEnabled()) {
          const { planTask } = await import('../agent/agent.js');
          const plan = await planTask(
            String(args.problem || ''), '',
            undefined, undefined,
            availableTools.map(t => ({ name: t.name, description: t.description, schema: (t.inputSchema as any)?.properties ? t.inputSchema : undefined })),
          );
          const byName = new Map(availableTools.map(t => [t.name, t]));
          const planTools = plan.steps.map(s => byName.get(s.tool || '')).filter(Boolean);
          const knownShare = plan.steps.length ? planTools.length / plan.steps.length : 0;
          return {
            source: 'needle-agent',
            thoughts: plan.steps.map(s => ({
              number: s.step,
              content: `${s.tool}: ${s.task}`,
              type: 'planning',
            })),
            analysis: {
              problemComplexity: plan.steps.length > 4 ? 'high' : plan.steps.length > 2 ? 'medium' : 'low',
              toolAvailability: availableTools.length,
              recommendedApproach: plan.steps.length <= 2 ? 'simple' : 'comprehensive',
              keyInsights: plan.steps.map(s => `${s.tool} — ${s.task}`),
              potentialChallenges: [],
            },
            suggestions: [{
              id: `needle_plan_${Date.now()}`,
              name: 'Needle agent plan',
              description: `Validated ${plan.steps.length}-step tool chain for: ${String(args.problem || '').slice(0, 120)}`,
              tools: planTools,
              estimatedDuration: planTools.reduce((sum, t: any) => sum + (t.estimatedDuration || 500), 0),
              complexity: Math.round(plan.steps.length * 10) / 10,
              confidence: Math.round(knownShare * 100) / 100,
              reasoning: `${planTools.length}/${plan.steps.length} planned tools resolved against the discovery registry`,
            }],
            confidence: Math.round(knownShare * 100) / 100,
            reasoning: `Needle produced a validated ${plan.steps.length}-step chain; all reasoning is grounded in registry tools, no template thoughts.`,
          };
        }
        const analysis = await this.sequentialIntegration.analyzeWorkflow(
          args.problem,
          availableTools,
          args.criteria || {}
        );
        return {
          thoughts: analysis.thoughts,
          analysis: analysis.analysis,
          suggestions: analysis.suggestions.map(suggestion => ({
            tools: suggestion.tools,
            estimatedDuration: suggestion.estimatedDuration,
            complexity: suggestion.complexity,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
          })),
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
        };
      }

      case 'get_tool_chain_analysis':
        const toolChainAnalysis = this.optimizer.getToolChainAnalysis(args.input || '');
        return toolChainAnalysis;

      case 'sequentialthinking': {
        // Refined: with the agent runtime enabled, a thought becomes one
        // observe → decide (→ optionally execute) agent step recorded in
        // AgentState. Legacy caller-supplied-thought path preserved otherwise.
        if (isAgentEnabled()) {
          const { agentStep } = await import('../agent/agent.js');
          const { sharedAgentState } = await import('../agent/state.js');
          const tools = this.discovery.getTools();
          const step = await agentStep({
            task: String(args.task || args.thought || ''),
            observation: args.thought ? String(args.thought) : undefined,
            sessionId: args.sessionId ? String(args.sessionId) : undefined,
            tools: tools.map(t => ({ name: t.name, description: t.description, schema: (t.inputSchema as any)?.properties ? t.inputSchema : undefined })),
            execute: args.execute !== false,
            executor: {
              executeTool: (tool, params, signal) => this.workflowOrchestrator.executeTool(tool, (params as Record<string, any>) || {}, { signal }),
            },
            revision: args.isRevision ? `revises thought ${args.revisesThought || '?'}` : undefined,
            branch: args.branchId ? { branchId: String(args.branchId), fromEvent: args.branchFromThought } : undefined,
            state: sharedAgentState(),
          });
          const n = Number(args.thoughtNumber) || (step.stats?.events ?? 1);
          const total = Number(args.totalThoughts) || n;
          return {
            // Legacy-shaped fields (compat): thought numbering now mirrors state.
            thoughtNumber: n,
            totalThoughts: Math.max(total, n),
            nextThoughtNeeded: step.decision.action === 'call_tool' || step.decision.action === 'revise',
            // Agent-shaped fields.
            source: 'needle-agent',
            sessionId: step.sessionId,
            decision: step.decision,
            result: step.result,
            error: step.error,
            escalated: step.escalated,
            state: step.stats,
            recentState: step.tail,
          };
        }
        return await this.sequentialThinkingManager.processThought(args);
      }

      default:
        throw new Error(`Unknown core chaining tool: ${name}`);
    }
  }

  private async handleAwesomeCopilotTool(name: string, args: any): Promise<any> {
    const awesomeCopilotServer = this.discovery.getServers().find(server => server.name === 'awesome-copilot');
    const githubToken = awesomeCopilotServer?.env?.GITHUB__TOKEN || process.env.GITHUB_TOKEN || process.env.GITHUB__TOKEN;

    // If external server and token are configured, attempt remote call first
    if (awesomeCopilotServer && githubToken && githubToken !== 'your_github_token_here') {
      try {
        const result = await this.executeAwesomeCopilotTool(awesomeCopilotServer, name, args);
        if (result && !result.error) {
          return result;
        }
      } catch (error) {
        // Fall back to local integration on error
      }
    }

    // Graceful local fallback
    if (name === 'search_instructions') {
      const keywords = String(args.keywords || '');
      const results = this.awesomeCopilotIntegration.searchInstructions(keywords);
      return {
        source: 'local_fallback',
        warning: !githubToken ? 'Using local collection (set GITHUB_TOKEN for full GitHub integration)' : undefined,
        results,
        total: results.length,
      };
    }

    if (name === 'load_instruction') {
      const mode = String(args.mode || 'instructions');
      const filename = String(args.filename || '');
      const instruction = this.awesomeCopilotIntegration.getInstruction(mode, filename);
      if (instruction) {
        return {
          source: 'local_fallback',
          warning: !githubToken ? 'Using local collection (set GITHUB_TOKEN for full GitHub integration)' : undefined,
          ...instruction,
        };
      }
      return {
        error: `Instruction not found: ${mode}/${filename}`,
        source: 'local_fallback',
      };
    }

    throw new Error(`Unknown awesome copilot tool: ${name}`);
  }

  private async executeAwesomeCopilotTool(serverInfo: any, toolName: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let child: any = null;
      const timeout = setTimeout(() => {
        if (child) {
          try { child.kill('SIGKILL'); } catch (_) {}
        }
        reject(new Error(`Timeout executing tool ${toolName} on awesome-copilot server`));
      }, 3000); // 3 second timeout

      try {
        child = spawn(serverInfo.command, serverInfo.args, {
          env: { ...process.env, ...serverInfo.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let output = '';
        let errorOutput = '';

        child.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        child.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(new Error(`Failed to spawn awesome-copilot server: ${error.message}`));
        });

        child.on('close', (code: number) => {
          clearTimeout(timeout);
          if (code !== 0) {
            reject(new Error(`Awesome-copilot server exited with code ${code}: ${errorOutput}`));
            return;
          }

          try {
            // Parse the MCP response
            const response = this.parseAwesomeCopilotResponse(output);
            if (response && response.result && response.result.content) {
              const content = response.result.content[0];
              if (content && content.type === 'text') {
                const result = JSON.parse(content.text);
                resolve(result);
              } else {
                resolve(response.result);
              }
            } else {
              resolve({ message: 'Tool executed successfully but no result returned' });
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response from awesome-copilot server: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
          }
        });

        // Send MCP initialize request first
        const initRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'chaining-mcp-server', version: '1.0.0' }
          }
        };

        child.stdin?.write(JSON.stringify(initRequest) + '\n');

        setTimeout(() => {
          const toolRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args
            }
          };

          child.stdin?.write(JSON.stringify(toolRequest) + '\n');
          child.stdin?.end();
        }, 500);

      } catch (error) {
        clearTimeout(timeout);
        if (child) {
          try { child.kill('SIGKILL'); } catch (_) {}
        }
        reject(new Error(`Failed to execute tool on awesome-copilot server: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  private parseAwesomeCopilotResponse(output: string): any {
    const lines = output.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        if (response.id === 2 && response.result) { // Our tool call response
          return response;
        }
      } catch (error) {
        // Skip invalid JSON lines
        continue;
      }
    }
    return null;
  }

  private normalizeToolChain(toolChain: any[]): any[] {
    if (!Array.isArray(toolChain)) return [];
    const availableTools = this.discovery.getTools();
    return toolChain.map((step, index) => {
      if (typeof step === 'string') {
        const found = availableTools.find(t => t.name === step);
        return {
          id: `step_${index + 1}`,
          serverName: found ? (found as any).serverName || 'core' : 'core',
          toolName: step,
          parameters: {},
        };
      }
      const toolName = step.toolName || step.name || `tool_${index + 1}`;
      const found = availableTools.find(t => t.name === toolName);
      return {
        ...step,
        id: step.id || `step_${index + 1}`,
        serverName: step.serverName || (found ? (found as any).serverName || 'core' : 'core'),
        toolName,
        parameters: step.parameters || {},
      };
    });
  }

  private validateToolChain(
    rawToolChain: any[],
    availableTools: any[],
    options: {
      checkCircularDependencies?: boolean;
      checkToolAvailability?: boolean;
      checkParameterCompatibility?: boolean;
    } = {}
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    normalizedToolChain?: any[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(rawToolChain) || rawToolChain.length === 0) {
      return {
        valid: false,
        errors: ['Tool chain must be a non-empty array'],
        warnings: [],
      };
    }

    const toolChain = this.normalizeToolChain(rawToolChain);

    // Check circular dependencies if requested
    if (options.checkCircularDependencies !== false) {
      const circularErrors = this.checkCircularDependencies(toolChain);
      errors.push(...circularErrors);
    }

    // Check tool availability if requested
    if (options.checkToolAvailability !== false) {
      const availabilityErrors = this.checkToolAvailability(toolChain, availableTools);
      errors.push(...availabilityErrors);
    }

    // Check parameter compatibility if requested
    if (options.checkParameterCompatibility !== false) {
      const compatibilityWarnings = this.checkParameterCompatibility(toolChain);
      warnings.push(...compatibilityWarnings);
    }

    // Additional validation checks
    const generalErrors = this.checkGeneralValidation(toolChain);
    errors.push(...generalErrors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalizedToolChain: toolChain,
    };
  }

  private checkCircularDependencies(toolChain: any[]): string[] {
    const errors: string[] = [];
    const dependencyGraph: Record<string, string[]> = {};

    // Build dependency graph
    toolChain.forEach(step => {
      if (step.dependsOn && Array.isArray(step.dependsOn)) {
        dependencyGraph[step.id] = step.dependsOn;
      } else {
        dependencyGraph[step.id] = [];
      }
    });

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true; // Cycle detected
      }
      if (visited.has(nodeId)) {
        return false; // Already processed
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = dependencyGraph[nodeId] || [];
      for (const dep of dependencies) {
        if (hasCycle(dep)) {
          errors.push(`Circular dependency detected: ${nodeId} -> ${dep}`);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check all nodes for cycles
    Object.keys(dependencyGraph).forEach(nodeId => {
      if (!visited.has(nodeId)) {
        hasCycle(nodeId);
      }
    });

    return errors;
  }

  private checkToolAvailability(toolChain: any[], availableTools: any[]): string[] {
    const errors: string[] = [];
    const availableToolNames = new Set(availableTools.map(tool => tool.name));

    toolChain.forEach(step => {
      if (!availableToolNames.has(step.toolName)) {
        errors.push(`Tool '${step.toolName}' is not available in server '${step.serverName}'`);
      }
    });

    return errors;
  }

  private checkParameterCompatibility(toolChain: any[]): string[] {
    const warnings: string[] = [];

    toolChain.forEach((step, index) => {
      const params = step.parameters || {};

      // Check for common parameter compatibility issues
      if (typeof params !== 'object') {
        warnings.push(`Step ${step.id}: parameters should be an object`);
      }

      // Check for output mapping compatibility
      if (step.outputMapping) {
        Object.entries(step.outputMapping).forEach(([paramName, mapping]) => {
          const [sourceStepId] = (mapping as string).split('.');
          const sourceStep = toolChain.find(s => s.id === sourceStepId);

          if (!sourceStep) {
            warnings.push(`Step ${step.id}: output mapping references non-existent step '${sourceStepId}'`);
          }
        });
      }

      // Check dependency satisfaction
      if (step.dependsOn && Array.isArray(step.dependsOn)) {
        step.dependsOn.forEach((depId: string) => {
          const depStep = toolChain.find(s => s.id === depId);
          if (!depStep) {
            warnings.push(`Step ${step.id}: depends on non-existent step '${depId}'`);
          }
        });
      }
    });

    return warnings;
  }

  private checkGeneralValidation(toolChain: any[]): string[] {
    const errors: string[] = [];

    if (!Array.isArray(toolChain)) {
      errors.push('Tool chain must be an array');
      return errors;
    }

    if (toolChain.length === 0) {
      errors.push('Tool chain cannot be empty');
      return errors;
    }

    const stepIds = new Set<string>();

    toolChain.forEach((step, index) => {
      const stepId = step.id || `step_${index + 1}`;
      if (stepIds.has(stepId)) {
        errors.push(`Step ${stepId}: duplicate step ID`);
      }
      stepIds.add(stepId);

      if (!step.toolName && !step.name) {
        errors.push(`Step ${stepId}: missing required field 'toolName'`);
      }

      // Check retry configuration
      if (step.retryOnFailure && (step.maxRetries === undefined || step.maxRetries < 0)) {
        errors.push(`Step ${stepId}: retryOnFailure is true but maxRetries is not set or invalid`);
      }
    });

    return errors;
  }

  private async handleSequentialThinkingTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'brainstorming':
        const brainstormingResult = await this.brainstormingManager.generateIdeas(args);
        return {
          topic: brainstormingResult.topic,
          approach: brainstormingResult.approach,
          ideas: brainstormingResult.ideas.map(idea => ({
            id: idea.id,
            content: idea.content,
            category: idea.category,
            feasibility: idea.feasibility,
            innovation: idea.innovation,
            effort: idea.effort,
            pros: idea.pros,
            cons: idea.cons,
          })),
          evaluation: brainstormingResult.evaluation ? {
            topIdeas: brainstormingResult.evaluation.topIdeas.map(idea => ({
              id: idea.id,
              content: idea.content,
              category: idea.category,
              feasibility: idea.feasibility,
              innovation: idea.innovation,
              effort: idea.effort,
            })),
            recommendedApproach: brainstormingResult.evaluation.recommendedApproach,
            considerations: brainstormingResult.evaluation.considerations,
          } : undefined,
          timestamp: brainstormingResult.timestamp,
          metadata: brainstormingResult.metadata,
        };

      case 'workflow_orchestrator':
        const workflowResult = await this.workflowOrchestrator.executeWorkflow(args);
        return {
          workflowId: workflowResult.workflowId,
          status: workflowResult.status,
          steps: workflowResult.steps.map(step => ({
            stepId: step.stepId,
            status: step.status,
            serverName: step.serverName,
            toolName: step.toolName,
            startedAt: step.startedAt,
            completedAt: step.completedAt,
            executionTime: step.executionTime,
            result: step.result,
            error: step.error,
            retryCount: step.retryCount,
            dependencies: step.dependencies,
          })),
          overallResult: workflowResult.overallResult,
          executionTime: workflowResult.executionTime,
          startedAt: workflowResult.startedAt,
          completedAt: workflowResult.completedAt,
          error: workflowResult.error,
        };

      default:
        throw new Error(`Unknown sequential thinking tool: ${name}`);
    }
  }

  private async handleAgentTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'workflow_status': {
        const status = this.workflowOrchestrator.getWorkflowStatus(String(args.workflowId || ''));
        if (!status) return { ok: false, error: `unknown workflow '${args.workflowId}'` };
        return { ok: true, ...status };
      }

      case 'workflow_cancel': {
        const cancelled = this.workflowOrchestrator.cancelWorkflow(String(args.workflowId || ''));
        return cancelled
          ? { ok: true, workflowId: args.workflowId, status: 'cancelled' }
          : { ok: false, error: `workflow '${args.workflowId}' is not running or unknown` };
      }

      case 'agent_run': {
        if (!isAgentEnabled()) {
          return { ok: false, error: 'agent runtime disabled (engine missing and MITOSIS_AGENT_ENABLED not set; run npm run needle:fetch or set MITOSIS_AGENT_ENABLED=true)', tool: name };
        }
        const tools = this.discovery.getTools();
        const { plan, workflowId, run, state } = await runAgentWorkflow({
          task: String(args.task || ''),
          toolSchemas: tools.map(t => ({ name: t.name, description: t.description, schema: (t.inputSchema as any)?.properties ? t.inputSchema : undefined })),
          orchestrator: this.workflowOrchestrator,
          limits: {
            maxIterations: args.maxIterations || 8,
            maxToolCalls: args.maxToolCalls || 12,
            maxExecutionMs: args.maxExecutionMs || 60000,
          },
        });
        const sessionId = run.sessionId || '';
        return {
          ok: true,
          workflowId,
          sessionId,
          plan: plan.steps,
          decision: run.decision,
          toolCalls: run.toolCalls,
          iterations: run.iterations,
          escalated: run.escalated,
          escalations: run.escalations,
          stateStats: sessionId ? state.stats(sessionId) : undefined,
        };
      }

      default:
        throw new Error(`Unknown agent tool: ${name}`);
    }
  }

  private async handleTimeManagementTool(name: string, args: any): Promise<any> {    switch (name) {
      case 'get_current_time': {
        const timezone = String(args.timezone || 'UTC');
        const timeResult = this.timeManager.getCurrentTime(timezone);
        return {
          timezone: timeResult.timezone,
          datetime: timeResult.datetime,
          is_dst: timeResult.is_dst,
          day_of_week: timeResult.day_of_week,
        };
      }

      case 'convert_time': {
        const sourceTimezone = String(args.source_timezone || args.sourceTimezone || 'UTC');
        const timeStr = String(args.time || args.timeStr || '12:00');
        const targetTimezone = String(args.target_timezone || args.targetTimezone || 'UTC');
        const conversion = this.timeManager.convertTime(sourceTimezone, timeStr, targetTimezone);
        return {
          source: {
            timezone: conversion.source.timezone,
            datetime: conversion.source.datetime,
            day_of_week: conversion.source.day_of_week,
            is_dst: conversion.source.is_dst,
          },
          target: {
            timezone: conversion.target.timezone,
            datetime: conversion.target.datetime,
            day_of_week: conversion.target.day_of_week,
            is_dst: conversion.target.is_dst,
          },
          time_difference: conversion.time_difference,
        };
      }

      default:
        throw new Error(`Unknown time management tool: ${name}`);
    }
  }

  private async handlePromptResourceTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'get_prompt': {
        const id = String(args.id || args.name || args.promptId || args.query || '').trim();
        const allPrompts = this.promptRegistry.getAllPrompts();
        if (!id) {
          return {
            error: 'Missing prompt id or name',
            totalAvailable: allPrompts.length,
            availablePrompts: allPrompts.slice(0, 10).map(p => ({ id: p.id, name: p.name, category: p.category })),
          };
        }
        const prompt = this.promptRegistry.getPrompt(id) ||
          allPrompts.find(p =>
            p.id.toLowerCase() === id.toLowerCase() ||
            p.name.toLowerCase() === id.toLowerCase() ||
            p.id.toLowerCase().includes(id.toLowerCase())
          );
        return prompt || {
          error: `Prompt not found: ${id}`,
          totalAvailable: allPrompts.length,
          availablePrompts: allPrompts.slice(0, 10).map(p => p.id),
        };
      }

      case 'search_prompts': {
        const rawQ = String(args.query || args.q || args.search || args.keyword || args.keywords || args.topic || args.filter || '').trim();
        const q = rawQ.toLowerCase();
        const allPrompts = this.promptRegistry.getAllPrompts();
        
        let filteredPrompts: any[] = [];
        if (!q) {
          filteredPrompts = allPrompts;
        } else {
          const tokens = q.split(/[\s,_\-]+/).filter(t => t.length > 1);
          filteredPrompts = allPrompts.filter(p => {
            const fullText = `${p.id} ${p.name} ${p.description} ${p.category} ${p.tags ? p.tags.join(' ') : ''} ${p.useCase || ''} ${p.prompt || ''}`.toLowerCase();
            if (fullText.includes(q)) return true;
            return tokens.some(token => fullText.includes(token) || (token.startsWith('web') && fullText.includes('web')) || (token.startsWith('app') && fullText.includes('project')));
          });
        }

        if (args.category) {
          filteredPrompts = filteredPrompts.filter(p => p.category.toLowerCase() === String(args.category).toLowerCase());
        }
        if (args.complexity) {
          filteredPrompts = filteredPrompts.filter(p => p.complexity.toLowerCase() === String(args.complexity).toLowerCase());
        }

        // If specific keyword yielded 0 matches, return top related prompts so agent always gets useful templates
        const results = filteredPrompts.length > 0 ? filteredPrompts : allPrompts.slice(0, 5);

        return {
          prompts: results,
          total: results.length,
          query: rawQ,
          matchedDirectly: filteredPrompts.length > 0,
        };
      }

      case 'get_resource_set': {
        const id = String(args.id || args.name || args.resourceSetId || args.query || '').trim();
        const allSets = this.promptRegistry.getAllResourceSets();
        if (!id) {
          return {
            error: 'Missing resource set id or name',
            totalAvailable: allSets.length,
            availableResourceSets: allSets.map(rs => ({ id: rs.id, name: rs.name, category: rs.category })),
          };
        }
        const resourceSet = this.promptRegistry.getResourceSet(id) ||
          allSets.find(rs =>
            rs.id.toLowerCase() === id.toLowerCase() ||
            rs.name.toLowerCase() === id.toLowerCase() ||
            rs.id.toLowerCase().includes(id.toLowerCase())
          );
        return resourceSet || {
          error: `Resource set not found: ${id}`,
          totalAvailable: allSets.length,
          availableResourceSets: allSets.slice(0, 10).map(rs => rs.id),
        };
      }

      case 'search_resource_sets': {
        const rawQ = String(args.query || args.q || args.search || args.keyword || args.keywords || args.topic || args.filter || '').trim();
        const q = rawQ.toLowerCase();
        const allResourceSets = this.promptRegistry.getAllResourceSets();
        
        let filteredResourceSets: any[] = [];
        if (!q) {
          filteredResourceSets = allResourceSets;
        } else {
          const tokens = q.split(/[\s,_\-]+/).filter(t => t.length > 1);
          filteredResourceSets = allResourceSets.filter(rs => {
            const fullText = `${rs.id} ${rs.name} ${rs.description} ${rs.category} ${rs.tags ? rs.tags.join(' ') : ''}`.toLowerCase();
            if (fullText.includes(q)) return true;
            return tokens.some(token => fullText.includes(token) || (token.startsWith('web') && fullText.includes('dev')));
          });
        }

        if (args.category) {
          filteredResourceSets = filteredResourceSets.filter(rs => rs.category.toLowerCase() === String(args.category).toLowerCase());
        }
        if (args.complexity) {
          filteredResourceSets = filteredResourceSets.filter(rs => rs.complexity.toLowerCase() === String(args.complexity).toLowerCase());
        }

        const results = filteredResourceSets.length > 0 ? filteredResourceSets : allResourceSets.slice(0, 4);

        return {
          resourceSets: results,
          total: results.length,
          query: rawQ,
          matchedDirectly: filteredResourceSets.length > 0,
        };
      }

      default:
        throw new Error(`Unknown prompt/resource tool: ${name}`);
    }
  }

  private async handleValidationAnalysisTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'validate_tool_chain':
        const toolChain = args.toolChain || [];
        const availableTools = this.discovery.getTools();
        return this.validateToolChain(toolChain, availableTools, args);

      case 'analyze_tool_chain_performance':
        const rawChain = args.toolChain || [];
        const normalizedChain = this.normalizeToolChain(rawChain);
        return this.analyzeToolChainPerformance(normalizedChain, args);

      default:
        throw new Error(`Unknown validation/analysis tool: ${name}`);
    }
  }

  private analyzeToolChainPerformance(
    toolChain: any[],
    options: {
      includeExecutionMetrics?: boolean;
      includeComplexityAnalysis?: boolean;
      includeOptimizationSuggestions?: boolean;
    } = {}
  ): {
    metrics: {
      totalEstimatedDuration: number;
      averageComplexity: number;
      bottleneckSteps: string[];
      parallelizationPotential: number;
    };
    complexity: {
      overallComplexity: number;
      complexityDistribution: Record<string, number>;
      riskFactors: string[];
    };
    suggestions: string[];
  } {
    const opts = {
      includeExecutionMetrics: options.includeExecutionMetrics !== false,
      includeComplexityAnalysis: options.includeComplexityAnalysis !== false,
      includeOptimizationSuggestions: options.includeOptimizationSuggestions !== false,
    };

    const metrics = this.calculateExecutionMetrics(toolChain, opts);
    const complexity = this.analyzeComplexityMetrics(toolChain, opts);
    const suggestions = this.generateOptimizationSuggestions(toolChain, metrics, complexity, opts);

    return {
      metrics,
      complexity,
      suggestions,
    };
  }

  private calculateExecutionMetrics(
    toolChain: any[],
    options: any
  ): {
    totalEstimatedDuration: number;
    averageComplexity: number;
    bottleneckSteps: string[];
    parallelizationPotential: number;
  } {
    if (options.includeExecutionMetrics === false || toolChain.length === 0) {
      return {
        totalEstimatedDuration: 0,
        averageComplexity: 0,
        bottleneckSteps: [],
        parallelizationPotential: 0,
      };
    }

    let totalDuration = 0;
    let totalComplexity = 0;
    const stepDurations: Array<{ id: string; duration: number }> = [];
    const stepComplexities: Array<{ id: string; complexity: number }> = [];

    toolChain.forEach(step => {
      const duration = step.estimatedDuration || step.duration || 1000;
      const complexity = step.estimatedComplexity || step.complexity || 3;

      totalDuration += duration;
      totalComplexity += complexity;

      stepDurations.push({ id: step.id, duration });
      stepComplexities.push({ id: step.id, complexity });
    });

    // Identify bottleneck steps (top 20% slowest)
    const sortedByDuration = [...stepDurations].sort((a, b) => b.duration - a.duration);
    const bottleneckCount = Math.max(1, Math.ceil(sortedByDuration.length * 0.2));
    const bottleneckSteps = sortedByDuration.slice(0, bottleneckCount).map(s => s.id);

    // Calculate parallelization potential (steps that don't depend on each other)
    const parallelizationPotential = this.calculateParallelizationPotential(toolChain);

    return {
      totalEstimatedDuration: totalDuration,
      averageComplexity: totalComplexity / toolChain.length,
      bottleneckSteps,
      parallelizationPotential,
    };
  }

  private analyzeComplexityMetrics(
    toolChain: any[],
    options: any
  ): {
    overallComplexity: number;
    complexityDistribution: Record<string, number>;
    riskFactors: string[];
  } {
    if (options.includeComplexityAnalysis === false || toolChain.length === 0) {
      return {
        overallComplexity: 0,
        complexityDistribution: {},
        riskFactors: [],
      };
    }

    const complexities = toolChain.map(step => step.estimatedComplexity || step.complexity || 3);
    const overallComplexity = complexities.reduce((sum, c) => sum + c, 0) / complexities.length;

    // Calculate complexity distribution
    const complexityDistribution: Record<string, number> = {};
    complexities.forEach(complexity => {
      const level = complexity <= 2 ? 'low' : complexity <= 4 ? 'medium' : 'high';
      complexityDistribution[level] = (complexityDistribution[level] || 0) + 1;
    });

    // Identify risk factors
    const riskFactors: string[] = [];
    if (overallComplexity > 4) {
      riskFactors.push('High overall complexity may lead to execution failures');
    }

    const highComplexitySteps = toolChain.filter(step =>
      (step.estimatedComplexity || step.complexity || 3) >= 5
    );
    if (highComplexitySteps.length > 0) {
      riskFactors.push(`${highComplexitySteps.length} steps have high complexity and may be error-prone`);
    }

    const stepsWithRetries = toolChain.filter(step => step.retryOnFailure);
    if (stepsWithRetries.length > toolChain.length * 0.3) {
      riskFactors.push('High number of steps with retry logic may impact performance');
    }

    return {
      overallComplexity,
      complexityDistribution,
      riskFactors,
    };
  }

  private generateOptimizationSuggestions(
    toolChain: any[],
    metrics: any,
    complexity: any,
    options: any
  ): string[] {
    if (!options.includeOptimizationSuggestions) {
      return [];
    }

    const suggestions: string[] = [];

    // Duration-based suggestions
    if (metrics.bottleneckSteps.length > 0) {
      suggestions.push(`Optimize bottleneck steps: ${metrics.bottleneckSteps.join(', ')}`);
    }

    if (metrics.totalEstimatedDuration > 10000) {
      suggestions.push('Consider breaking down the tool chain into smaller, parallel workflows');
    }

    // Complexity-based suggestions
    if (complexity.overallComplexity > 4) {
      suggestions.push('Consider replacing high-complexity steps with simpler alternatives');
    }

    if (complexity.complexityDistribution.high > toolChain.length * 0.5) {
      suggestions.push('High proportion of complex steps - consider simplifying the workflow');
    }

    // Parallelization suggestions
    if (metrics.parallelizationPotential > 0.5) {
      suggestions.push(`High parallelization potential (${Math.round(metrics.parallelizationPotential * 100)}%) - consider running independent steps in parallel`);
    }

    // Dependency optimization
    const stepsWithMultipleDeps = toolChain.filter(step =>
      step.dependsOn && step.dependsOn.length > 2
    );
    if (stepsWithMultipleDeps.length > 0) {
      suggestions.push('Consider reducing dependency chains to improve execution flow');
    }

    // General suggestions
    suggestions.push('Monitor execution times and adjust duration estimates based on real performance');
    suggestions.push('Consider implementing circuit breakers for frequently failing steps');
    suggestions.push('Add timeout configurations for long-running operations');

    return suggestions;
  }

  private calculateParallelizationPotential(toolChain: any[]): number {
    if (toolChain.length <= 1) return 0;

    // Build dependency graph
    const dependencyMap: Record<string, string[]> = {};
    toolChain.forEach(step => {
      dependencyMap[step.id] = step.dependsOn || [];
    });

    // Calculate maximum parallelization
    // This is a simplified calculation - in practice, you'd need more sophisticated analysis
    let independentSteps = 0;
    const processed = new Set<string>();

    // Count steps that can run in parallel (no dependencies or dependencies already processed)
    toolChain.forEach(step => {
      const deps = dependencyMap[step.id];
      if (deps.length === 0 || deps.every((dep: string) => processed.has(dep))) {
        independentSteps++;
        processed.add(step.id);
      }
    });

    return independentSteps / toolChain.length;
  }
}
