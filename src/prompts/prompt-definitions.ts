/**
 * Prompt Definitions for Chaining MCP Server
 *
 * Contains interfaces and predefined prompt/resource set data
 */

export interface PrebuiltPrompt {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  prompt: string;
  expectedTools?: string[];
  complexity: 'low' | 'medium' | 'high';
  useCase: string;
}

export interface ResourceSet {
  id: string;
  name: string;
  description: string;
  category: string;
  resources: {
    type: 'prompt' | 'workflow' | 'template' | 'example';
    name: string;
    content: string;
    description: string;
  }[];
  tags: string[];
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Predefined prompts for common development and orchestration tasks
 */
export const predefinedPrompts: PrebuiltPrompt[] = [
  // Development Prompts
  {
    id: 'analyze-project-structure',
    name: 'Analyze Project Structure',
    description: 'Comprehensive analysis of project structure and dependencies',
    category: 'development',
    tags: ['analysis', 'structure', 'dependencies', 'overview'],
    complexity: 'medium',
    useCase: 'Understanding project architecture and organization',
    prompt: `Analyze this project's structure and provide insights about:

1. **Architecture Overview**: What type of project is this? What framework/pattern is used?
2. **Directory Structure**: Key directories and their purposes
3. **Dependencies**: Main dependencies and their roles
4. **Entry Points**: How does the application start?
5. **Configuration**: Important configuration files and settings

Use the available filesystem tools to explore the codebase systematically. Start with the root directory, then examine key configuration files (package.json, tsconfig.json, etc.), and finally look at main source directories.`,
    expectedTools: ['list_dir', 'read_file', 'grep']
  },

  {
    id: 'debug-error-tracing',
    name: 'Debug Error Tracing',
    description: 'Systematic approach to tracing and debugging errors',
    category: 'debugging',
    tags: ['debugging', 'errors', 'tracing', 'logs'],
    complexity: 'high',
    useCase: 'Finding and fixing bugs in the codebase',
    prompt: `Debug this error systematically:

1. **Error Analysis**: Parse the error message, stack trace, and context
2. **Code Location**: Find the exact file and line where the error occurs
3. **Root Cause**: Identify what caused the error (null reference, type mismatch, etc.)
4. **Dependencies**: Check related code that might be contributing
5. **Solution**: Propose and implement a fix

Steps to follow:
- Search for error-related keywords in the codebase
- Examine the specific file and function where error occurs
- Check imports and dependencies
- Look for similar patterns in working code
- Test the fix thoroughly`,
    expectedTools: ['grep', 'read_file', 'search_replace', 'run_terminal_cmd']
  },

  {
    id: 'performance-optimization',
    name: 'Performance Optimization',
    description: 'Identify and fix performance bottlenecks',
    category: 'optimization',
    tags: ['performance', 'optimization', 'bottlenecks', 'profiling'],
    complexity: 'high',
    useCase: 'Improving application performance and efficiency',
    prompt: `Optimize performance by:

1. **Performance Analysis**: Identify slow operations and bottlenecks
2. **Memory Usage**: Check for memory leaks and inefficient allocations
3. **Database Queries**: Optimize database operations if applicable
4. **Caching**: Implement appropriate caching strategies
5. **Code Efficiency**: Refactor inefficient algorithms and data structures

Analysis approach:
- Run performance profiling tools
- Identify the slowest functions/methods
- Check for N+1 queries or inefficient loops
- Look for memory-intensive operations
- Implement caching where beneficial
- Test performance improvements`,
    expectedTools: ['run_terminal_cmd', 'grep', 'read_file', 'search_replace']
  },

  // Workflow Prompts
  {
    id: 'feature-implementation',
    name: 'Feature Implementation',
    description: 'Complete workflow for implementing new features',
    category: 'development',
    tags: ['feature', 'implementation', 'workflow', 'planning'],
    complexity: 'high',
    useCase: 'Adding new functionality to the codebase',
    prompt: `Implement a new feature following this structured approach:

1. **Requirements Analysis**: Understand the feature requirements and constraints
2. **Design Planning**: Plan the implementation approach and architecture
3. **Code Implementation**: Write clean, testable code
4. **Integration**: Integrate with existing codebase
5. **Testing**: Write and run comprehensive tests
6. **Documentation**: Update documentation and comments

Implementation steps:
- Analyze existing similar features for patterns
- Plan the code structure and interfaces
- Implement incrementally with frequent testing
- Ensure proper error handling and edge cases
- Follow existing code conventions and patterns
- Write unit tests and integration tests`,
    expectedTools: ['read_file', 'grep', 'search_replace', 'run_terminal_cmd', 'todo_write']
  },

  {
    id: 'code-refactoring',
    name: 'Code Refactoring',
    description: 'Refactor code for better maintainability and performance',
    category: 'maintenance',
    tags: ['refactoring', 'maintainability', 'clean-code', 'improvement'],
    complexity: 'medium',
    useCase: 'Improving code quality and maintainability',
    prompt: `Refactor code following best practices:

1. **Code Analysis**: Identify code smells and improvement opportunities
2. **Refactoring Strategy**: Plan safe refactoring steps
3. **Incremental Changes**: Make small, testable changes
4. **Testing**: Ensure functionality remains intact
5. **Documentation**: Update comments and documentation

Refactoring focus areas:
- Extract methods/functions for complex logic
- Remove code duplication
- Improve variable and function names
- Add proper error handling
- Simplify conditional logic
- Improve code organization and structure`,
    expectedTools: ['read_file', 'grep', 'search_replace', 'run_terminal_cmd']
  },

  // Analysis Prompts
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Comprehensive security analysis of the codebase',
    category: 'security',
    tags: ['security', 'audit', 'vulnerabilities', 'review'],
    complexity: 'high',
    useCase: 'Identifying and fixing security vulnerabilities',
    prompt: `Perform a comprehensive security audit:

1. **Input Validation**: Check for proper input sanitization and validation
2. **Authentication & Authorization**: Review access controls and permissions
3. **Data Protection**: Ensure sensitive data is handled securely
4. **Dependencies**: Check for vulnerable third-party packages
5. **Configuration**: Review security-related configurations
6. **Common Vulnerabilities**: Look for SQL injection, XSS, CSRF, etc.

Audit checklist:
- Scan for hardcoded secrets and credentials
- Check input validation on all user inputs
- Review database queries for injection vulnerabilities
- Examine authentication and session management
- Check file upload and download security
- Review error messages for information disclosure
- Update vulnerable dependencies`,
    expectedTools: ['grep', 'read_file', 'run_terminal_cmd']
  },

  {
    id: 'dependency-analysis',
    name: 'Dependency Analysis',
    description: 'Analyze project dependencies and their impact',
    category: 'analysis',
    tags: ['dependencies', 'analysis', 'packages', 'maintenance'],
    complexity: 'medium',
    useCase: 'Understanding and managing project dependencies',
    prompt: `Analyze project dependencies comprehensively:

1. **Dependency Inventory**: List all dependencies and their versions
2. **Usage Analysis**: Determine which dependencies are actually used
3. **Security Check**: Identify vulnerable or outdated packages
4. **License Compliance**: Check license compatibility
5. **Optimization**: Identify unused or redundant dependencies

Analysis steps:
- Parse package.json and lock files
- Search codebase for import/require statements
- Check for security vulnerabilities (npm audit, Snyk, etc.)
- Review dependency licenses
- Identify opportunities for consolidation
- Update outdated packages safely`,
    expectedTools: ['read_file', 'grep', 'run_terminal_cmd']
  },

