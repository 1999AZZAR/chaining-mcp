/**
 * Reliability Manager for Chaining MCP Server
 *
 * Provides enhanced error handling, validation, retry logic, and monitoring
 * to ensure robust operation across multiple use cases.
 */

export interface ReliabilityMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  lastError?: {
    timestamp: Date;
    tool: string;
    error: string;
  };
}

export interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export class ReliabilityManager {
  private metrics: ReliabilityMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    errorRate: 0,
    uptime: 0,
  };

  private requestHistory: Array<{
    timestamp: Date;
    tool: string;
    duration: number;
    success: boolean;
    error?: string;
  }> = [];

  private retryConfig: RetryConfig = {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
    maxDelay: 30000,
  };

  private startTime: Date = new Date();

  constructor() {
    this.initializeMetrics();
  }

  /**
   * Initialize reliability metrics
   */
  private initializeMetrics(): void {
    const timer = setInterval(() => {
      this.metrics.uptime = Date.now() - this.startTime.getTime();
      this.updateErrorRate();
    }, 60000); // Update every minute
    if (typeof timer.unref === 'function') timer.unref();
  }

  /**
   * Execute a function with retry logic and error handling
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    toolName: string,
    context?: string
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        this.metrics.totalRequests++;
        const result = await operation();

        // Record successful request
        const duration = Date.now() - startTime;
        this.recordRequest(toolName, duration, true);
        this.metrics.successfulRequests++;

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const duration = Date.now() - startTime;

        console.warn(`Attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1} failed for ${toolName}:`, lastError.message);

        // Record failed attempt
        this.recordRequest(toolName, duration, false, lastError.message);

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelay
        );

        console.error(`Retrying ${toolName} in ${delay}ms...`);
        await this.delay(delay);
      }
    }

    // All retries failed
    this.metrics.failedRequests++;
    this.metrics.lastError = {
      timestamp: new Date(),
      tool: toolName,
      error: lastError?.message || 'Unknown error',
    };

    throw new Error(`Operation failed after ${this.retryConfig.maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Validate input parameters with enhanced error messages
   */
  validateInput<T>(schema: any, input: any, toolName: string): T {
    try {
      if (!input || typeof input !== 'object') {
        throw new Error('Input must be a valid object');
      }

      // Use Zod schema validation if available
      if (schema && typeof schema.parse === 'function') {
        return schema.parse(input);
      }

      // Basic validation for common patterns
      return this.basicValidation(input, toolName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Validation failed for ${toolName}: ${errorMessage}. Please check your input parameters.`);
    }
  }

  /**
   * Basic validation for common input patterns
   */
  private basicValidation<T>(input: any, toolName: string): T {
    // Check for required string fields that are empty
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.trim().length === 0) {
        throw new Error(`Parameter '${key}' cannot be empty`);
      }
    }

    return input as T;
  }

  /**
   * Enhanced error formatting with context and suggestions
   */
  formatEnhancedError(error: unknown, toolName: string, args: any): string {
    const timestamp = new Date().toISOString();
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    const errorMessage = error instanceof Error ? error.message : String(error);

    let context = '';
    if (args && Object.keys(args).length > 0) {
      context = `\nArguments: ${JSON.stringify(args, null, 2)}`;
    }

    let suggestions = this.getErrorSuggestions(toolName, errorMessage);

    return `[${timestamp}] Tool Error: ${toolName}
Error Type: ${errorType}
Message: ${errorMessage}${context}
${suggestions}

Please check the tool parameters and try again. If the issue persists, check the server logs for more details.`;
  }

  /**
   * Get helpful suggestions based on error type and tool
   */
  private getErrorSuggestions(toolName: string, errorMessage: string): string {
    const suggestions: string[] = [];

    // Tool-specific suggestions
    if (toolName.includes('search') && errorMessage.includes('not found')) {
      suggestions.push('• Try using broader search terms');
      suggestions.push('• Check spelling and capitalization');
      suggestions.push('• Use partial matches instead of exact terms');
    }

    if (toolName.includes('file') && errorMessage.includes('not found')) {
      suggestions.push('• Verify the file path exists');
      suggestions.push('• Check file permissions');
      suggestions.push('• Use relative paths from the project root');
    }

    if (errorMessage.includes('timeout')) {
      suggestions.push('• The operation may be taking longer than expected');
      suggestions.push('• Try breaking the task into smaller steps');
      suggestions.push('• Check network connectivity for external operations');
    }

    if (errorMessage.includes('validation')) {
      suggestions.push('• Check parameter types and formats');
      suggestions.push('• Ensure required parameters are provided');
      suggestions.push('• Review the tool documentation for correct usage');
    }

    // Generic suggestions
    if (suggestions.length === 0) {
      suggestions.push('• Verify all required parameters are provided');
      suggestions.push('• Check parameter types and formats');
      suggestions.push('• Ensure the tool is available and properly configured');
    }

    return `Suggestions:\n${suggestions.join('\n')}`;
  }

  /**
   * Record a request in the history
   */
  private recordRequest(tool: string, duration: number, success: boolean, error?: string): void {
    this.requestHistory.push({
      timestamp: new Date(),
      tool,
      duration,
      success,
      error,
    });

    // Keep only last 1000 requests to prevent memory issues
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-1000);
    }

    // Update average response time
    this.updateAverageResponseTime();
  }

  /**
   * Update average response time based on recent requests
   */
  private updateAverageResponseTime(): void {
    const recentRequests = this.requestHistory.slice(-100); // Last 100 requests
    if (recentRequests.length > 0) {
      const totalDuration = recentRequests.reduce((sum, req) => sum + req.duration, 0);
      this.metrics.averageResponseTime = totalDuration / recentRequests.length;
    }
  }

  /**
   * Update error rate based on recent requests
   */
  private updateErrorRate(): void {
    const recentRequests = this.requestHistory.slice(-100); // Last 100 requests
    if (recentRequests.length > 0) {
      const errorCount = recentRequests.filter(req => !req.success).length;
      this.metrics.errorRate = errorCount / recentRequests.length;
    }
  }

  /**
   * Get comprehensive reliability metrics
   */
  getMetrics(): ReliabilityMetrics & {
    recentRequests: Array<{
      timestamp: Date;
      tool: string;
      duration: number;
      success: boolean;
      error?: string;
    }>;
    uptimeFormatted: string;
  } {
    return {
      ...this.metrics,
      recentRequests: this.requestHistory.slice(-50), // Last 50 requests
      uptimeFormatted: this.formatUptime(this.metrics.uptime),
    };
  }

  /**
   * Format uptime duration
   */
  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Health check for the reliability system
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    metrics: Partial<ReliabilityMetrics>;
  } {
    const errorRate = this.metrics.errorRate;
    const avgResponseTime = this.metrics.averageResponseTime;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'System is operating normally';

    if (errorRate > 0.5) { // More than 50% error rate
      status = 'unhealthy';
      message = 'High error rate detected';
    } else if (errorRate > 0.2) { // More than 20% error rate
      status = 'degraded';
      message = 'Elevated error rate detected';
    }

    if (avgResponseTime > 30000) { // More than 30 seconds average
      status = status === 'healthy' ? 'degraded' : status;
      message += status === 'degraded' ? ' and ' : '';
      message += 'Slow response times detected';
    }

    return {
      status,
      message,
      metrics: {
        totalRequests: this.metrics.totalRequests,
        errorRate: this.metrics.errorRate,
        averageResponseTime: this.metrics.averageResponseTime,
        uptime: this.metrics.uptime,
      },
    };
  }

  /**
   * Reset error metrics (useful for testing or after configuration changes)
   */
  resetMetrics(): void {
    this.metrics.failedRequests = 0;
    this.metrics.lastError = undefined;
    this.requestHistory = this.requestHistory.filter(req => req.success);
    this.updateErrorRate();
  }

  /**
   * Configure retry behavior
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Utility method for delays
   */
  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}
