import { z } from 'zod';
import { WorkflowStep, WorkflowOrchestratorInput } from '../types.js';

/**
 * Milestone 5 transport seam. When set (e.g. bound to
 * RequestHandlers.handleToolCall), steps execute against real tool
 * implementations. When unset, the legacy placeholder runs — existing
 * behavior is unchanged.
 */
export type MCPTransport = (
  serverName: string,
  toolName: string,
  parameters: Record<string, any>,
  signal?: AbortSignal,
) => Promise<any>;

export interface WorkflowExecutionResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'running' | 'cancelled';
  steps: WorkflowStepResult[];
  overallResult: any;
  executionTime: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  serverName: string;
  toolName: string;
  startedAt?: string;
  completedAt?: string;
  executionTime?: number;
  result?: any;
  error?: string;
  retryCount?: number;
  dependencies?: string[];
}

export class WorkflowOrchestrator {
  private activeWorkflows = new Map<string, WorkflowExecutionResult>();
  private transport?: MCPTransport;
  /** Registry guard: when set, agent-driven executeTool rejects anything not listed. */
  private allowedTools?: Set<string>;

  /** Bind the real MCP transport (e.g. RequestHandlers.handleToolCall). */
  setTransport(transport: MCPTransport): void {
    this.transport = transport;
  }

  /** Restrict agent-driven tool calls to an explicit registry. */
  setAllowedTools(tools: string[]): void {
    this.allowedTools = new Set(tools);
  }

  clearAllowedTools(): void {
    this.allowedTools = undefined;
  }

  /**
   * Safe single-tool capability for the agent runtime: registry-guarded,
   * transported, cancellable. Retries are NOT applied here — the agent loop
   * decides re-attempts from observations; workflow steps use step config.
   */
  async executeTool(toolName: string, parameters: Record<string, any> = {}, opts: { serverName?: string; signal?: AbortSignal } = {}): Promise<any> {
    if (opts.signal?.aborted) throw new Error(`tool '${toolName}' aborted before execution`);
    if (this.allowedTools && !this.allowedTools.has(toolName)) {
      throw new Error(`tool '${toolName}' is not in the agent tool registry`);
    }
    return this.callMCPServerTool(opts.serverName || 'local', toolName, parameters, opts.signal);
  }

  async executeWorkflow(input: WorkflowOrchestratorInput, signal?: AbortSignal): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const workflowId = input.workflowId;

    // Initialize workflow execution
    const execution: WorkflowExecutionResult = {
      workflowId,
      status: 'running',
      steps: [],
      overallResult: {},
      executionTime: 0,
      startedAt: new Date().toISOString(),
    };

    this.activeWorkflows.set(workflowId, execution);

    try {
      // Build execution plan
      const executionPlan = this.buildExecutionPlan(input.steps);

      // Execute steps in order
      for (const stepGroup of executionPlan) {
        if (signal?.aborted) {
          execution.status = 'cancelled';
          execution.error = 'workflow cancelled';
          break;
        }
        const stepPromises = stepGroup.map(step => this.executeStep(step, input, execution, signal));
        await Promise.all(stepPromises);
      }

      // Check if all steps completed successfully (unless cancelled mid-run)
      if (execution.status !== 'cancelled') {
        const allCompleted = execution.steps.every(step => step.status === 'completed');
        const anyFailed = execution.steps.some(step => step.status === 'failed');

        if (allCompleted && !anyFailed) {
          execution.status = 'completed';
          execution.overallResult = this.aggregateResults(execution.steps);
        } else {
          execution.status = 'failed';
          execution.error = 'One or more workflow steps failed';
        }
      }

    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error during workflow execution';
    } finally {
      execution.executionTime = Date.now() - startTime;
      execution.completedAt = new Date().toISOString();
      this.activeWorkflows.set(workflowId, execution);
    }