  // Tool-Specific Prompts
  {
    id: 'tool-chaining-basics',
    name: 'Tool Chaining Basics',
    description: 'Learn how to effectively chain multiple tools together',
    category: 'tool-usage',
    tags: ['tool-chaining', 'workflow', 'efficiency', 'basics'],
    complexity: 'low',
    useCase: 'Understanding how to combine tools effectively',
    prompt: `Master tool chaining basics:

1. **Tool Discovery**: Learn what tools are available
2. **Workflow Planning**: Plan multi-step operations
3. **Sequential Execution**: Execute tools in the right order
4. **Result Processing**: Use output from one tool as input for another
5. **Error Handling**: Handle failures and edge cases

Basic chaining patterns:
- File operations: read → modify → write
- Search operations: grep → analyze → modify
- Build operations: lint → test → build
- Deployment: build → test → deploy

Remember: Always check tool capabilities and requirements before chaining.`,
    expectedTools: ['list_mcp_servers', 'analyze_tools', 'generate_route_suggestions']
  },

  {
    id: 'memory-knowledge-management',
    name: 'Memory & Knowledge Management',
    description: 'Use the knowledge graph for persistent learning and context',
    category: 'knowledge',
    tags: ['memory', 'knowledge-graph', 'learning', 'context'],
    complexity: 'medium',
    useCase: 'Building and maintaining project knowledge over time',
    prompt: `Leverage the knowledge graph for persistent memory:

1. **Entity Creation**: Create entities for important concepts, people, and resources
2. **Relationship Mapping**: Define relationships between entities
3. **Observation Recording**: Add observations and learnings over time
4. **Knowledge Retrieval**: Search and retrieve relevant information
5. **Context Preservation**: Maintain context across sessions

Best practices:
- Create entities for projects, components, and key concepts
- Use consistent naming conventions
- Add detailed observations with timestamps
- Create meaningful relationships (depends_on, related_to, etc.)
- Regularly review and update knowledge

This enables the system to learn and provide better assistance over time.`,
    expectedTools: ['memory_edit', 'search_nodes', 'read_graph']
  },

  {
    id: 'sequential-thinking-workflows',
    name: 'Sequential Thinking Workflows',
    description: 'Use sequential thinking for complex problem-solving',
    category: 'thinking',
    tags: ['sequential-thinking', 'problem-solving', 'analysis', 'planning'],
    complexity: 'high',
    useCase: 'Breaking down complex problems into manageable steps',
    prompt: `Apply sequential thinking to complex problems:

1. **Problem Decomposition**: Break complex problems into smaller, manageable parts
2. **Step-by-Step Analysis**: Think through each aspect systematically
3. **Hypothesis Testing**: Form and test hypotheses about solutions
4. **Course Correction**: Adjust approach based on new information
5. **Solution Synthesis**: Combine insights into comprehensive solutions

Sequential thinking workflow:
- Start with problem understanding and context gathering
- Break down into sub-problems and dependencies
- Analyze each component with available tools
- Synthesize findings and form conclusions
- Iterate and refine based on results

Use this approach for complex debugging, architecture decisions, and multi-step implementations.`,
    expectedTools: ['sequentialthinking', 'analyze_with_sequential_thinking']
  },

  // MCP Ecosystem and Chaining Prompts
  {
    id: 'mcp-ecosystem-exploration',
    name: 'MCP Ecosystem Exploration',
    description: 'Discover and analyze the complete MCP server ecosystem available to you',
    category: 'mcp-ecosystem',
    tags: ['discovery', 'analysis', 'ecosystem', 'servers', 'capabilities'],
    complexity: 'medium',
    useCase: 'Understanding what MCP servers and tools are available for complex workflows',
    prompt: `Explore the MCP ecosystem to understand available capabilities:

1. **Server Discovery**: Identify all available MCP servers in your environment
2. **Capability Mapping**: Analyze what tools each server provides
3. **Integration Opportunities**: Find servers that can work together
4. **Workflow Planning**: Design multi-server workflows for complex tasks
5. **Resource Assessment**: Evaluate which servers to use for specific scenarios

Start by listing all MCP servers, then analyze their tools to understand the ecosystem's capabilities.`,
    expectedTools: ['list_mcp_servers', 'analyze_tools', 'generate_route_suggestions']
  },

  {
    id: 'cross-server-data-flow',
    name: 'Cross-Server Data Flow Design',
    description: 'Design data flows and orchestrations across multiple MCP servers',
    category: 'orchestration',
    tags: ['data-flow', 'orchestration', 'multi-server', 'integration', 'pipelines'],
    complexity: 'high',
    useCase: 'Creating complex workflows that span multiple MCP servers',
    prompt: `Design a cross-server data flow orchestration:

1. **Requirements Analysis**: Understand the data transformation needs
2. **Server Capability Matching**: Find servers with complementary capabilities
3. **Data Flow Mapping**: Design the sequence of operations across servers
4. **Error Handling**: Plan for failures in multi-server operations
5. **Optimization**: Ensure efficient data transfer between servers

Identify servers that can work together, design the data flow, and implement the orchestration.`,
    expectedTools: ['analyze_tools', 'generate_route_suggestions', 'get_tool_chain_analysis']
  },

  {
    id: 'awesome-copilot-integration-workflow',
    name: 'Awesome Copilot Integration Workflow',
    description: 'Leverage awesome-copilot resources for enhanced development workflows',
    category: 'integration',
    tags: ['awesome-copilot', 'integration', 'development', 'resources', 'guidance'],
    complexity: 'medium',
    useCase: 'Using curated development resources to enhance coding and development tasks',
    prompt: `Integrate awesome-copilot resources into your development workflow:

1. **Resource Discovery**: Explore available collections and instructions
2. **Relevance Assessment**: Find resources relevant to your current task
3. **Integration Planning**: Design how to incorporate these resources
4. **Workflow Enhancement**: Apply the guidance to improve your process
5. **Knowledge Transfer**: Learn from the curated development wisdom

Browse collections, search for relevant instructions, and apply them to enhance your development process.`,
    expectedTools: ['awesome_copilot_list_collections', 'awesome_copilot_search_collections', 'awesome_copilot_get_collection', 'awesome_copilot_search_instructions']
  },

  {
    id: 'time-sensitive-task-orchestration',
    name: 'Time-Sensitive Task Orchestration',
    description: 'Orchestrate tasks with time constraints and scheduling requirements',
    category: 'orchestration',
    tags: ['time-management', 'scheduling', 'deadlines', 'orchestration', 'planning'],
    complexity: 'high',
    useCase: 'Managing complex workflows with time constraints and dependencies',
    prompt: `Orchestrate time-sensitive tasks with precision:

1. **Time Analysis**: Understand timezone requirements and deadlines
2. **Task Sequencing**: Order operations based on time constraints
3. **Dependency Management**: Handle time-dependent task relationships
4. **Scheduling Optimization**: Optimize execution timing across timezones
5. **Progress Monitoring**: Track time-sensitive progress and adjustments

Convert between timezones, plan task sequences, and execute with time awareness.`,
    expectedTools: ['get_current_time', 'convert_time', 'sequentialthinking', 'generate_route_suggestions']
  },

