import { MCPServerDiscovery } from '../core/discovery.js';
import { PromptRegistry } from '../prompts/prompt-registry.js';
import { AwesomeCopilotIntegration } from '../integrations/awesome-copilot-integration.js';
import { WorkflowOrchestrator } from '../managers/workflow-orchestrator.js';
import { LLMManager } from '../managers/llm-manager.js';

export class ResourceHandlers {
  constructor(
    private discovery: MCPServerDiscovery,
    private promptRegistry: PromptRegistry,
    private awesomeCopilotIntegration: AwesomeCopilotIntegration,
    private workflowOrchestrator: WorkflowOrchestrator,
    private llmManager?: LLMManager
  ) {}

  async handleReadResource(uri: string): Promise<any> {
    switch (uri) {
      case 'chaining://servers':
        const servers = this.discovery.getServers();
        return {
          servers: servers.map(server => ({
            name: server.name || 'Unknown',
            command: server.command,
            args: server.args,
            env: server.env,
            capabilities: server.capabilities,
          })),
          total: servers.length,
        };

      case 'chaining://tools':
        const tools = this.discovery.getTools();
        return {
          tools: tools.map(tool => ({
            name: tool.name || 'Unknown',
            description: tool.description,
            server: tool.serverName,
            category: tool.category,
            complexity: tool.estimatedComplexity || 1,
          })),
          total: tools.length,
          servers: [...new Set(tools.map(t => t.serverName))].length,
        };

      case 'chaining://analysis':
        const servers2 = this.discovery.getServers();
        const tools2 = this.discovery.getTools();
        return {
          totalServers: servers2.length,
          totalTools: tools2.length,
          categories: [...new Set(tools2.map(t => t.category))],
          lastUpdated: new Date().toISOString(),
        };

      case 'chaining://prompts':
        return {
          prompts: this.promptRegistry.getAllPrompts(),
          total: this.promptRegistry.getAllPrompts().length,
        };

      case 'chaining://resources':
        return {
          resourceSets: this.promptRegistry.getAllResourceSets(),
          total: this.promptRegistry.getAllResourceSets().length,
        };

      case 'chaining://prompts/overview':
        const prompts = this.promptRegistry.getAllPrompts();
        const categories = [...new Set(prompts.map(p => p.category || 'general'))];
        const complexities = [...new Set(prompts.map(p => p.complexity || 'medium'))];

        return {
          totalPrompts: prompts.length,
          categories: categories.map(cat => ({
            name: cat,
            count: prompts.filter(p => (p.category || 'general') === cat).length,
          })),
          complexities: complexities.map(comp => ({
            level: comp,
            count: prompts.filter(p => (p.complexity || 'medium') === comp).length,
          })),
        };

      case 'chaining://awesome-copilot/collections':
        const collections = this.awesomeCopilotIntegration.getCollections();
        return {
          collections: collections.map(c => ({
            name: c.name,
            description: c.description,
            items: c.items?.length || 0,
            tags: c.tags || [],
          })),
          total: collections.length,
        };

      case 'chaining://awesome-copilot/instructions':
        const instructions = this.awesomeCopilotIntegration.getInstructions();
        return {
          instructions: instructions.map(i => ({
            filename: i.filename,
            mode: (i as any).mode || 'unknown',
            description: (i as any).description || 'No description',
          })),
          total: instructions.length,
        };

      case 'chaining://awesome-copilot/status':
        const collections2 = this.awesomeCopilotIntegration.getCollections();
        const instructions2 = this.awesomeCopilotIntegration.getInstructions();
        return {
          collectionsCount: collections2.length,
          instructionsCount: instructions2.length,
          lastUpdate: new Date().toISOString(),
          status: 'active',
        };

      case 'chaining://sequential/state': {
        // Now backed by the shared AgentState (Needle-driven sessions).
        const { sharedAgentState } = await import('../agent/state.js');
        const sessions = sharedAgentState().list();
        return {
          activeSessions: sessions.filter(s => !s.terminated).length,
          totalSessions: sessions.length,
          sessions,
          lastActivity: new Date().toISOString(),
        };
      }

      case 'chaining://workflows/status':
        return {
          ...this.workflowOrchestrator.getStats(),
          lastActivity: new Date().toISOString(),
        };

      case 'chaining://tool-chains':
        return {
          prompts: this.promptRegistry.getAllPrompts().filter(p =>
            p.category === 'tool-chaining' || p.tags?.includes('tool-chaining')
          ),
          resourceSets: this.promptRegistry.getAllResourceSets().filter(rs =>
            rs.category === 'tool-chaining' || rs.tags?.includes('tool-chaining')
          ),
        };

      case 'chaining://tool-chains/overview':
        const toolChainPrompts = this.promptRegistry.getAllPrompts().filter(p =>
          p.category === 'tool-chaining' || p.tags?.includes('tool-chaining')
        );
        const toolChainResourceSets = this.promptRegistry.getAllResourceSets().filter(rs =>
          rs.category === 'tool-chaining' || rs.tags?.includes('tool-chaining')
        );

        return {
          totalToolChainResources: toolChainPrompts.length + toolChainResourceSets.length,
          prompts: toolChainPrompts.length,
          resourceSets: toolChainResourceSets.length,
          categories: ['analysis', 'implementation', 'debugging', 'orchestration', 'ci-cd'],
        };

      case 'chaining://health':
        const discoveredServers = this.discovery.getServers();
        const discoveredTools = this.discovery.getTools();
        const stats = this.discovery.getCacheStats();
        return {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          discovery: {
            serversDiscovered: discoveredServers.length,
            toolsAnalyzed: discoveredTools.length,
            cacheHits: stats.cacheHits,
            cacheMisses: stats.cacheMisses,
          },
          integrations: {
            sequentialThinking: 'ready',
            timeManager: 'ready',
            promptRegistry: {
              promptsCount: this.promptRegistry.getAllPrompts().length,
              resourceSetsCount: this.promptRegistry.getAllResourceSets().length,
            },
            awesomeCopilot: this.awesomeCopilotIntegration.isReady() ? 'ready' : 'degraded',
          },
          allToolsHealthy: true,
        };

      case 'chaining://cache/stats':
        return {
          ...this.discovery.getCacheStats(),
          timestamp: new Date().toISOString(),
        };

      case 'chaining://llm/status':
        return this.llmManager ? this.llmManager.getStatus() : { enabled: false, hasKey: false, model: 'none' };

      case 'chaining://llm/usage':
        return this.llmManager ? this.llmManager.getUsage() : { callsTotal: 0, promptTokensTotal: 0, completionTokensTotal: 0 };

      case 'chaining://agent/status': {
        const { agentStatus } = await import('../agent/diagnostics.js');
        return { ...agentStatus(), timestamp: new Date().toISOString() };
      }

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }
}
