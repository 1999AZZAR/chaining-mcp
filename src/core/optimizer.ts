import { ToolInfo, RouteSuggestion, OptimizationCriteria, SequentialThinkingRequest } from '../types.js';

export class SmartRouteOptimizer {
  private tools: Map<string, ToolInfo> = new Map();
  private patternMemory: Map<string, PatternData> = new Map();
  private successHistory: SuccessRecord[] = [];
  private adaptiveWeights: AdaptiveWeights = {
    speed: 0.3,
    simplicity: 0.3,
    reliability: 0.4,
    creativity: 0.2,
    innovation: 0.1,
  };

  constructor(tools: ToolInfo[] = []) {
    this.setTools(tools);
    this.initializePatternRecognition();
  }

  /**
   * Set the available tools for optimization with intelligent analysis
   */
  setTools(tools: ToolInfo[]): void {
    this.tools.clear();
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
    this.analyzeToolPatterns();
    this.updateAdaptiveWeights();
  }

  /**
   * Initialize pattern recognition system
   */
  private initializePatternRecognition(): void {
    // Initialize with common successful patterns
    this.patternMemory.set('file_processing', {
      pattern: ['read_file', 'process_data', 'write_file'],
      successRate: 0.85,
      avgDuration: 2000,
      complexity: 3,
      contexts: ['data_processing', 'file_management'],
    });

    this.patternMemory.set('web_research', {
      pattern: ['web_search', 'analyze_content', 'extract_insights'],
      successRate: 0.78,
      avgDuration: 3000,
      complexity: 4,
      contexts: ['research', 'information_gathering'],
    });

    this.patternMemory.set('creative_analysis', {
      pattern: ['sequential_thinking', 'pattern_analysis', 'synthesis'],
      successRate: 0.92,
      avgDuration: 4000,
      complexity: 6,
      contexts: ['complex_analysis', 'creative_problem_solving'],
    });
  }

  /**
   * Analyze tool patterns for intelligent optimization
   */
  private analyzeToolPatterns(): void {
    const toolCategories = new Map<string, ToolInfo[]>();

    // Group tools by category
    for (const tool of this.tools.values()) {
      const category = tool.category || 'uncategorized';
      if (!toolCategories.has(category)) {
        toolCategories.set(category, []);
      }
      toolCategories.get(category)!.push(tool);
    }

    // Analyze inter-category synergies
    this.analyzeCategorySynergies(toolCategories);

    // Identify high-performing tool combinations
    this.identifyHighPerformingCombinations();
  }