  {
    id: 'multi-server-debugging-orchestration',
    name: 'Multi-Server Debugging Orchestration',
    description: 'Debug issues that span multiple MCP servers and systems',
    category: 'debugging',
    tags: ['debugging', 'multi-server', 'orchestration', 'tracing', 'cross-system'],
    complexity: 'high',
    useCase: 'Debugging complex issues that involve multiple MCP servers',
    prompt: `Orchestrate debugging across multiple MCP servers:

1. **Issue Scope Analysis**: Determine which servers are involved
2. **Server State Inspection**: Check the state of relevant servers
3. **Cross-Server Tracing**: Trace data flow and state changes across servers
4. **Root Cause Isolation**: Identify which server/component is causing the issue
5. **Coordinated Resolution**: Implement fixes that may span multiple servers

Systematically debug issues that involve multiple MCP servers working together.`,
    expectedTools: ['list_mcp_servers', 'analyze_tools', 'sequentialthinking', 'awesome_copilot_search_instructions']
  },

  {
    id: 'intelligent-route-optimization',
    name: 'Intelligent Route Optimization',
    description: 'Optimize execution routes for complex multi-step tasks',
    category: 'optimization',
    tags: ['optimization', 'routing', 'efficiency', 'planning', 'execution'],
    complexity: 'high',
    useCase: 'Finding the most efficient way to execute complex tasks across available tools',
    prompt: `Optimize routes for complex task execution:

1. **Task Decomposition**: Break down complex tasks into manageable steps
2. **Capability Analysis**: Understand what tools can perform each step
3. **Route Generation**: Generate multiple possible execution paths
4. **Efficiency Analysis**: Compare routes for performance and reliability
5. **Optimal Selection**: Choose the best route and execute it

Analyze available tools, generate route suggestions, and optimize for your specific task requirements.`,
    expectedTools: ['analyze_tools', 'generate_route_suggestions', 'get_tool_chain_analysis', 'sequentialthinking']
  },

  {
    id: 'server-capability-mapping',
    name: 'Server Capability Mapping',
    description: 'Create comprehensive maps of MCP server capabilities and relationships',
    category: 'analysis',
    tags: ['mapping', 'capabilities', 'analysis', 'relationships', 'planning'],
    complexity: 'medium',
    useCase: 'Understanding and planning with the full MCP server ecosystem',
    prompt: `Map MCP server capabilities comprehensively:

1. **Server Inventory**: Catalog all available MCP servers
2. **Tool Analysis**: Deep dive into each server's tool capabilities
3. **Relationship Mapping**: Identify how servers can complement each other
4. **Use Case Planning**: Design workflows leveraging multiple servers
5. **Capability Gaps**: Identify areas where additional servers would be beneficial

Create a complete understanding of your MCP ecosystem for better planning and execution.`,
    expectedTools: ['list_mcp_servers', 'analyze_tools', 'generate_route_suggestions', 'get_tool_chain_analysis']
  },

  {
    id: 'dynamic-workflow-adaptation',
    name: 'Dynamic Workflow Adaptation',
    description: 'Adapt workflows dynamically based on runtime conditions and server availability',
    category: 'orchestration',
    tags: ['dynamic', 'adaptation', 'workflows', 'flexibility', 'runtime'],
    complexity: 'high',
    useCase: 'Creating flexible workflows that adapt to changing conditions',
    prompt: `Design workflows that adapt to runtime conditions:

1. **Condition Analysis**: Identify factors that might change during execution
2. **Contingency Planning**: Design alternative paths for different scenarios
3. **Dynamic Routing**: Implement logic to choose paths based on current state
4. **Server Availability**: Handle cases where servers become unavailable
5. **Adaptive Execution**: Execute workflows that can pivot based on results

Create robust workflows that can adapt to changing MCP server conditions and requirements.`,
    expectedTools: ['list_mcp_servers', 'analyze_tools', 'generate_route_suggestions', 'sequentialthinking']
  },

  {
    id: 'knowledge-graph-enhanced-chaining',
    name: 'Knowledge Graph Enhanced Chaining',
    description: 'Leverage knowledge graphs for intelligent tool chaining decisions',
    category: 'integration',
    tags: ['knowledge-graph', 'intelligence', 'chaining', 'context', 'relationships'],
    complexity: 'high',
    useCase: 'Using structured knowledge to make better tool chaining decisions',
    prompt: `Enhance tool chaining with knowledge graph insights:

1. **Context Understanding**: Use knowledge graphs to understand task context
2. **Relationship Analysis**: Identify related entities and their connections
3. **Intelligent Routing**: Make chaining decisions based on knowledge relationships
4. **Context Preservation**: Maintain context across chained operations
5. **Learning Integration**: Incorporate past experiences into routing decisions

Combine knowledge management with tool chaining for more intelligent execution.`,
    expectedTools: ['get_tool_chain_analysis', 'generate_route_suggestions', 'sequentialthinking']
  },

  {
    id: 'collaborative-development-orchestration',
    name: 'Collaborative Development Orchestration',
    description: 'Orchestrate development tasks across team members and MCP servers',
    category: 'collaboration',
    tags: ['collaboration', 'team', 'orchestration', 'development', 'coordination'],
    complexity: 'high',
    useCase: 'Coordinating complex development tasks across team members and tools',
    prompt: `Orchestrate collaborative development workflows:

1. **Task Decomposition**: Break down complex features into manageable tasks
2. **Team Capability Mapping**: Understand team members' strengths and availability
3. **Tool Assignment**: Assign appropriate MCP servers/tools to each task
4. **Progress Coordination**: Track and coordinate progress across tasks
5. **Integration Planning**: Plan how individual contributions integrate together

Coordinate complex development efforts using multiple MCP servers and team capabilities.`,
    expectedTools: ['generate_route_suggestions', 'analyze_tools', 'sequentialthinking', 'get_tool_chain_analysis']
  },

  {
    id: 'automated-quality-assurance',
    name: 'Automated Quality Assurance Orchestration',
    description: 'Orchestrate comprehensive QA processes across multiple tools and servers',
    category: 'quality',
    tags: ['qa', 'testing', 'automation', 'quality', 'validation'],
    complexity: 'high',
    useCase: 'Running comprehensive quality assurance across multiple validation tools',
    prompt: `Orchestrate automated quality assurance processes:

1. **Test Planning**: Design comprehensive test suites across multiple dimensions
2. **Tool Coordination**: Coordinate multiple testing and validation tools
3. **Result Aggregation**: Collect and analyze results from multiple sources
4. **Issue Prioritization**: Identify and prioritize issues based on impact
5. **Remediation Planning**: Plan fixes and improvements based on findings

Execute comprehensive QA processes using multiple MCP servers and specialized tools.`,
    expectedTools: ['generate_route_suggestions', 'analyze_tools', 'sequentialthinking', 'awesome_copilot_search_instructions']
  },

  {
    id: 'intelligent-resource-discovery',
    name: 'Intelligent Resource Discovery',
    description: 'Discover and leverage resources across the MCP ecosystem intelligently',
    category: 'discovery',
    tags: ['discovery', 'resources', 'intelligence', 'exploration', 'learning'],
    complexity: 'medium',
    useCase: 'Finding and utilizing the best resources for specific development tasks',
    prompt: `Intelligently discover and leverage MCP ecosystem resources:

1. **Resource Inventory**: Catalog all available resources across servers
2. **Relevance Analysis**: Determine which resources are most relevant to your task
3. **Quality Assessment**: Evaluate resource quality and applicability
4. **Integration Planning**: Plan how to incorporate discovered resources
5. **Knowledge Synthesis**: Combine insights from multiple resource sources

Discover and utilize the full spectrum of resources available in your MCP ecosystem.`,
    expectedTools: ['list_mcp_servers', 'analyze_tools', 'awesome_copilot_list_collections', 'awesome_copilot_search_collections']
  },