    return execution;
  }

  private buildExecutionPlan(steps: WorkflowStep[]): WorkflowStep[][] {
    const executed = new Set<string>();
    const inProgress = new Set<string>();
    const result: WorkflowStep[][] = [];

    while (executed.size < steps.length) {
      const currentBatch: WorkflowStep[] = [];

      for (const step of steps) {
        if (executed.has(step.id) || inProgress.has(step.id)) {
          continue;
        }

        // Check if all dependencies are satisfied
        const dependenciesSatisfied = !step.dependsOn ||
          step.dependsOn.every(depId => executed.has(depId));

        if (dependenciesSatisfied) {
          currentBatch.push(step);
          inProgress.add(step.id);
        }
      }

      if (currentBatch.length === 0) {
        // No steps can be executed - likely circular dependency
        throw new Error('Circular dependency detected or unsatisfied dependencies in workflow');
      }

      result.push(currentBatch);

      // Mark batch as executed
      currentBatch.forEach(step => {
        executed.add(step.id);
        inProgress.delete(step.id);
      });
    }

    return result;
  }

  private async executeStep(
    step: WorkflowStep,
    workflow: WorkflowOrchestratorInput,
    execution: WorkflowExecutionResult,
    signal?: AbortSignal,
  ): Promise<void> {
    const stepResult: WorkflowStepResult = {
      stepId: step.id,
      status: 'running',
      serverName: step.serverName,
      toolName: step.toolName,
      startedAt: new Date().toISOString(),
      dependencies: step.dependsOn,
    };

    execution.steps.push(stepResult);
    const maxAttempts = 1 + (step.retryOnFailure ? (step.maxRetries ?? 1) : 0);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) {
        stepResult.status = 'failed';
        stepResult.error = 'cancelled';
        stepResult.completedAt = new Date().toISOString();
        if (workflow.failFast) throw new Error('workflow cancelled');
        return;
      }
      try {
        // Resolve parameters with variable substitution and output mapping
        const resolvedParams = this.resolveParameters(step, execution.steps, workflow.variables);

        const result = await this.callMCPServerTool(step.serverName, step.toolName, resolvedParams, signal);

        stepResult.status = 'completed';
        stepResult.result = result;
        stepResult.retryCount = attempt - 1;
        stepResult.completedAt = new Date().toISOString();
        stepResult.executionTime = stepResult.completedAt && stepResult.startedAt
          ? new Date(stepResult.completedAt).getTime() - new Date(stepResult.startedAt).getTime()
          : 0;
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        stepResult.retryCount = attempt - 1;
        if (attempt >= maxAttempts) {
          stepResult.status = 'failed';
          stepResult.error = message;
          stepResult.completedAt = new Date().toISOString();
          // If failFast is enabled, stop the entire workflow
          if (workflow.failFast) throw error;
          return;
        }
        // Otherwise fall through and actually retry.
      }
    }
  }

  private resolveParameters(
    step: WorkflowStep,
    completedSteps: WorkflowStepResult[],
    globalVariables?: Record<string, any>
  ): Record<string, any> {
    const resolved = { ...step.parameters };

    // Substitute global variables
    if (globalVariables) {
      Object.keys(resolved).forEach(key => {
        if (typeof resolved[key] === 'string' && resolved[key].startsWith('$')) {
          const varName = resolved[key].substring(1);
          if (globalVariables[varName] !== undefined) {
            resolved[key] = globalVariables[varName];
          }
        }
      });
    }

    // Apply output mapping from dependent steps
    if (step.outputMapping) {
      Object.entries(step.outputMapping).forEach(([paramName, outputPath]) => {
        const [stepId, outputKey] = outputPath.split('.');
        const sourceStep = completedSteps.find(s => s.stepId === stepId);

        if (sourceStep && sourceStep.result && sourceStep.result[outputKey] !== undefined) {
          resolved[paramName] = sourceStep.result[outputKey];
        }
      });
    }

    return resolved;
  }

  private async callMCPServerTool(
    serverName: string,
    toolName: string,
    parameters: Record<string, any>,
    signal?: AbortSignal,
  ): Promise<any> {
    if (signal?.aborted) throw new Error(`tool '${toolName}' aborted`);
    // Real transport when bound (Milestone 5); legacy placeholder otherwise.
    if (this.transport) {
      return this.transport(serverName, toolName, parameters, signal);
    }

    // Instant execution for local runner
    await new Promise(resolve => setTimeout(resolve, 5));

    // Response based on tool type
    if (toolName === 'google_search') {
      return {
        searchInfo: { totalResults: '1000000', searchTime: 0.05 },
        items: [
          {
            title: `Search result for ${parameters.q || parameters.query}`,
            link: `https://example.com/search`,
            snippet: `Search result snippet for ${parameters.q || parameters.query}`,
          }
        ]
      };
    }

    if (toolName === 'initialize_memory') {
      return { message: 'Memory system initialized successfully' };
    }

    // Generic success response
    return {
      success: true,
      message: `${toolName} executed successfully on ${serverName}`,
      parameters: parameters,
      timestamp: new Date().toISOString(),
    };
  }

  private aggregateResults(steps: WorkflowStepResult[]): any {
    const aggregated: any = {};

    // Aggregate results by step
    steps.forEach(step => {
      if (step.result) {
        aggregated[step.stepId] = step.result;
      }
    });

    // Create summary
    aggregated.summary = {
      totalSteps: steps.length,
      completedSteps: steps.filter(s => s.status === 'completed').length,
      failedSteps: steps.filter(s => s.status === 'failed').length,
      totalExecutionTime: steps.reduce((sum, s) => sum + (s.executionTime || 0), 0),
    };

    return aggregated;
  }

  getWorkflowStatus(workflowId: string): WorkflowExecutionResult | null {
    return this.activeWorkflows.get(workflowId) || null;
  }

  cancelWorkflow(workflowId: string): boolean {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow && workflow.status === 'running') {
      workflow.status = 'cancelled';
      workflow.completedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  getActiveWorkflows(): string[] {
    return Array.from(this.activeWorkflows.keys()).filter(id => {
      const workflow = this.activeWorkflows.get(id);
      return workflow && workflow.status === 'running';
    });
  }

  getStats(): { activeWorkflows: number; completedWorkflows: number; failedWorkflows: number; total: number } {
    const all = Array.from(this.activeWorkflows.values());
    return {
      activeWorkflows: all.filter(w => w.status === 'running').length,
      completedWorkflows: all.filter(w => w.status === 'completed').length,
      failedWorkflows: all.filter(w => w.status === 'failed').length,
      total: all.length,
    };
  }
}