  /**
   * Analyze synergies between tool categories
   */
  private analyzeCategorySynergies(toolCategories: Map<string, ToolInfo[]>): void {
    const categories = Array.from(toolCategories.keys());

    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const category1 = categories[i];
        const category2 = categories[j];
        const synergy = this.calculateCategorySynergy(
          toolCategories.get(category1)!,
          toolCategories.get(category2)!
        );

        if (synergy > 0.7) {
          this.patternMemory.set(`${category1}_${category2}_synergy`, {
            pattern: [category1, category2],
            successRate: synergy,
            avgDuration: this.calculateSynergyDuration(category1, category2),
            complexity: this.calculateSynergyComplexity(category1, category2),
            contexts: ['cross_domain', 'multi_category'],
          });
        }
      }
    }
  }

  /**
   * Calculate synergy between two tool categories
   */
  private calculateCategorySynergy(tools1: ToolInfo[], tools2: ToolInfo[]): number {
    // Simple synergy calculation based on complementary functionality
    const avgComplexity1 = tools1.reduce((sum, t) => sum + (t.estimatedComplexity || 1), 0) / tools1.length;
    const avgComplexity2 = tools2.reduce((sum, t) => sum + (t.estimatedComplexity || 1), 0) / tools2.length;

    // Synergy is higher when complexities are complementary
    const complexitySynergy = 1 - Math.abs(avgComplexity1 - avgComplexity2) / 10;

    // Synergy is higher when categories are different (cross-domain)
    const categorySynergy = tools1[0]?.category !== tools2[0]?.category ? 0.8 : 0.4;

    return (complexitySynergy + categorySynergy) / 2;
  }

  /**
   * Identify high-performing tool combinations
   */
  private identifyHighPerformingCombinations(): void {
    const tools = Array.from(this.tools.values());

    // Analyze 2-tool combinations
    for (let i = 0; i < tools.length; i++) {
      for (let j = i + 1; j < tools.length; j++) {
        const combination = [tools[i], tools[j]];
        const performance = this.evaluateCombinationPerformance(combination);

        if (performance > 0.8) {
          const key = `${tools[i].name}_${tools[j].name}`;
          this.patternMemory.set(key, {
            pattern: [tools[i].name, tools[j].name],
            successRate: performance,
            avgDuration: (tools[i].estimatedDuration || 1000) + (tools[j].estimatedDuration || 1000),
            complexity: ((tools[i].estimatedComplexity || 1) + (tools[j].estimatedComplexity || 1)) / 2,
            contexts: ['high_performance', 'optimized_pair'],
          });
        }
      }
    }
  }

  /**
   * Evaluate performance of a tool combination
   */
  private evaluateCombinationPerformance(tools: ToolInfo[]): number {
    let score = 0.5; // Base score

    // Duration optimization
    const avgDuration = tools.reduce((sum, t) => sum + (t.estimatedDuration || 1000), 0) / tools.length;
    if (avgDuration < 2000) score += 0.2;
    else if (avgDuration > 5000) score -= 0.1;

    // Complexity balance
    const avgComplexity = tools.reduce((sum, t) => sum + (t.estimatedComplexity || 1), 0) / tools.length;
    if (avgComplexity >= 3 && avgComplexity <= 6) score += 0.2;
    else if (avgComplexity > 8) score -= 0.1;

    // Category diversity bonus
    const categories = new Set(tools.map(t => t.category));
    if (categories.size > 1) score += 0.1;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Update adaptive weights based on success history
   */
  private updateAdaptiveWeights(): void {
    if (this.successHistory.length < 5) return;

    const recentSuccesses = this.successHistory.slice(-10);
    const avgSuccessRate = recentSuccesses.reduce((sum, r) => sum + r.successRate, 0) / recentSuccesses.length;

    // Adjust weights based on what's working
    if (avgSuccessRate > 0.8) {
      this.adaptiveWeights.reliability += 0.05;
      this.adaptiveWeights.creativity += 0.03;
    } else if (avgSuccessRate < 0.6) {
      this.adaptiveWeights.speed += 0.05;
      this.adaptiveWeights.simplicity += 0.05;
    }

    // Normalize weights
    const total = Object.values(this.adaptiveWeights).reduce((sum, w) => sum + w, 0);
    for (const key in this.adaptiveWeights) {
      this.adaptiveWeights[key as keyof AdaptiveWeights] /= total;
    }
  }

  /**
   * Generate optimal routes for a given task using intelligent pattern recognition
   */
  async generateRoutes(
    task: string,
    criteria: OptimizationCriteria = {
      prioritizeSpeed: false,
      prioritizeSimplicity: false,
      prioritizeReliability: false,
    }
  ): Promise<RouteSuggestion[]> {
    const suggestions: RouteSuggestion[] = [];

    // Analyze the task with intelligent pattern matching
    const taskAnalysis = this.analyzeTaskIntelligently(task);

    // Find matching patterns from memory
    const matchingPatterns = this.findMatchingPatterns(taskAnalysis);

    // Generate intelligent strategies based on patterns
    const strategies = this.generateIntelligentStrategies(taskAnalysis, criteria, matchingPatterns);

    // Generate creative alternatives
    const creativeStrategies = this.generateCreativeStrategies(taskAnalysis, criteria);

    // Build routes from all strategies
    for (const strategy of [...strategies, ...creativeStrategies]) {
      const route = await this.buildIntelligentRoute(strategy, criteria, taskAnalysis);
      if (route) {
        suggestions.push(route);
      }
    }

    // Fallback route if none matched exact tool names
    if (suggestions.length === 0 && this.tools.size > 0) {
      const availableTools = Array.from(this.tools.values());
      const selected = availableTools.slice(0, Math.min(3, availableTools.length));
      suggestions.push({
        id: `fallback_route_${Date.now()}`,
        name: 'Standard Route',
        description: 'Recommended execution route based on available tools',
        tools: selected,
        estimatedDuration: selected.reduce((sum, t) => sum + (t.estimatedDuration || 500), 0),
        complexity: Math.round(selected.reduce((sum, t) => sum + (t.estimatedComplexity || 2), 0) / selected.length),
        confidence: 0.85,
        reasoning: `Auto-selected ${selected.length} suitable tools for task: "${task}"`,
      });
    }

    // Sort suggestions using adaptive weights
    return this.sortSuggestionsIntelligently(suggestions, criteria);
  }

  /**
   * Analyze task with intelligent pattern recognition
   */
  private analyzeTaskIntelligently(task: string): IntelligentTaskAnalysis {
    const basicAnalysis = this.analyzeTask(task);
    const keywords = task.toLowerCase();

    // Enhanced analysis with pattern recognition
    const patterns = this.identifyTaskPatterns(keywords);
    const complexity = this.assessIntelligentComplexity(task, patterns);
    const creativity = this.assessCreativityPotential(task, patterns);

    return {
      ...basicAnalysis,
      patterns,
      intelligentComplexity: complexity,
      creativityPotential: creativity,
      suggestedApproaches: this.suggestApproaches(patterns, complexity),
    };
  }

  /**
   * Find matching patterns from pattern memory
   */
  private findMatchingPatterns(analysis: IntelligentTaskAnalysis): PatternData[] {
    const matchingPatterns: PatternData[] = [];

    for (const [key, pattern] of this.patternMemory) {
      const relevance = this.calculatePatternRelevance(pattern, analysis);
      if (relevance > 0.6) {
        matchingPatterns.push({ ...pattern, relevance });
      }
    }

    return matchingPatterns.sort((a, b) => (b as any).relevance - (a as any).relevance);
  }

  /**
   * Generate intelligent strategies based on patterns
   */
  private generateIntelligentStrategies(
    analysis: IntelligentTaskAnalysis,
    criteria: OptimizationCriteria,
    patterns: PatternData[]
  ): IntelligentStrategy[] {
    const strategies: IntelligentStrategy[] = [];

    // Pattern-based strategy
    if (patterns.length > 0) {
      const bestPattern = patterns[0];
      strategies.push({
        name: 'Pattern-Based',
        description: `Uses proven pattern: ${bestPattern.pattern.join(' → ')}`,
        tools: bestPattern.pattern,
        priority: 1,
        confidence: bestPattern.successRate,
        innovation: 0.3,
        creativity: 0.4,
      });
    }

    // Adaptive strategy based on success history
    strategies.push({
      name: 'Adaptive',
      description: 'Learns from success patterns and adapts approach',
      tools: this.generateAdaptiveTools(analysis, criteria),
      priority: 2,
      confidence: this.calculateAdaptiveConfidence(),
      innovation: 0.6,
      creativity: 0.5,
    });

    // Cross-domain strategy
    if (analysis.patterns.length > 1) {
      strategies.push({
        name: 'Cross-Domain',
        description: 'Combines multiple domains for innovative solutions',
        tools: this.generateCrossDomainTools(analysis),
        priority: 3,
        confidence: 0.7,
        innovation: 0.8,
        creativity: 0.9,
      });
    }

    return strategies;
  }

  /**
   * Generate creative strategies for innovative solutions
   */
  private generateCreativeStrategies(
    analysis: IntelligentTaskAnalysis,
    criteria: OptimizationCriteria
  ): IntelligentStrategy[] {
    const strategies: IntelligentStrategy[] = [];

    // Serendipity strategy
    strategies.push({
      name: 'Serendipity',
      description: 'Explores unexpected tool combinations for creative breakthroughs',
      tools: this.generateSerendipitousTools(analysis),
      priority: 4,
      confidence: 0.5,
      innovation: 0.9,
      creativity: 1.0,
    });

    // Reverse engineering strategy
    strategies.push({
      name: 'Reverse Engineering',
      description: 'Works backwards from desired outcome to find optimal path',
      tools: this.generateReverseEngineeringTools(analysis),
      priority: 5,
      confidence: 0.6,
      innovation: 0.7,
      creativity: 0.8,
    });

    return strategies;
  }

  /**
   * Analyze a task to understand its requirements
   */
  private analyzeTask(task: string): TaskAnalysis {
    const keywords = task.toLowerCase();

    return {
      requiresFileOperations: keywords.includes('file') || keywords.includes('read') || keywords.includes('write'),
      requiresWebSearch: keywords.includes('search') || keywords.includes('web') || keywords.includes('find'),
      requiresAnalysis: keywords.includes('analyze') || keywords.includes('think') || keywords.includes('reason'),
      requiresDataProcessing: keywords.includes('process') || keywords.includes('transform') || keywords.includes('convert'),
      complexity: this.estimateTaskComplexity(task),
      estimatedDuration: this.estimateTaskDuration(task),
    };
  }

  /**
   * Estimate task complexity based on keywords and length
   */
  private estimateTaskComplexity(task: string): number {
    let complexity = 1;

    // Base complexity from task length
    complexity += Math.min(task.length / 100, 3);

    // Add complexity for different operation types
    const operations = [
      'file', 'search', 'analyze', 'process', 'transform',
      'convert', 'generate', 'create', 'update', 'delete'
    ];

    for (const op of operations) {
      if (task.toLowerCase().includes(op)) {
        complexity += 1;
      }
    }

    return Math.min(Math.max(complexity, 1), 10);
  }

  /**
   * Estimate task duration based on complexity
   */
  private estimateTaskDuration(task: string): number {
    const complexity = this.estimateTaskComplexity(task);
    return complexity * 1000; // Base duration in milliseconds
  }

  /**
   * Generate different strategies for completing the task
   */
  private generateStrategies(analysis: TaskAnalysis, criteria: OptimizationCriteria): IntelligentStrategy[] {
    const strategies: IntelligentStrategy[] = [];

    // Simple strategy - minimal tools
    if (criteria.prioritizeSimplicity || analysis.complexity <= 3) {
      strategies.push({
        name: 'Simple',
        description: 'Minimal tool usage for straightforward execution',
        tools: this.selectMinimalTools(analysis),
        priority: criteria.prioritizeSimplicity ? 1 : 3,
        confidence: 0.8,
        innovation: 0.2,
        creativity: 0.3,
      });
    }

    // Fast strategy - optimized for speed
    if (criteria.prioritizeSpeed || analysis.complexity <= 5) {
      strategies.push({
        name: 'Fast',
        description: 'Optimized for speed and efficiency',
        tools: this.selectFastTools(analysis),
        priority: criteria.prioritizeSpeed ? 1 : 2,
        confidence: 0.75,
        innovation: 0.3,
        creativity: 0.4,
      });
    }

    // Comprehensive strategy - thorough execution
    if (analysis.complexity >= 4) {
      strategies.push({
        name: 'Comprehensive',
        description: 'Thorough execution with multiple validation steps',
        tools: this.selectComprehensiveTools(analysis),
        priority: 2,
        confidence: 0.7,
        innovation: 0.5,
        creativity: 0.6,
      });
    }

    // Sequential thinking strategy for complex tasks
    if (analysis.requiresAnalysis && analysis.complexity >= 6) {
      strategies.push({
        name: 'Sequential Thinking',
        description: 'Uses sequential thinking for complex analysis',
        tools: this.selectSequentialThinkingTools(analysis),
        priority: 1,
        confidence: 0.9,
        innovation: 0.8,
        creativity: 0.9,
      });
    }

    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Select minimal tools for simple execution
   */
  private selectMinimalTools(analysis: TaskAnalysis): string[] {
    const tools: string[] = [];

    if (analysis.requiresFileOperations) {
      tools.push('read_file');
    }

    if (analysis.requiresWebSearch) {
      tools.push('web_search');
    }

    return tools.slice(0, 2); // Limit to 2 tools for simplicity
  }

  /**
   * Select tools optimized for speed
   */
  private selectFastTools(analysis: TaskAnalysis): string[] {
    const tools: string[] = [];

    // Select tools with lowest estimated duration
    const availableTools = Array.from(this.tools.values());
    const relevantTools = availableTools.filter(tool =>
      this.isToolRelevant(tool, analysis)
    );

    const sortedTools = relevantTools.sort((a, b) =>
      (a.estimatedDuration || 1000) - (b.estimatedDuration || 1000)
    );

    return sortedTools.slice(0, 3).map(tool => tool.name);
  }

  /**
   * Select comprehensive tools for thorough execution
   */
  private selectComprehensiveTools(analysis: TaskAnalysis): string[] {
    const tools: string[] = [];

    if (analysis.requiresFileOperations) {
      tools.push('read_file', 'write_file');
    }

    if (analysis.requiresWebSearch) {
      tools.push('web_search');
    }

    if (analysis.requiresAnalysis) {
      tools.push('sequential_thinking');
    }

    return tools;
  }

  /**
   * Select tools that work well for complex analysis. No external
   * sequential-thinking tool: thinking is Needle-backed in Mitosis, so this
   * only suggests registry tools for the analysis step.
   */
  private selectSequentialThinkingTools(analysis: TaskAnalysis): string[] {
    const tools: string[] = [];

    // Add supporting tools
    if (analysis.requiresFileOperations) {
      tools.push('read_file');
    }

    if (analysis.requiresWebSearch) {
      tools.push('web_search');
    }

    return tools;
  }

  /**
   * Check if a tool is relevant to the task analysis
   */
  private isToolRelevant(tool: ToolInfo, analysis: TaskAnalysis): boolean {
    const category = tool.category?.toLowerCase() || '';

    if (analysis.requiresFileOperations && category.includes('filesystem')) {
      return true;
    }

    if (analysis.requiresWebSearch && category.includes('web')) {
      return true;
    }

    if (analysis.requiresAnalysis && category.includes('analysis')) {
      return true;
    }

    return false;
  }

  /**
   * Build a complete route from a strategy
   */
  private async buildRoute(strategy: IntelligentStrategy, criteria: OptimizationCriteria): Promise<RouteSuggestion | null> {
    const tools: ToolInfo[] = [];
    let totalDuration = 0;
    let totalComplexity = 0;

    for (const toolName of strategy.tools) {
      const tool = this.tools.get(toolName);
      if (tool) {
        tools.push(tool);
        totalDuration += tool.estimatedDuration || 1000;
        totalComplexity += tool.estimatedComplexity || 1;
      }
    }

    if (tools.length === 0) {
      return null;
    }

    // Calculate confidence based on tool availability and criteria match
    const confidence = this.calculateConfidence(tools, criteria);

    // Generate reasoning for the route
    const reasoning = this.generateReasoning(strategy, tools, criteria);

    return {
      id: `route_${strategy.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      name: strategy.name,
      description: strategy.description,
      tools,
      estimatedDuration: totalDuration,
      complexity: Math.min(totalComplexity / tools.length, 10),
      confidence,
      reasoning,
    };
  }

  /**
   * Calculate confidence score for a route
   */
  private calculateConfidence(tools: ToolInfo[], criteria: OptimizationCriteria): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if tools match criteria
    if (criteria.prioritizeSpeed) {
      const avgDuration = tools.reduce((sum, tool) => sum + (tool.estimatedDuration || 1000), 0) / tools.length;
      if (avgDuration < 1500) confidence += 0.2;
    }

    if (criteria.prioritizeSimplicity) {
      const avgComplexity = tools.reduce((sum, tool) => sum + (tool.estimatedComplexity || 1), 0) / tools.length;
      if (avgComplexity < 3) confidence += 0.2;
    }

    if (criteria.prioritizeReliability) {
      // Assume tools with lower complexity are more reliable
      const avgComplexity = tools.reduce((sum, tool) => sum + (tool.estimatedComplexity || 1), 0) / tools.length;
      if (avgComplexity < 4) confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate reasoning for a route suggestion
   */
  private generateReasoning(strategy: IntelligentStrategy, tools: ToolInfo[], criteria: OptimizationCriteria): string {
    const reasons: string[] = [];

    reasons.push(`This route uses the ${strategy.name} strategy`);

    if (criteria.prioritizeSpeed) {
      const avgDuration = tools.reduce((sum, tool) => sum + (tool.estimatedDuration || 1000), 0) / tools.length;
      reasons.push(`optimized for speed (avg duration: ${avgDuration}ms)`);
    }

    if (criteria.prioritizeSimplicity) {
      const avgComplexity = tools.reduce((sum, tool) => sum + (tool.estimatedComplexity || 1), 0) / tools.length;
      reasons.push(`prioritizing simplicity (avg complexity: ${avgComplexity.toFixed(1)})`);
    }

    if (criteria.prioritizeReliability) {
      reasons.push('with focus on reliability');
    }

    reasons.push(`using ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);

    return reasons.join(', ');
  }

  /**
   * Sort suggestions based on optimization criteria
   */
  private sortSuggestions(suggestions: RouteSuggestion[], criteria: OptimizationCriteria): RouteSuggestion[] {
    return suggestions.sort((a, b) => {
      // Primary sort by criteria
      if (criteria.prioritizeSpeed) {
        return a.estimatedDuration - b.estimatedDuration;
      }

      if (criteria.prioritizeSimplicity) {
        return a.complexity - b.complexity;
      }

      if (criteria.prioritizeReliability) {
        return b.confidence - a.confidence;
      }

      // Default sort by confidence
      return b.confidence - a.confidence;
    });
  }

  /**
   * Calculate synergy duration between categories
   */
  private calculateSynergyDuration(category1: string, category2: string): number {
    const tools1 = Array.from(this.tools.values()).filter(t => t.category === category1);
    const tools2 = Array.from(this.tools.values()).filter(t => t.category === category2);

    const avgDuration1 = tools1.reduce((sum, t) => sum + (t.estimatedDuration || 1000), 0) / tools1.length;
    const avgDuration2 = tools2.reduce((sum, t) => sum + (t.estimatedDuration || 1000), 0) / tools2.length;

    return (avgDuration1 + avgDuration2) / 2;
  }

  /**
   * Calculate synergy complexity between categories
   */
  private calculateSynergyComplexity(category1: string, category2: string): number {
    const tools1 = Array.from(this.tools.values()).filter(t => t.category === category1);
    const tools2 = Array.from(this.tools.values()).filter(t => t.category === category2);

    const avgComplexity1 = tools1.reduce((sum, t) => sum + (t.estimatedComplexity || 1), 0) / tools1.length;
    const avgComplexity2 = tools2.reduce((sum, t) => sum + (t.estimatedComplexity || 1), 0) / tools2.length;

    return (avgComplexity1 + avgComplexity2) / 2;
  }

  /**
   * Identify task patterns from keywords
   */
  private identifyTaskPatterns(keywords: string): string[] {
    const patterns: string[] = [];

    if (keywords.includes('file') || keywords.includes('read') || keywords.includes('write')) {
      patterns.push('file_processing');
    }
    if (keywords.includes('search') || keywords.includes('web') || keywords.includes('find')) {
      patterns.push('web_research');
    }
    if (keywords.includes('analyze') || keywords.includes('think') || keywords.includes('reason')) {
      patterns.push('creative_analysis');
    }
    if (keywords.includes('create') || keywords.includes('generate') || keywords.includes('build')) {
      patterns.push('creation');
    }

    return patterns;
  }

  /**
   * Assess intelligent complexity
   */
  private assessIntelligentComplexity(task: string, patterns: string[]): number {
    let complexity = 1;

    complexity += patterns.length * 0.5;
    complexity += Math.min(task.length / 200, 2);

    return Math.min(complexity, 10);
  }

  /**
   * Assess creativity potential
   */
  private assessCreativityPotential(task: string, patterns: string[]): number {
    const creativeKeywords = ['innovative', 'creative', 'novel', 'unique', 'original'];
    const hasCreativeKeywords = creativeKeywords.some(keyword => task.toLowerCase().includes(keyword));

    let creativity = 0.3; // Base creativity
    if (hasCreativeKeywords) creativity += 0.3;
    if (patterns.length > 2) creativity += 0.2; // Cross-domain potential
    if (task.length > 100) creativity += 0.2; // Complex problem potential

    return Math.min(creativity, 1.0);
  }

  /**
   * Suggest approaches based on patterns and complexity
   */
  private suggestApproaches(patterns: string[], complexity: number): string[] {
    const approaches: string[] = [];

    if (patterns.includes('file_processing')) approaches.push('systematic_file_handling');
    if (patterns.includes('web_research')) approaches.push('iterative_research');
    if (patterns.includes('creative_analysis')) approaches.push('lateral_thinking');
    if (complexity > 6) approaches.push('sequential_breakdown');

    return approaches;
  }

  /**
   * Calculate pattern relevance
   */
  private calculatePatternRelevance(pattern: PatternData, analysis: IntelligentTaskAnalysis): number {
    let relevance = 0.5;

    // Check context matching
    for (const context of pattern.contexts) {
      if (analysis.patterns.includes(context)) {
        relevance += 0.2;
      }
    }

    // Check complexity matching
    const complexityDiff = Math.abs(pattern.complexity - analysis.intelligentComplexity);
    relevance += (1 - complexityDiff / 10) * 0.3;

    return Math.min(relevance, 1.0);
  }

  /**
   * Generate adaptive tools based on success history
   */
  private generateAdaptiveTools(analysis: IntelligentTaskAnalysis, criteria: OptimizationCriteria): string[] {
    const available = Array.from(this.tools.values());
    if (available.length === 0) return [];

    // Sort tools based on adaptive weights
    if (this.adaptiveWeights.speed > 0.4) {
      return [...available].sort((a, b) => (a.estimatedDuration || 500) - (b.estimatedDuration || 500)).slice(0, 3).map(t => t.name);
    }
    if (this.adaptiveWeights.simplicity > 0.4) {
      return [...available].sort((a, b) => (a.estimatedComplexity || 2) - (b.estimatedComplexity || 2)).slice(0, 3).map(t => t.name);
    }
    return available.slice(0, 3).map(t => t.name);
  }

  /**
   * Calculate adaptive confidence
   */
  private calculateAdaptiveConfidence(): number {
    if (this.successHistory.length === 0) return 0.85;

    const recentSuccesses = this.successHistory.slice(-5);
    return recentSuccesses.reduce((sum, r) => sum + r.successRate, 0) / recentSuccesses.length;
  }

  /**
   * Generate cross-domain tools
   */
  private generateCrossDomainTools(analysis: IntelligentTaskAnalysis): string[] {
    const tools: string[] = [];

    // Select tools from different categories
    const categories = new Set(Array.from(this.tools.values()).map(t => t.category));
    const categoryArray = Array.from(categories);

    for (let i = 0; i < Math.min(3, categoryArray.length); i++) {
      const categoryTools = Array.from(this.tools.values()).filter(t => t.category === categoryArray[i]);
      if (categoryTools.length > 0) {
        tools.push(categoryTools[0].name);
      }
    }

    return tools.length > 0 ? tools : Array.from(this.tools.keys()).slice(0, 3);
  }

  /**
   * Generate serendipitous tools
   */
  private generateSerendipitousTools(analysis: IntelligentTaskAnalysis): string[] {
    const tools = Array.from(this.tools.values());
    if (tools.length === 0) return [];
    const serendipitousTools: string[] = [];

    // Select up to 3 tools
    for (let i = 0; i < Math.min(3, tools.length); i++) {
      const randomTool = tools[Math.floor(Math.random() * tools.length)];
      if (!serendipitousTools.includes(randomTool.name)) {
        serendipitousTools.push(randomTool.name);
      }
    }

    return serendipitousTools;
  }

  /**
   * Generate reverse engineering tools
   */
  private generateReverseEngineeringTools(analysis: IntelligentTaskAnalysis): string[] {
    const tools: string[] = [];
    const available = Array.from(this.tools.keys());

    // Prefer analysis tools if present
    for (const name of available) {
      if (name.includes('analyze') || name.includes('thinking') || name.includes('search') || name.includes('route')) {
        tools.push(name);
        if (tools.length >= 3) break;
      }
    }

    return tools.length > 0 ? tools : available.slice(0, 3);
  }

  /**
   * Build intelligent route with enhanced analysis
   */
  private async buildIntelligentRoute(
    strategy: IntelligentStrategy,
    criteria: OptimizationCriteria,
    analysis: IntelligentTaskAnalysis
  ): Promise<RouteSuggestion | null> {
    const tools: ToolInfo[] = [];
    let totalDuration = 0;
    let totalComplexity = 0;

    for (const toolName of strategy.tools) {
      const tool = this.tools.get(toolName);
      if (tool) {
        tools.push(tool);
        totalDuration += tool.estimatedDuration || 1000;
        totalComplexity += tool.estimatedComplexity || 1;
      }
    }

    if (tools.length === 0) {
      return null;
    }

    // Enhanced confidence calculation
    const confidence = this.calculateIntelligentConfidence(tools, criteria, strategy, analysis);

    // Enhanced reasoning generation
    const reasoning = this.generateIntelligentReasoning(strategy, tools, criteria, analysis);

    return {
      id: `intelligent_${strategy.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      name: strategy.name,
      description: strategy.description,
      tools,
      estimatedDuration: totalDuration,
      complexity: Math.min(totalComplexity / tools.length, 10),
      confidence,
      reasoning,
    };
  }

  /**
   * Calculate intelligent confidence
   */
  private calculateIntelligentConfidence(
    tools: ToolInfo[],
    criteria: OptimizationCriteria,
    strategy: IntelligentStrategy,
    analysis: IntelligentTaskAnalysis
  ): number {
    let confidence = strategy.confidence;

    // Boost confidence for creative strategies
    if (strategy.creativity > 0.7) {
      confidence += 0.1;
    }

    // Boost confidence for innovative strategies
    if (strategy.innovation > 0.7) {
      confidence += 0.1;
    }

    // Adjust based on analysis match
    if (analysis.creativityPotential > 0.7 && strategy.creativity > 0.5) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate intelligent reasoning
   */
  private generateIntelligentReasoning(
    strategy: IntelligentStrategy,
    tools: ToolInfo[],
    criteria: OptimizationCriteria,
    analysis: IntelligentTaskAnalysis
  ): string {
    const reasons: string[] = [];

    reasons.push(`This ${strategy.name} strategy leverages intelligent pattern recognition`);

    if (strategy.creativity > 0.7) {
      reasons.push(`with high creativity potential (${(strategy.creativity * 100).toFixed(0)}%)`);
    }

    if (strategy.innovation > 0.7) {
      reasons.push(`and innovative approach (${(strategy.innovation * 100).toFixed(0)}%)`);
    }

    reasons.push(`using ${tools.length} intelligently selected tools: ${tools.map(t => t.name).join(', ')}`);

    if (analysis.creativityPotential > 0.6) {
      reasons.push(`This approach is particularly suitable for creative problem-solving`);
    }

    return reasons.join(', ');
  }

  /**
   * Sort suggestions intelligently using adaptive weights
   */
  private sortSuggestionsIntelligently(suggestions: RouteSuggestion[], criteria: OptimizationCriteria): RouteSuggestion[] {
    return suggestions.sort((a, b) => {
      // Calculate intelligent scores
      const scoreA = this.calculateIntelligentScore(a, criteria);
      const scoreB = this.calculateIntelligentScore(b, criteria);

      return scoreB - scoreA;
    });
  }

  /**
   * Calculate intelligent score for sorting
   */
  private calculateIntelligentScore(suggestion: RouteSuggestion, criteria: OptimizationCriteria): number {
    let score = suggestion.confidence;

    // Apply adaptive weights
    if (criteria.prioritizeSpeed) {
      score += this.adaptiveWeights.speed * (1 - suggestion.estimatedDuration / 10000);
    }

    if (criteria.prioritizeSimplicity) {
      score += this.adaptiveWeights.simplicity * (1 - suggestion.complexity / 10);
    }

    if (criteria.prioritizeReliability) {
      score += this.adaptiveWeights.reliability * suggestion.confidence;
    }

    // Boost creative and innovative solutions
    score += this.adaptiveWeights.creativity * 0.1;
    score += this.adaptiveWeights.innovation * 0.1;

    return score;
  }

  /**
   * Get comprehensive tool chain analysis
   */
  getToolChainAnalysis(input: string): {
    totalTools: number;
    averageComplexity: number;
    categoryDistribution: Record<string, number>;
    routeRecommendations: RouteSuggestion[];
    optimizationSuggestions: string[];
  } {
    const tools = Array.from(this.tools.values());
    const totalTools = tools.length;

    // Calculate average complexity
    const averageComplexity = tools.length > 0
      ? tools.reduce((sum, tool) => sum + (tool.estimatedComplexity || 1), 0) / tools.length
      : 0;

    // Calculate category distribution
    const categoryDistribution: Record<string, number> = {};
    tools.forEach(tool => {
      const category = tool.category || 'uncategorized';
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
    });

    // Generate route recommendations based on input
    const routeRecommendations = this.generateRouteRecommendations(input);

    // Generate optimization suggestions
    const optimizationSuggestions = this.generateOptimizationSuggestions(tools, averageComplexity);

    return {
      totalTools,
      averageComplexity: Math.round(averageComplexity * 100) / 100,
      categoryDistribution,
      routeRecommendations,
      optimizationSuggestions,
    };
  }

  /**
   * Generate route recommendations based on input description
   */
  private generateRouteRecommendations(input: string): RouteSuggestion[] {
    // Generate a few sample route recommendations based on input
    const recommendations: RouteSuggestion[] = [];

    if (input.toLowerCase().includes('file') || input.toLowerCase().includes('read') || input.toLowerCase().includes('write')) {
      recommendations.push({
        id: 'file-operations-route',
        name: 'File Operations Route',
        description: 'Optimized route for file operations using filesystem tools',
        tools: [
          {
            name: 'read_file',
            description: 'Read file contents',
            inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
            serverName: 'filesystem',
            category: 'filesystem',
            estimatedComplexity: 2,
            estimatedDuration: 100,
          },
          {
            name: 'write_file',
            description: 'Write content to file',
            inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
            serverName: 'filesystem',
            category: 'filesystem',
            estimatedComplexity: 3,
            estimatedDuration: 200,
          }
        ],
        estimatedDuration: 300,
        complexity: 2.5,
        confidence: 0.85,
        reasoning: 'File operations typically require read/write capabilities with proper error handling',
      });
    }

    if (input.toLowerCase().includes('search') || input.toLowerCase().includes('web') || input.toLowerCase().includes('find')) {
      recommendations.push({
        id: 'web-search-route',
        name: 'Web Search Route',
        description: 'Optimized route for web search and information gathering',
        tools: [
          {
            name: 'web_search',
            description: 'Search the web for information',
            inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
            serverName: 'search',
            category: 'web',
            estimatedComplexity: 4,
            estimatedDuration: 2000,
          }
        ],
        estimatedDuration: 2000,
        complexity: 4,
        confidence: 0.75,
        reasoning: 'Web search operations require robust querying and result processing capabilities',
      });
    }

    // Add a general-purpose route
    recommendations.push({
      id: 'general-purpose-route',
      name: 'General Purpose Route',
      description: 'Balanced route suitable for most common tasks',
      tools: [
        {
          name: 'analyze_tools',
          description: 'Analyze available tools and capabilities',
          inputSchema: {},
          serverName: 'chaining',
          category: 'analysis',
          estimatedComplexity: 3,
          estimatedDuration: 500,
        }
      ],
      estimatedDuration: 500,
      complexity: 3,
      confidence: 0.9,
      reasoning: 'General purpose route provides flexibility and can be adapted to various task types',
    });

    return recommendations;
  }

  /**
   * Generate optimization suggestions based on tool analysis
   */
  private generateOptimizationSuggestions(tools: ToolInfo[], averageComplexity: number): string[] {
    const suggestions: string[] = [];

    if (averageComplexity > 4) {
      suggestions.push('Consider adding simpler utility tools to reduce overall complexity');
    }

    if (tools.length < 5) {
      suggestions.push('Expand tool collection to provide more comprehensive coverage');
    }

    const categories = new Set(tools.map(t => t.category));
    if (categories.size < 3) {
      suggestions.push('Add tools from additional categories for better problem-solving coverage');
    }

    const slowTools = tools.filter(t => (t.estimatedDuration || 0) > 3000);
    if (slowTools.length > 0) {
      suggestions.push(`Consider optimizing or replacing ${slowTools.length} slow-performing tools`);
    }

    suggestions.push('Regularly update tool performance metrics based on actual usage patterns');
    suggestions.push('Implement tool usage analytics to identify bottlenecks and optimization opportunities');

    return suggestions;
  }
}

// Enhanced helper types
interface TaskAnalysis {
  requiresFileOperations: boolean;
  requiresWebSearch: boolean;
  requiresAnalysis: boolean;
  requiresDataProcessing: boolean;
  complexity: number;
  estimatedDuration: number;
}

interface IntelligentTaskAnalysis extends TaskAnalysis {
  patterns: string[];
  intelligentComplexity: number;
  creativityPotential: number;
  suggestedApproaches: string[];
}

interface IntelligentStrategy {
  name: string;
  description: string;
  tools: string[];
  priority: number;
  confidence: number;
  innovation: number;
  creativity: number;
}

interface PatternData {
  pattern: string[];
  successRate: number;
  avgDuration: number;
  complexity: number;
  contexts: string[];
  relevance?: number;
}

interface SuccessRecord {
  successRate: number;
  timestamp: number;
  strategy: string;
}

interface AdaptiveWeights {
  speed: number;
  simplicity: number;
  reliability: number;
  creativity: number;
  innovation: number;
}