  {
    id: 'predictive-workflow-optimization',
    name: 'Predictive Workflow Optimization',
    description: 'Optimize workflows based on predicted outcomes and historical patterns',
    category: 'optimization',
    tags: ['predictive', 'optimization', 'patterns', 'forecasting', 'efficiency'],
    complexity: 'high',
    useCase: 'Creating workflows that anticipate issues and optimize for success',
    prompt: `Implement predictive workflow optimization:

1. **Pattern Analysis**: Analyze historical execution patterns and outcomes
2. **Risk Prediction**: Identify potential failure points and bottlenecks
3. **Optimization Planning**: Design workflows that avoid predicted issues
4. **Contingency Integration**: Include fallback strategies for predicted problems
5. **Continuous Learning**: Update predictions based on new execution results

Create workflows that learn from past executions to optimize future performance.`,
    expectedTools: ['generate_route_suggestions', 'analyze_tools', 'sequentialthinking', 'get_tool_chain_analysis']
  },

  {
    id: 'enterprise-integration-orchestration',
    name: 'Enterprise Integration Orchestration',
    description: 'Orchestrate complex enterprise-level integrations across multiple systems',
    category: 'enterprise',
    tags: ['enterprise', 'integration', 'orchestration', 'systems', 'complexity'],
    complexity: 'high',
    useCase: 'Managing complex integrations across enterprise systems and MCP servers',
    prompt: `Orchestrate enterprise-level system integrations:

1. **System Analysis**: Understand all systems that need to be integrated
2. **Data Flow Design**: Design data flows between enterprise systems
3. **Integration Planning**: Plan integration points and transformation logic
4. **Error Handling**: Design robust error handling for enterprise environments
5. **Monitoring Setup**: Establish monitoring for integration health and performance

Manage complex enterprise integrations using coordinated MCP server capabilities.`,
    expectedTools: ['analyze_tools', 'generate_route_suggestions', 'sequentialthinking', 'get_tool_chain_analysis']
  },

  // Advanced Tool Chaining Prompts
  {
    id: 'comprehensive-project-assessment-chain',
    name: 'Comprehensive Project Assessment Chain',
    description: 'Execute complete project assessment using multiple analysis techniques',
    category: 'tool-chaining',
    tags: ['assessment', 'project', 'analysis', 'comprehensive', 'multi-tool'],
    complexity: 'high',
    useCase: 'Performing thorough project analysis using coordinated tool chains',
    prompt: `Execute a comprehensive project assessment using this tool chain:

**Chain Objective:** Provide complete project understanding through systematic analysis

**Required Tools:** list_dir, read_file, grep, run_terminal_cmd, analyze_tools

**Step-by-Step Execution:**

1. **Initial Structure Analysis**
   - Use list_dir to map project structure
   - Identify key directories and files
   - Note configuration files and entry points

2. **Configuration Deep Dive**
   - Read package.json/tsconfig.json for dependencies and scripts
   - Analyze build configurations and environment setups
   - Identify framework and tooling choices

3. **Code Pattern Analysis**
   - Use grep to find import patterns and dependencies
   - Analyze code organization and architecture
   - Identify main application flows

4. **Quality Assessment**
   - Check for linting and formatting issues
   - Analyze test coverage and structure
   - Identify potential security concerns

5. **Tool Ecosystem Evaluation**
   - Use analyze_tools to understand available capabilities
   - Identify integration opportunities
   - Plan optimization strategies

**Expected Outcomes:**
- Complete project structure map
- Dependency and configuration analysis
- Code quality assessment
- Integration recommendations
- Actionable improvement plan

**Success Metrics:**
- All major project components identified
- Clear understanding of architecture
- Identified strengths and improvement areas
- Actionable recommendations provided`,
    expectedTools: ['list_dir', 'read_file', 'grep', 'run_terminal_cmd', 'analyze_tools', 'todo_write']
  },

  {
    id: 'full-stack-feature-implementation-chain',
    name: 'Full-Stack Feature Implementation Chain',
    description: 'Complete feature implementation from design to deployment across the stack',
    category: 'tool-chaining',
    tags: ['implementation', 'full-stack', 'feature', 'deployment', 'end-to-end'],
    complexity: 'high',
    useCase: 'Implementing features across frontend, backend, and infrastructure',
    prompt: `Implement a full-stack feature using this comprehensive tool chain:

**Chain Objective:** Deliver production-ready features across the entire technology stack

**Required Tools:** read_file, grep, search_replace, run_terminal_cmd, todo_write

**Execution Phases:**

**Phase 1: Analysis & Planning**
1. Analyze existing code patterns and architecture
2. Identify integration points and dependencies
3. Plan feature implementation across all layers

**Phase 2: Backend Implementation**
1. Design and implement API endpoints
2. Add data models and database changes
3. Implement business logic and validation
4. Add comprehensive unit tests

**Phase 3: Frontend Implementation**
1. Create/update UI components
2. Implement state management
3. Add user interactions and validations
4. Ensure responsive design

**Phase 4: Integration & Testing**
1. Connect frontend to backend APIs
2. Implement end-to-end tests
3. Test cross-browser compatibility
4. Performance optimization

**Phase 5: Deployment & Monitoring**
1. Prepare deployment configurations
2. Set up monitoring and logging
3. Deploy to staging environment
4. Conduct final validation and deployment

**Quality Gates:**
- All tests passing (unit, integration, e2e)
- Code review completed
- Security review passed
- Performance benchmarks met
- Documentation updated

**Success Metrics:**
- Feature fully functional across all environments
- No production incidents post-deployment
- User acceptance criteria met
- Performance within acceptable limits`,
    expectedTools: ['read_file', 'grep', 'search_replace', 'run_terminal_cmd', 'todo_write', 'analyze_tools']
  },

  {
    id: 'production-debugging-orchestration',
    name: 'Production Debugging Orchestration',
    description: 'Systematic debugging of production issues using coordinated diagnostic tools',
    category: 'tool-chaining',
    tags: ['debugging', 'production', 'orchestration', 'diagnostics', 'incident-response'],
    complexity: 'high',
    useCase: 'Debugging complex production issues with minimal downtime',
    prompt: `Execute systematic production debugging using this orchestration chain:

**Chain Objective:** Resolve production issues quickly with minimal impact

**Required Tools:** grep, read_file, run_terminal_cmd, analyze_tools, sequentialthinking

**Emergency Response Protocol:**

**Step 1: Issue Triage & Assessment**
- Gather error logs and monitoring data
- Assess impact and urgency
- Notify stakeholders and prepare incident response

**Step 2: Diagnostic Data Collection**
- Collect application logs from affected systems
- Gather system metrics (CPU, memory, network)
- Review recent deployments and configuration changes
- Analyze error patterns and frequency

**Step 3: Root Cause Analysis**
- Reproduce issue in staging environment if possible
- Use sequential thinking to analyze error patterns
- Trace data flow through affected systems
- Identify potential causes (code, config, infrastructure)

**Step 4: Solution Development**
- Develop and test fix in isolated environment
- Prepare rollback plan and validation steps
- Coordinate with team for review and approval

**Step 5: Deployment & Validation**
- Deploy fix using blue-green or canary deployment
- Monitor system health and error rates
- Validate fix effectiveness and system stability
- Conduct post-mortem analysis

**Step 6: Prevention & Learning**
- Update monitoring and alerting rules
- Document incident and resolution
- Implement preventive measures
- Update runbooks and knowledge base

**Time-to-Resolution Targets:**
- Critical Issues: < 1 hour
- High Priority: < 4 hours
- Medium Priority: < 24 hours
- Low Priority: < 72 hours

**Communication Requirements:**
- Regular status updates to stakeholders
- Clear documentation of findings and actions
- Post-incident review and improvement recommendations`,
    expectedTools: ['grep', 'read_file', 'run_terminal_cmd', 'analyze_tools', 'sequentialthinking', 'todo_write']
  },

  {
    id: 'cross-server-data-pipeline-orchestration',
    name: 'Cross-Server Data Pipeline Orchestration',
    description: 'Build and manage data pipelines across multiple MCP servers',
    category: 'tool-chaining',
    tags: ['data-pipeline', 'orchestration', 'cross-server', 'etl', 'data-processing'],
    complexity: 'high',
    useCase: 'Creating automated data processing pipelines using multiple MCP servers',
    prompt: `Design and implement cross-server data pipeline orchestration:

**Chain Objective:** Create reliable data processing pipelines spanning multiple MCP servers

**Required Tools:** analyze_tools, generate_route_suggestions, workflow_orchestrator, get_tool_chain_analysis

**Pipeline Design Principles:**

**Step 1: Requirements Analysis**
- Define data sources and destinations
- Specify transformation requirements
- Identify performance and reliability needs
- Assess data volume and processing frequency

**Step 2: Server Capability Assessment**
- Analyze available MCP servers and their data tools
- Identify complementary capabilities
- Map data formats and protocols
- Evaluate server reliability and performance

**Step 3: Pipeline Architecture Design**
- Design data flow between servers
- Plan error handling and recovery
- Implement monitoring and alerting
- Define data validation and quality checks

**Step 4: Implementation & Testing**
- Build pipeline components incrementally
- Test each transformation step
- Validate data integrity throughout pipeline
- Performance testing under load

**Step 5: Deployment & Monitoring**
- Deploy pipeline to production environment
- Set up comprehensive monitoring
- Implement automated recovery procedures
- Establish performance baselines

**Step 6: Maintenance & Optimization**
- Monitor pipeline performance and reliability
- Optimize bottlenecks and resource usage
- Update pipeline for changing requirements
- Document and maintain runbooks

**Data Pipeline Best Practices:**
- Idempotent operations (safe to retry)
- Comprehensive error handling and logging
- Data validation at each step
- Graceful degradation on failures
- Automated testing and validation
- Clear monitoring and alerting

**Success Metrics:**
- Data processing accuracy > 99.9%
- Pipeline uptime > 99.5%
- Processing latency within SLAs
- Automated error recovery > 95% effective
- Clear monitoring and alerting coverage`,
    expectedTools: ['analyze_tools', 'generate_route_suggestions', 'workflow_orchestrator', 'get_tool_chain_analysis', 'sequentialthinking']
  },

  {
    id: 'ai-enhanced-development-workflow',
    name: 'AI-Enhanced Development Workflow',
    description: 'Leverage AI capabilities across development lifecycle using multiple MCP servers',
    category: 'tool-chaining',
    tags: ['ai-enhanced', 'development', 'workflow', 'automation', 'intelligence'],
    complexity: 'high',
    useCase: 'Using AI capabilities to enhance development productivity and quality',
    prompt: `Implement AI-enhanced development workflow using coordinated MCP servers:

**Chain Objective:** Maximize development productivity through intelligent tool orchestration

**Required Tools:** analyze_tools, generate_route_suggestions, awesome_copilot_search_instructions, brainstorming, sequentialthinking

**AI-Enhanced Development Phases:**

**Phase 1: Intelligent Planning**
1. Use brainstorming to explore solution approaches
2. Leverage awesome-copilot for best practice research
3. Apply sequential thinking for complex requirement analysis
4. Generate comprehensive implementation plans

**Phase 2: Smart Code Generation**
1. Analyze existing codebase patterns
2. Use awesome-copilot instructions for code generation
3. Apply intelligent routing for optimal tool selection
4. Generate context-aware code suggestions

**Phase 3: Automated Quality Assurance**
1. Implement comprehensive testing strategies
2. Use AI for test case generation and optimization
3. Automate code review and quality checks
4. Intelligent bug detection and fixing

**Phase 4: Continuous Learning & Improvement**
1. Capture development patterns and outcomes
2. Learn from successful implementations
3. Improve tool selection based on historical data
4. Evolve development processes through AI insights

**AI Integration Strategies:**
- **Context Awareness**: Understand project context and constraints
- **Pattern Recognition**: Learn from successful implementations
- **Intelligent Routing**: Select optimal tools for each task
- **Quality Enhancement**: Apply AI for code review and improvement
- **Knowledge Synthesis**: Combine insights from multiple sources

**Benefits Expected:**
- 40-60% reduction in development time
- Improved code quality and consistency
- Proactive issue identification
- Enhanced decision making
- Accelerated learning curve

**Implementation Guidelines:**
- Start with pilot projects to validate approach
- Establish clear success metrics and KPIs
- Provide training and documentation
- Monitor AI tool effectiveness and accuracy
- Continuously refine and improve the workflow`,
    expectedTools: ['analyze_tools', 'generate_route_suggestions', 'awesome_copilot_search_instructions', 'brainstorming', 'sequentialthinking', 'todo_write']
  },

  {
    id: 'enterprise-scale-architecture-orchestration',
    name: 'Enterprise-Scale Architecture Orchestration',
    description: 'Design and implement enterprise-scale systems using orchestrated MCP server capabilities',
    category: 'tool-chaining',
    tags: ['enterprise', 'architecture', 'orchestration', 'scalability', 'complex-systems'],
    complexity: 'high',
    useCase: 'Managing complex enterprise architecture using coordinated tool chains',
    prompt: `Orchestrate enterprise-scale architecture using comprehensive tool chains:

**Chain Objective:** Design and implement scalable enterprise systems with coordinated tools

**Required Tools:** analyze_tools, generate_route_suggestions, get_tool_chain_analysis, sequentialthinking, workflow_orchestrator

**Enterprise Architecture Framework:**

**Phase 1: Strategic Analysis**
1. Assess business requirements and constraints
2. Analyze existing system landscape
3. Identify architectural gaps and opportunities
4. Define architectural principles and standards

**Phase 2: System Design & Planning**
1. Design high-level system architecture
2. Define component interactions and interfaces
3. Plan scalability and performance requirements
4. Establish security and compliance frameworks

**Phase 3: Implementation Orchestration**
1. Break down architecture into implementable components
2. Coordinate development across multiple teams
3. Implement automated testing and validation
4. Establish continuous integration pipelines

**Phase 4: Deployment & Migration**
1. Plan deployment strategy and rollback procedures
2. Implement gradual migration approaches
3. Establish monitoring and observability
4. Validate system performance and reliability

**Phase 5: Operations & Evolution**
1. Implement operational procedures and runbooks
2. Establish performance monitoring and alerting
3. Plan for system evolution and scaling
4. Implement continuous improvement processes

**Enterprise Considerations:**
- **Scalability**: Design for growth and changing loads
- **Reliability**: Implement redundancy and fault tolerance
- **Security**: Comprehensive security across all layers
- **Compliance**: Meet regulatory and industry standards
- **Maintainability**: Design for long-term operational efficiency
- **Cost Optimization**: Balance performance with operational costs

**Success Metrics:**
- System availability > 99.9%
- Performance meets or exceeds SLAs
- Security compliance maintained
- Operational costs within budget
- Team productivity and satisfaction

**Governance & Control:**
- Architecture review boards and approval processes
- Standardized development and deployment processes
- Comprehensive documentation and knowledge management
- Regular architecture assessments and updates`,
    expectedTools: ['analyze_tools', 'generate_route_suggestions', 'get_tool_chain_analysis', 'sequentialthinking', 'workflow_orchestrator', 'todo_write']
  },

  // Monitoring & Analytics Prompts
  {
    id: 'system-health-monitoring',
    name: 'System Health Monitoring',
    description: 'Comprehensive monitoring of MCP server health and performance metrics',
    category: 'monitoring',
    tags: ['monitoring', 'health', 'performance', 'metrics', 'observability'],
    complexity: 'medium',
    useCase: 'Monitoring MCP server ecosystem health and identifying performance issues',
    prompt: `Monitor the health and performance of your MCP server ecosystem:

1. **Server Availability Check**: Verify all configured MCP servers are responding
2. **Performance Metrics**: Monitor response times, error rates, and throughput
3. **Resource Usage**: Track memory, CPU, and network utilization
4. **Error Analysis**: Identify patterns in errors and failures
5. **Capacity Planning**: Monitor trends to predict scaling needs

**Monitoring Strategy:**
- Check server discovery and tool analysis regularly
- Monitor workflow execution times and success rates
- Track tool usage patterns and performance bottlenecks
- Set up alerts for critical failures or performance degradation
- Maintain historical data for trend analysis

Use the available tools to gather comprehensive health data across all MCP servers.`,
    expectedTools: ['list_mcp_servers', 'analyze_tools', 'run_terminal_cmd', 'grep']
  },

  {
    id: 'performance-bottleneck-analysis',
    name: 'Performance Bottleneck Analysis',
    description: 'Identify and resolve performance bottlenecks in tool chains and workflows',
    category: 'analytics',
    tags: ['performance', 'bottlenecks', 'optimization', 'analysis', 'metrics'],
    complexity: 'high',
    useCase: 'Analyzing tool chain performance to identify and fix bottlenecks',
    prompt: `Analyze performance bottlenecks in your tool chains and MCP workflows:

1. **Baseline Measurement**: Establish performance baselines for all tools
2. **Bottleneck Identification**: Identify the slowest components in chains
3. **Dependency Analysis**: Check if dependencies are causing cascading delays
4. **Resource Optimization**: Optimize resource usage and parallel execution
5. **Caching Strategy**: Implement caching for expensive operations

**Analysis Steps:**
- Measure execution time for individual tools and complete chains
- Identify sequential vs parallel execution opportunities
- Check for redundant operations that can be eliminated
- Analyze memory and network usage patterns
- Implement performance monitoring and alerting

Use performance analysis tools to create optimized, efficient workflows.`,
    expectedTools: ['get_tool_chain_analysis', 'analyze_tool_chain_performance', 'validate_tool_chain', 'run_terminal_cmd']
  },

  {
    id: 'tool-usage-analytics',
    name: 'Tool Usage Analytics',
    description: 'Analyze tool usage patterns and optimize MCP server configurations',
    category: 'analytics',
    tags: ['analytics', 'usage', 'patterns', 'optimization', 'insights'],
    complexity: 'medium',
    useCase: 'Understanding how tools are used to improve configurations and workflows',
    prompt: `Analyze tool usage patterns across your MCP server ecosystem:

1. **Usage Patterns**: Identify which tools are used most frequently
2. **Success Rates**: Track success/failure rates for different tools
3. **Tool Combinations**: Find common tool chaining patterns
4. **Performance Correlation**: Correlate tool performance with usage patterns
5. **Optimization Opportunities**: Identify underutilized or inefficient tools

**Analytics Approach:**
- Collect usage data over time periods
- Analyze tool success rates and error patterns
- Identify frequently chained tool combinations
- Map tool usage to business outcomes
- Generate recommendations for configuration improvements

Use this data to optimize your MCP server setup and improve workflow efficiency.`,
    expectedTools: ['analyze_tools', 'get_tool_chain_analysis', 'list_mcp_servers', 'sequentialthinking']
  },

  {
    id: 'workflow-reliability-assessment',
    name: 'Workflow Reliability Assessment',
    description: 'Assess and improve the reliability of complex MCP workflows',
    category: 'monitoring',
    tags: ['reliability', 'workflows', 'assessment', 'resilience', 'monitoring'],
    complexity: 'high',
    useCase: 'Ensuring workflows are reliable and can handle failures gracefully',
    prompt: `Assess and improve workflow reliability in your MCP ecosystem:

1. **Reliability Metrics**: Track success rates and failure patterns
2. **Failure Analysis**: Identify common failure points and causes
3. **Resilience Testing**: Test workflows under various failure conditions
4. **Recovery Mechanisms**: Implement retry logic and fallback strategies
5. **Monitoring Setup**: Establish comprehensive workflow monitoring

**Assessment Framework:**
- Measure workflow completion rates over time
- Identify single points of failure in tool chains
- Test recovery mechanisms and error handling
- Implement circuit breakers for unreliable components
- Set up automated retry and recovery procedures

Create robust, reliable workflows that can handle failures gracefully and maintain service continuity.`,
    expectedTools: ['workflow_orchestrator', 'validate_tool_chain', 'analyze_tool_chain_performance', 'sequentialthinking']
  },

  {
    id: 'cost-optimization-analysis',
    name: 'Cost Optimization Analysis',
    description: 'Analyze and optimize costs associated with MCP server usage and tool chains',
    category: 'analytics',
    tags: ['cost', 'optimization', 'efficiency', 'analytics', 'resource-management'],
    complexity: 'medium',
    useCase: 'Optimizing resource usage and reducing operational costs',
    prompt: `Analyze and optimize costs in your MCP server ecosystem:

1. **Resource Consumption**: Track compute, memory, and network usage
2. **Cost Attribution**: Attribute costs to specific tools and workflows
3. **Efficiency Analysis**: Identify inefficient resource usage patterns
4. **Optimization Opportunities**: Find ways to reduce costs without sacrificing performance
5. **Budget Planning**: Plan resource allocation based on usage patterns

**Cost Optimization Strategy:**
- Monitor resource usage across all MCP servers
- Identify expensive operations and optimization opportunities
- Implement caching and resource sharing where beneficial
- Optimize tool chains for cost efficiency
- Set up cost monitoring and alerting

Balance performance requirements with cost efficiency to optimize your MCP infrastructure.`,
    expectedTools: ['analyze_tool_chain_performance', 'get_tool_chain_analysis', 'run_terminal_cmd', 'list_mcp_servers']
  },

  // Security & Compliance Prompts
  {
    id: 'security-vulnerability-assessment',
    name: 'Security Vulnerability Assessment',
    description: 'Comprehensive security assessment of MCP servers and tool chains',
    category: 'security',
    tags: ['security', 'vulnerability', 'assessment', 'audit', 'compliance'],
    complexity: 'high',
    useCase: 'Identifying and mitigating security vulnerabilities in MCP ecosystems',
    prompt: `Conduct a comprehensive security vulnerability assessment:

1. **Server Security**: Assess MCP server security configurations
2. **Tool Chain Security**: Analyze security implications of tool combinations
3. **Data Protection**: Ensure sensitive data is handled securely
4. **Access Control**: Verify proper authentication and authorization
5. **Compliance Checks**: Validate compliance with security standards

**Assessment Framework:**
- Review server configurations for security best practices
- Analyze tool chains for potential security vulnerabilities
- Check data handling and transmission security
- Validate access controls and permissions
- Implement security monitoring and alerting

Ensure your MCP ecosystem meets security standards and protects sensitive information.`,
    expectedTools: ['grep', 'read_file', 'run_terminal_cmd', 'list_mcp_servers', 'analyze_tools']
  },

  {
    id: 'compliance-audit-workflow',
    name: 'Compliance Audit Workflow',
    description: 'Conduct compliance audits for regulatory requirements and standards',
    category: 'compliance',
    tags: ['compliance', 'audit', 'regulatory', 'standards', 'governance'],
    complexity: 'high',
    useCase: 'Ensuring MCP server usage complies with regulatory and organizational standards',
    prompt: `Conduct comprehensive compliance audits for your MCP ecosystem:

1. **Regulatory Compliance**: Verify compliance with relevant regulations
2. **Data Governance**: Ensure proper data handling and retention
3. **Access Governance**: Validate user access controls and permissions
4. **Audit Trails**: Maintain comprehensive audit logs
5. **Policy Enforcement**: Ensure organizational policies are followed

**Audit Process:**
- Review all MCP server configurations against compliance requirements
- Analyze data flows for compliance with data protection regulations
- Validate access controls and permission structures
- Check audit logging and monitoring capabilities
- Generate compliance reports and remediation plans

Maintain ongoing compliance with regulatory requirements and organizational policies.`,
    expectedTools: ['read_file', 'grep', 'run_terminal_cmd', 'list_mcp_servers', 'analyze_tools']
  },

  {
    id: 'data-privacy-protection',
    name: 'Data Privacy Protection',
    description: 'Implement data privacy protection measures in MCP workflows',
    category: 'security',
    tags: ['privacy', 'data-protection', 'gdpr', 'compliance', 'security'],
    complexity: 'high',
    useCase: 'Protecting sensitive data in MCP server operations and tool chains',
    prompt: `Implement comprehensive data privacy protection measures:

1. **Data Classification**: Identify and classify sensitive data types
2. **Privacy Impact Assessment**: Assess privacy implications of tool chains
3. **Data Minimization**: Ensure only necessary data is collected and processed
4. **Consent Management**: Validate data processing consents
5. **Privacy Controls**: Implement privacy-preserving techniques

**Privacy Protection Framework:**
- Identify all data types processed by MCP tools
- Implement data anonymization and pseudonymization where appropriate
- Ensure proper consent mechanisms for data processing
- Implement data retention and deletion policies
- Set up privacy monitoring and breach detection

Protect user privacy while maintaining functionality in your MCP ecosystem.`,
    expectedTools: ['grep', 'read_file', 'analyze_tools', 'validate_tool_chain', 'run_terminal_cmd']
  },

  {
    id: 'access-control-audit',
    name: 'Access Control Audit',
    description: 'Audit and improve access control mechanisms in MCP server ecosystem',
    category: 'security',
    tags: ['access-control', 'audit', 'authorization', 'authentication', 'security'],
    complexity: 'medium',
    useCase: 'Ensuring proper access controls are implemented and maintained',
    prompt: `Conduct comprehensive access control audits:

1. **Authentication Review**: Verify authentication mechanisms
2. **Authorization Analysis**: Check permission structures and roles
3. **Access Patterns**: Analyze normal vs suspicious access patterns
4. **Privilege Escalation**: Identify potential privilege escalation vulnerabilities
5. **Access Monitoring**: Implement continuous access monitoring

**Audit Methodology:**
- Review all authentication and authorization configurations
- Analyze role-based access control implementations
- Check for least privilege principle adherence
- Implement access logging and monitoring
- Set up alerts for suspicious access patterns

Maintain secure access controls throughout your MCP server ecosystem.`,
    expectedTools: ['read_file', 'grep', 'run_terminal_cmd', 'list_mcp_servers', 'analyze_tools']
  },

  {
    id: 'incident-response-planning',
    name: 'Incident Response Planning',
    description: 'Develop and maintain incident response plans for MCP server ecosystem',
    category: 'security',
    tags: ['incident-response', 'planning', 'security', 'disaster-recovery', 'monitoring'],
    complexity: 'high',
    useCase: 'Preparing for and responding to security incidents and system failures',
    prompt: `Develop comprehensive incident response plans for your MCP ecosystem:

1. **Threat Assessment**: Identify potential threats and vulnerabilities
2. **Response Procedures**: Define clear incident response procedures
3. **Communication Plans**: Establish incident communication protocols
4. **Recovery Strategies**: Plan system recovery and data restoration
5. **Testing and Drills**: Regular testing of incident response capabilities

**Incident Response Framework:**
- Define incident classification and escalation procedures
- Establish clear roles and responsibilities during incidents
- Implement automated alerting and notification systems
- Create backup and recovery procedures
- Conduct regular incident response drills and training

Ensure rapid, effective response to security incidents and system failures.`,
    expectedTools: ['workflow_orchestrator', 'run_terminal_cmd', 'list_mcp_servers', 'sequentialthinking', 'todo_write']
  }
];

/**
 * Predefined resource sets for different development scenarios
 */
export const predefinedResourceSets: ResourceSet[] = [
  {
    id: 'development-starter-kit',
    name: 'Development Starter Kit',
    description: 'Essential resources for getting started with development tasks',
    category: 'development',
    complexity: 'low',
    tags: ['starter', 'basics', 'getting-started', 'essentials'],
    resources: [
      {
        type: 'prompt',
        name: 'Analyze Project Structure',
        content: 'analyze-project-structure',
        description: 'Comprehensive analysis of project structure and dependencies'
      },
      {
        type: 'prompt',
        name: 'Feature Implementation',
        content: 'feature-implementation',
        description: 'Complete workflow for implementing new features'
      },
      {
        type: 'prompt',
        name: 'Code Refactoring',
        content: 'code-refactoring',
        description: 'Refactor code for better maintainability and performance'
      }
    ]
  },
  {
    id: 'debugging-toolbox',
    name: 'Debugging Toolbox',
    description: 'Comprehensive debugging techniques and workflows',
    category: 'debugging',
    complexity: 'medium',
    tags: ['debugging', 'troubleshooting', 'error-analysis', 'problem-solving'],
    resources: [
      {
        type: 'prompt',
        name: 'Debug Error Tracing',
        content: 'debug-error-tracing',
        description: 'Systematic approach to tracing and debugging errors'
      },
      {
        type: 'prompt',
        name: 'Production Debugging Orchestration',
        content: 'production-debugging-orchestration',
        description: 'Systematic debugging of production issues'
      },
      {
        type: 'prompt',
        name: 'Multi-Server Debugging Orchestration',
        content: 'multi-server-debugging-orchestration',
        description: 'Debug issues that span multiple MCP servers'
      }
    ]
  },
  {
    id: 'performance-optimization-kit',
    name: 'Performance Optimization Kit',
    description: 'Tools for performance analysis and improvement',
    category: 'optimization',
    complexity: 'high',
    tags: ['performance', 'optimization', 'bottlenecks', 'efficiency'],
    resources: [
      {
        type: 'prompt',
        name: 'Performance Optimization',
        content: 'performance-optimization',
        description: 'Identify and fix performance bottlenecks'
      },
      {
        type: 'prompt',
        name: 'Performance Bottleneck Analysis',
        content: 'performance-bottleneck-analysis',
        description: 'Identify and resolve performance bottlenecks in tool chains'
      },
      {
        type: 'prompt',
        name: 'Cost Optimization Analysis',
        content: 'cost-optimization-analysis',
        description: 'Analyze and optimize costs associated with MCP server usage'
      }
    ]
  },
  {
    id: 'tool-chaining-mastery',
    name: 'Tool Chaining Mastery',
    description: 'Advanced techniques for complex tool orchestration',
    category: 'tool-chaining',
    complexity: 'high',
    tags: ['tool-chaining', 'orchestration', 'advanced', 'complexity'],
    resources: [
      {
        type: 'prompt',
        name: 'Tool Chaining Basics',
        content: 'tool-chaining-basics',
        description: 'Learn how to effectively chain multiple tools together'
      },
      {
        type: 'prompt',
        name: 'Intelligent Route Optimization',
        content: 'intelligent-route-optimization',
        description: 'Optimize execution routes for complex multi-step tasks'
      },
      {
        type: 'prompt',
        name: 'Comprehensive Project Assessment Chain',
        content: 'comprehensive-project-assessment-chain',
        description: 'Execute complete project assessment using multiple analysis techniques'
      },
      {
        type: 'prompt',
        name: 'Full-Stack Feature Implementation Chain',
        content: 'full-stack-feature-implementation-chain',
        description: 'Complete feature implementation from design to deployment'
      },
      {
        type: 'prompt',
        name: 'Cross-Server Data Pipeline Orchestration',
        content: 'cross-server-data-pipeline-orchestration',
        description: 'Build and manage data pipelines across multiple MCP servers'
      },
      {
        type: 'prompt',
        name: 'Enterprise-Scale Architecture Orchestration',
        content: 'enterprise-scale-architecture-orchestration',
        description: 'Design and implement enterprise-scale systems'
      }
    ]
  },
  {
    id: 'awesome-copilot-collections',
    name: 'Awesome Copilot Collections',
    description: 'Curated collections of development resources',
    category: 'integration',
    complexity: 'medium',
    tags: ['awesome-copilot', 'collections', 'resources', 'curated'],
    resources: [
      {
        type: 'prompt',
        name: 'Awesome Copilot Integration Workflow',
        content: 'awesome-copilot-integration-workflow',
        description: 'Leverage awesome-copilot resources for enhanced development workflows'
      },
      {
        type: 'prompt',
        name: 'AI-Enhanced Development Workflow',
        content: 'ai-enhanced-development-workflow',
        description: 'Leverage AI capabilities across development lifecycle'
      }
    ]
  },
  {
    id: 'observability-suite',
    name: 'Observability Suite',
    description: 'Comprehensive monitoring and observability resources for MCP ecosystems',
    category: 'monitoring',
    complexity: 'medium',
    tags: ['observability', 'monitoring', 'metrics', 'logging', 'tracing'],
    resources: [
      {
        type: 'prompt',
        name: 'System Health Monitoring',
        content: 'system-health-monitoring',
        description: 'Comprehensive monitoring of MCP server health and performance'
      },
      {
        type: 'prompt',
        name: 'Workflow Reliability Assessment',
        content: 'workflow-reliability-assessment',
        description: 'Assess and improve the reliability of complex MCP workflows'
      },
      {
        type: 'prompt',
        name: 'Tool Usage Analytics',
        content: 'tool-usage-analytics',
        description: 'Analyze tool usage patterns and optimize MCP server configurations'
      }
    ]
  },
  {
    id: 'analytics-toolkit',
    name: 'Analytics Toolkit',
    description: 'Advanced analytics tools and resources for MCP ecosystem optimization',
    category: 'analytics',
    complexity: 'high',
    tags: ['analytics', 'insights', 'optimization', 'data-analysis'],
    resources: [
      {
        type: 'prompt',
        name: 'Tool Usage Analytics',
        content: 'tool-usage-analytics',
        description: 'Analyze tool usage patterns and optimize configurations'
      },
      {
        type: 'prompt',
        name: 'Performance Bottleneck Analysis',
        content: 'performance-bottleneck-analysis',
        description: 'Identify and resolve performance bottlenecks'
      },
      {
        type: 'prompt',
        name: 'Cost Optimization Analysis',
        content: 'cost-optimization-analysis',
        description: 'Analyze and optimize costs associated with MCP server usage'
      }
    ]
  },
  {
    id: 'reliability-engineering-kit',
    name: 'Reliability Engineering Kit',
    description: 'Resources for building and maintaining reliable MCP server ecosystems',
    category: 'reliability',
    complexity: 'high',
    tags: ['reliability', 'resilience', 'fault-tolerance', 'engineering'],
    resources: [
      {
        type: 'prompt',
        name: 'Workflow Reliability Assessment',
        content: 'workflow-reliability-assessment',
        description: 'Assess and improve workflow reliability'
      },
      {
        type: 'prompt',
        name: 'Predictive Workflow Optimization',
        content: 'predictive-workflow-optimization',
        description: 'Optimize workflows based on predicted outcomes'
      },
      {
        type: 'prompt',
        name: 'Incident Response Planning',
        content: 'incident-response-planning',
        description: 'Develop and maintain incident response plans'
      }
    ]
  },
  {
    id: 'security-assessment-suite',
    name: 'Security Assessment Suite',
    description: 'Comprehensive security assessment and vulnerability management resources',
    category: 'security',
    complexity: 'high',
    tags: ['security', 'assessment', 'vulnerability', 'risk-management'],
    resources: [
      {
        type: 'prompt',
        name: 'Security Vulnerability Assessment',
        content: 'security-vulnerability-assessment',
        description: 'Comprehensive security assessment of MCP servers and tool chains'
      },
      {
        type: 'prompt',
        name: 'Data Privacy Protection',
        content: 'data-privacy-protection',
        description: 'Implement data privacy protection measures'
      },
      {
        type: 'prompt',
        name: 'Access Control Audit',
        content: 'access-control-audit',
        description: 'Audit and improve access control mechanisms'
      }
    ]
  },
  {
    id: 'compliance-management-suite',
    name: 'Compliance Management Suite',
    description: 'Resources for managing regulatory compliance and governance',
    category: 'compliance',
    complexity: 'high',
    tags: ['compliance', 'regulatory', 'governance', 'audit', 'standards'],
    resources: [
      {
        type: 'prompt',
        name: 'Compliance Audit Workflow',
        content: 'compliance-audit-workflow',
        description: 'Conduct compliance audits for regulatory requirements'
      },
      {
        type: 'prompt',
        name: 'Security Vulnerability Assessment',
        content: 'security-vulnerability-assessment',
        description: 'Comprehensive security assessment'
      },
      {
        type: 'prompt',
        name: 'Data Privacy Protection',
        content: 'data-privacy-protection',
        description: 'Implement data privacy protection measures'
      }
    ]
  },
  {
    id: 'privacy-protection-framework',
    name: 'Privacy Protection Framework',
    description: 'Resources for implementing and maintaining data privacy protections',
    category: 'security',
    complexity: 'high',
    tags: ['privacy', 'data-protection', 'gdpr', 'compliance', 'pii'],
    resources: [
      {
        type: 'prompt',
        name: 'Data Privacy Protection',
        content: 'data-privacy-protection',
        description: 'Implement data privacy protection measures'
      },
      {
        type: 'prompt',
        name: 'Compliance Audit Workflow',
        content: 'compliance-audit-workflow',
        description: 'Conduct compliance audits'
      }
    ]
  },
  {
    id: 'incident-response-playbook',
    name: 'Incident Response Playbook',
    description: 'Comprehensive incident response resources and procedures',
    category: 'security',
    complexity: 'high',
    tags: ['incident-response', 'playbook', 'disaster-recovery', 'business-continuity'],
    resources: [
      {
        type: 'prompt',
        name: 'Incident Response Planning',
        content: 'incident-response-planning',
        description: 'Develop and maintain incident response plans'
      },
      {
        type: 'prompt',
        name: 'Production Debugging Orchestration',
        content: 'production-debugging-orchestration',
        description: 'Systematic debugging of production issues'
      }
    ]
  }
];
