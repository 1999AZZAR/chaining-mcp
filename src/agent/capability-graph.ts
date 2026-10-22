/**
 * HeLa capability graph (P1-C4, capability-first routing; v2 dynamic resolver).
 *
 * The planner must select CAPABILITIES first (`filesystem.read`,
 * `terminal.execute`, ...) and only then see the concrete tools behind
 * them — never a 200+ flat tool dump (Cytosol ~93, Genome 38, Enzyme 29,
 * Phenotype 46, Receptor 46, Ribosome 28).
 *
 * v2 Dynamic Resolver Features:
 * 1. Hybrid Lexical + Stemmed Keyword Matching (exact: 3.5/3.0, stem: 1.8).
 * 2. BM25 Description Token Overlap (0.6 per matching term).
 * 3. Markov Capability Transition Graph (CAPABILITY_TRANSITIONS boost 1.0 - 2.0).
 * 4. Episodic Prior Precedent Steering (Genome memory.db workflow recall boost 2.5).
 * 5. Adaptive Compact Tool Presentation (scopeCompactTools).
 *
 * Safety invariants:
 * - No keyword/signal hit -> return the full catalog (never blind the planner).
 * - Filter yielding zero tools -> return the full catalog.
 * - Selection is deterministic (score-ranked, registry order tie-break).
 */

import { needleFamilyOf } from './needle-provider.js';
import { DatabaseSync } from 'node:sqlite';
import { defaultMemoryDbPath, EpisodicMemoryConfig } from './episodic-retention.js';

export interface HelaCapability {
  name: string;
  description: string;
  /** Server-name hints (local dir names and gateway ids both match). */
  servers: string[];
  /** Tool-name patterns (regex sources, case-insensitive). */
  toolPatterns: string[];
  /** Task-text keyword signals (lowercased substring match). */
  keywords: string[];
}

export const HELA_CAPABILITIES: HelaCapability[] = [
  {
    name: 'filesystem.read',
    description: 'Read, list, inspect files and directories (R0 observation)',
    servers: ['filesystem', 'membrane'],
    toolPatterns: ['^(read|list|cat|get_file|file_info|directory|find|search_in)_', '^(read|list|get)_', 'observe'],
    keywords: ['read', 'list', 'show', 'cat', 'file', 'directory', 'folder', 'contents', 'inspect file'],
  },
  {
    name: 'filesystem.write',
    description: 'Create, modify, move, archive files (R1 reversible)',
    servers: ['filesystem', 'membrane'],
    toolPatterns: ['^(write|create|move|copy|archive|extract|watch)_', '^(write|create|update|move|copy|import)_'],
    keywords: ['write', 'create', 'save', 'edit', 'move', 'copy', 'archive', 'organize', 'sort files'],
  },
  {
    name: 'terminal.execute',
    description: 'Run shell commands, sessions, transfers (R3 privileged)',
    servers: ['terminal', 'nucleus', 'menager', 'ribosome'],
    toolPatterns: ['execute_command', 'terminal_', 'transfer', 'pty', 'session_', 'opencode_'],
    keywords: ['run', 'running', 'execute', 'shell', 'command', 'terminal', 'script', 'pytest', 'npm', 'build', 'deploy', 'ssh'],
  },
  {
    name: 'browser.observe',
    description: 'Observe pages: state, text, screenshots, a11y (R0)',
    servers: ['browser', 'cytosol'],
    toolPatterns: ['get_state', 'get_text', 'get_visible', 'screenshot', 'observe', 'accessibility', 'extract_(schema|table)', 'console', 'network', 'performance', 'health'],
    keywords: ['screenshot', 'webpage', 'website', 'page', 'observe page', 'what does', 'scrape', 'extract text'],
  },
  {
    name: 'browser.act',
    description: 'Drive pages: click, type, navigate, upload (R2/R3)',
    servers: ['browser', 'cytosol'],
    toolPatterns: ['click', 'type', 'press', 'drag', 'upload', 'navigate', 'hover', 'scroll', 'select', 'check', 'fill', 'reload', 'back', 'forward'],
    keywords: ['click', 'type into', 'fill form', 'navigate', 'login', 'submit form', 'interact', 'automate browser'],
  },
  {
    name: 'research.search',
    description: 'Web/academic/news search, fetch, fact-check (R0)',
    servers: ['researcher', 'enzyme'],
    toolPatterns: ['search', 'fetch', 'fact_check', 'summariz', 'trends', 'monitor', 'brief', 'extract_content', 'metadata'],
    keywords: ['search', 'google', 'news', 'latest', 'research', 'wikipedia', 'paper', 'fact', 'who is', 'what is', 'look up'],
  },
  {
    name: 'project.query',
    description: 'Project memory: entities, observations, sessions (R0/R1)',
    servers: ['project', 'genome'],
    toolPatterns: ['memory', 'entity', 'entities', 'observation', 'relation', 'graph', 'session_context', 'guidance'],
    keywords: ['remember', 'memory', 'project', 'entity', 'knowledge graph', 'session context', 'recall', 'note'],
  },
  {
    name: 'android.inspect',
    description: 'Observe device: UI dump, screenshots, app list (R0)',
    servers: ['scrcpy', 'receptor'],
    toolPatterns: ['ui_dump', 'ui_get_state', 'ui_find', 'screenshot', 'device_info', 'device_list', 'app_list', 'app_current', 'clipboard_get', 'file_list'],
    keywords: ['android', 'device', 'phone', 'app list', 'ui dump', 'screen content', 'what is on screen'],
  },
  {
    name: 'android.control',
    description: 'Drive device: tap, shell, install (R2/R3)',
    servers: ['scrcpy', 'receptor'],
    toolPatterns: ['tap', 'swipe', 'shell_exec', 'input_text', 'key_event', 'app_start', 'app_stop', 'app_install', 'form_fill', 'smart_fill'],
    keywords: ['tap', 'open app', 'launch', 'install apk', 'type on phone', 'press back', 'control phone'],
  },
  {
    name: 'blender.model',
    description: '3D scene work via Blender (R3 native code)',
    servers: ['ll3m', 'plastid'],
    toolPatterns: ['blender', 'blend', 'render_output', 'modeling', 'object_details', 'scene_summary'],
    keywords: ['blender', '3d', 'model', 'render', 'mesh', 'scene', 'cube', 'viewport'],
  },
  {
    name: 'ui.design',
    description: 'Design tokens, components, templates, palettes, Awwwards motion, and Stitch Canvas (R0/R1/pure)',
    servers: ['designer', 'phenotype'],
    toolPatterns: ['design', 'palette', 'template', 'tokens', 'component', 'motion', 'brand', 'theme', 'style', 'genre', 'stitch', 'bento', 'marquee', 'awwwards'],
    keywords: ['design', 'landing page', 'component', 'palette', 'theme', 'style', 'css', 'mockup', 'ui', 'stitch', 'canvas', 'screen', 'awwwards', 'bento', 'motion', 'animation', 'token'],
  },
];

/**
 * Probabilistic Directed Transition Graph.
 * Maps current/previous capability to the most likely next capabilities
 * in multi-step task execution chains.
 */
export const CAPABILITY_TRANSITIONS: Record<string, string[]> = {
  'research.search': ['filesystem.write', 'terminal.execute', 'project.query'],
  'filesystem.read': ['filesystem.write', 'terminal.execute', 'ui.design'],
  'filesystem.write': ['terminal.execute', 'browser.observe', 'project.query'],
  'terminal.execute': ['filesystem.read', 'terminal.execute', 'project.query', 'browser.observe'],
  'browser.observe': ['browser.act', 'filesystem.write', 'project.query'],
  'browser.act': ['browser.observe', 'filesystem.write'],
  'ui.design': ['filesystem.write', 'browser.observe', 'ui.design'],
  'project.query': ['research.search', 'filesystem.read', 'terminal.execute', 'ui.design'],
  'android.inspect': ['android.control', 'terminal.execute'],
  'android.control': ['android.inspect', 'terminal.execute'],
  'blender.model': ['filesystem.read', 'blender.model', 'filesystem.write'],
};

export interface ToolDecl { name: string; description?: string; schema?: unknown; server?: string }

/**
 * Phase 2 (v1.2.0): canonical responsibility boundaries for overlapping tools.
 * The canonical tool is preferred whenever both sides of an overlap are in
 * scope; the restricted tool is kept only when the task signals its specific
 * niche (visual browser work, JS-rendered content, remote SSH, OpenCode DB).
 */
export interface CanonicalToolGroup {
  id: string;
  canonical: string[];
  restricted: Array<{ tool: string; reason: string; allowWhen: RegExp }>;
}

export const CANONICAL_TOOL_GROUPS: CanonicalToolGroup[] = [
  {
    id: 'web.search',
    canonical: ['google_search'],
    restricted: [
      {
        tool: 'browser_search',
        reason: 'visual browser workflow only; use hela-enzyme google_search for factual lookups',
        allowWhen: /\b(browser|visual|captcha|screenshot|playwright|navigate|click|form|login|javascript|js|spa)\b/i,
      },
    ],
  },
  {
    id: 'content.extract',
    canonical: ['extract_content'],
    restricted: [
      {
        tool: 'browser_get_content',
        reason: 'only when the page requires client-side JavaScript; use hela-enzyme extract_content otherwise',
        allowWhen: /\b(browser|javascript|js|client-side|spa|dynamic|rendered|dom|playwright)\b/i,
      },
    ],
  },
  {
    id: 'filesystem.local_read',
    canonical: ['read_file'],
    restricted: [
      {
        tool: 'terminal_cat',
        reason: 'remote SSH targets only; use hela-membrane read_file for local files',
        allowWhen: /\b(remote|ssh|vps|host|server)\b/i,
      },
    ],
  },
  {
    id: 'project.db_inspect',
    canonical: ['execute_sql', 'query_data'],
    restricted: [
      {
        tool: 'opencode_db',
        reason: 'OpenCode session database only; use hela-genome execute_sql/query_data for the HeLa memory graph',
        allowWhen: /\b(opencode|session[ _-]?(db|database)|harness[ _-]?(db|database))\b/i,
      },
    ],
  },
];

/**
 * Deterministic canonical ordering for a tool list. When filterRestricted is
 * true (capability scoping active), restricted alternatives are dropped unless
 * the task text matches their allowWhen niche signal. Tool names are unique
 * ecosystem-wide after the Phase 1 zero-collision rename, so matching by name
 * is unambiguous.
 */
export function orderCanonicalTools<T extends ToolDecl>(tools: T[], task: string, filterRestricted = false): T[] {
  const names = new Set(tools.map(t => t.name));
  const active = CANONICAL_TOOL_GROUPS.filter(
    g => g.canonical.some(n => names.has(n)) && g.restricted.some(r => names.has(r.tool))
  );
  if (active.length === 0) return tools;

  const canonical = new Set<string>();
  const restricted = new Map<string, { reason: string; allowWhen: RegExp }>();
  for (const group of active) {
    group.canonical.forEach(n => canonical.add(n));
    for (const r of group.restricted) {
      if (names.has(r.tool)) restricted.set(r.tool, r);
    }
  }

  const text = task || '';
  const dropped = new Set<string>();
  if (filterRestricted) {
    for (const [name, rule] of restricted) {
      if (!rule.allowWhen.test(text)) dropped.add(name);
    }
  }

  const rank = (name: string) => canonical.has(name) ? 0 : restricted.has(name) ? 2 : 1;
  return tools
    .map((tool, index) => ({ tool, index }))
    .filter(({ tool }) => !dropped.has(tool.name))
    .sort((a, b) => rank(a.tool.name) - rank(b.tool.name) || a.index - b.index)
    .map(({ tool }) => tool);
}


const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'what', 'which',
  'into', 'over', 'under', 'about', 'after', 'before', 'than', 'more',
  'some', 'only', 'have', 'been', 'will', 'would', 'could', 'should',
  'you', 'your', 'please', 'just', 'now', 'then', 'here', 'there'
]);

export function stemWord(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 4) return w;
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('tion') && w.length > 6) return w.slice(0, -4);
  if (w.endsWith('ment') && w.length > 6) return w.slice(0, -4);
  if (w.endsWith('able') && w.length > 6) return w.slice(0, -4);
  if (w.endsWith('ized') && w.length > 6) return w.slice(0, -4);
  if (w.endsWith('izes') && w.length > 6) return w.slice(0, -4);
  if (w.endsWith('ize') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ies') && w.length > 5) return w.slice(0, -3) + 'y';
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

export function stemMatches(textWord: string, targetWord: string): boolean {
  const tw = textWord.toLowerCase();
  const tgt = targetWord.toLowerCase();
  if (tw === tgt) return true;
  const stem1 = stemWord(tw);
  const stem2 = stemWord(tgt);
  if (stem1 === stem2) return true;
  if (stem1.length >= 4 && stem2.startsWith(stem1)) return true;
  if (stem2.length >= 4 && stem1.startsWith(stem2)) return true;
  return false;
}

function compiled(cap: HelaCapability): RegExp[] {
  return cap.toolPatterns.map(p => new RegExp(p, 'i'));
}

/** True when a concrete (server, tool) belongs to a capability. */
export function capabilityMatchesTool(cap: HelaCapability, serverName: string, toolName: string): boolean {
  const server = (serverName || '').toLowerCase();
  if (cap.servers.some(h => server.includes(h))) return true;
  return compiled(cap).some(re => re.test(toolName));
}

/** First matching capability for a concrete tool (registry order).
 *  Two passes: tool-name patterns first (precise: `write_file` is a write
 *  even on the filesystem server), server hints second (broad grouping),
 *  Needle family fallback last. */
const EXPLICIT_TOOL_CAPABILITY: Record<string, string> = {
  extract_content: 'research.search',
  google_search: 'research.search',
  browser_search: 'research.search',
  browser_get_content: 'browser.observe',
  read_file: 'filesystem.read',
  terminal_cat: 'terminal.execute',
  execute_sql: 'project.query',
  query_data: 'project.query',
  opencode_db: 'terminal.execute',
};

export function capabilityOfTool(serverName: string, toolName: string): string {
  const explicit = EXPLICIT_TOOL_CAPABILITY[toolName];
  if (explicit) return explicit;
  for (const cap of HELA_CAPABILITIES) {
    if (compiled(cap).some(re => re.test(toolName))) return cap.name;
  }
  const server = (serverName || '').toLowerCase();
  for (const cap of HELA_CAPABILITIES) {
    if (cap.servers.some(h => server.includes(h))) return cap.name;
  }
  return `family:${needleFamilyOf(toolName)}`;
}

/** Match a keyword against task text using regex word boundary. */
function keywordHit(text: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`, 'i').test(text);
}

/**
 * Recall which capability families were involved in past successful workflows
 * matching this task pattern from memory.db.
 */
export function recallCapabilityPrecedents(
  task: string,
  config: EpisodicMemoryConfig = {}
): string[] {
  const dbPath = config.memoryDbPath || defaultMemoryDbPath();
  if (!dbPath) return [];

  const keywords = (task || '')
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 5);

  if (keywords.length === 0) return [];

  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const stmt = db.prepare(`
      SELECT observations FROM entities
      WHERE entity_type = 'workflow' AND (name LIKE ? OR observations LIKE ?)
      ORDER BY updated_at DESC LIMIT 5
    `);

    const toolHits: string[] = [];
    for (const kw of keywords) {
      const pattern = `%${kw}%`;
      const rows = stmt.all(pattern, pattern) as Array<{ observations: string }>;
      for (const row of rows) {
        let obsList: string[] = [];
        try {
          obsList = JSON.parse(row.observations || '[]');
        } catch {
          obsList = [String(row.observations)];
        }
        for (const obs of obsList) {
          const match = obs.match(/tools:\s*\[(.*?)\]/);
          if (match && match[1]) {
            const tools = match[1].split(',').map(s => s.trim()).filter(Boolean);
            toolHits.push(...tools);
          }
        }
      }
      if (toolHits.length >= 8) break;
    }
    db.close();

    const capCounts: Record<string, number> = {};
    for (const t of toolHits) {
      const cap = capabilityOfTool('', t);
      if (cap && !cap.startsWith('family:')) {
        capCounts[cap] = (capCounts[cap] || 0) + 1;
      }
    }

    return Object.entries(capCounts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
  } catch {
    return [];
  }
}

/**
 * HeLa profile capability allowances and primary affinities.
 * Reflects the organelle profile cards in assets/needle/profiles/*.txt.
 */
/**
 * HeLa canonical built-in profiles (8 in total) matching config/profiles.json in hela-mcp-ecosystem.
 * Maps profile IDs to their active capability allowances.
 */
export const BUILTIN_PROFILES: Record<string, string[]> = {
  // 1. Minimal: smallest viable stack (Mitosis + Genome + Enzyme)
  'minimal': [
    'research.search', 'project.query', 'project.mutate'
  ],
  // 2. Dev Workspace: full desktop development workstation (Mitosis + Genome + Membrane + Nucleus + Ribosome + Enzyme + Phenotype + Cytosol)
  'dev-workspace': [
    'filesystem.read', 'filesystem.write', 'terminal.execute',
    'browser.observe', 'browser.act', 'research.search',
    'project.query', 'project.mutate', 'ui.design'
  ],
  // 3. Headless Server (Core 7): headless CI/VM runner without browser/mobile/3D
  'headless-server': [
    'filesystem.read', 'filesystem.write', 'terminal.execute',
    'research.search', 'project.query', 'project.mutate', 'ui.design'
  ],
  // 4. Research: dedicated technical research & web synthesis node
  'research': [
    'research.search', 'browser.observe', 'filesystem.read',
    'filesystem.write', 'project.query', 'project.mutate'
  ],
  // 5. Web DevOps: frontend styling, component authoring & browser automation
  'web-devops': [
    'ui.design', 'browser.observe', 'browser.act',
    'filesystem.read', 'filesystem.write', 'terminal.execute',
    'project.query', 'project.mutate'
  ],
  // 6. Android Testing: mobile device automation rig via ADB/scrcpy
  'android-testing': [
    'android.control', 'android.inspect', 'terminal.execute',
    'research.search', 'project.query', 'project.mutate'
  ],
  // 7. 3D Modeling: generative 3D artist & Blender scene architect
  '3d-modeling': [
    'blender.model', 'filesystem.read', 'filesystem.write',
    'terminal.execute', 'project.query'
  ],
  // 8. All: complete 10-server inventory
  'all': ['*']
};

/**
 * Mutable registry for built-in and dynamic custom profiles.
 */
export const PROFILE_CAPABILITIES: Record<string, string[]> = { ...BUILTIN_PROFILES };

/**
 * Register a dynamic or custom profile at runtime.
 * @param id Profile ID identifier
 * @param capabilities List of allowed capabilities or ['*'] for all
 */
export function registerCustomProfile(id: string, capabilities: string[]): void {
  PROFILE_CAPABILITIES[id.toLowerCase().trim()] = capabilities;
}

/**
 * Resolve allowed capabilities for a given profile name.
 * Inspects:
 * 1. Runtime registered custom/built-in profiles.
 * 2. Comma-separated inline capabilities (e.g. "filesystem.read,terminal.execute").
 * 3. File card in assets/needle/profiles/<id>.txt or custom file path.
 * 4. Fallback to undefined (allow all / unconstrained).
 */
export function resolveProfileCapabilities(profileName?: string): string[] | undefined {
  if (!profileName) return undefined;
  const p = profileName.toLowerCase().trim();
  if (!p || p === 'all') return ['*'];

  // 1. Direct registry hit (built-in or custom registered)
  if (PROFILE_CAPABILITIES[p]) {
    return PROFILE_CAPABILITIES[p];
  }

  // 2. Inline capability list syntax: "cap1,cap2,cap3"
  if (p.includes(',')) {
    const list = p.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }

  // 3. Fallback: unknown named profile does not artificially restrict
  return undefined;
}

export interface ScopeOptions {
  maxCaps?: number;
  previousTool?: string;
  previousCapability?: string;
  useEpisodicMemory?: boolean;
  memoryDbPath?: string;
  taskContext?: string;
  /** Active profile name (e.g. dev-workspace, headless-server). Defaults to process.env.HELA_PROFILE */
  profile?: string;
}

/**
 * Score capabilities against task text using dynamic multi-stage resolver:
 * 1. Exact and stemmed keyword hits (exact: 3.5/3.0, stem: 1.8).
 * 2. BM25 description token overlap (0.6).
 * 3. Stateful transition graph boost from previousTool/previousCapability (1.0 - 2.0).
 * 4. Episodic memory precedent boost from memory.db (1.5 - 2.5).
 */
export function selectCapabilitiesForTask(task: string, options: number | ScopeOptions = 3): string[] {
  const opts: ScopeOptions = typeof options === 'number' ? { maxCaps: options } : (options || {});
  const max = opts.maxCaps ?? 3;
  const text = task || '';
  if (!text.trim() && !opts.previousTool && !opts.previousCapability) {
    return [];
  }

  const rawWords = text.toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean);
  const taskWords = rawWords.filter(w => !STOPWORDS.has(w) && w.length >= 2);

  let transitionBoosts: Record<string, number> = {};
  const prevCap = opts.previousCapability || (opts.previousTool ? capabilityOfTool('', opts.previousTool) : undefined);
  if (prevCap && CAPABILITY_TRANSITIONS[prevCap]) {
    CAPABILITY_TRANSITIONS[prevCap].forEach((capName, idx) => {
      transitionBoosts[capName] = 2.0 - idx * 0.5;
    });
  }

  let precedentBoosts: Record<string, number> = {};
  if (opts.useEpisodicMemory && text.trim()) {
    try {
      const precedents = recallCapabilityPrecedents(text, { memoryDbPath: opts.memoryDbPath });
      precedents.forEach((capName, idx) => {
        precedentBoosts[capName] = 2.5 - idx * 0.5;
      });
    } catch {
      // safe fallback
    }
  }

  const activeProfile = (opts.profile ?? process.env.HELA_PROFILE ?? '').toLowerCase().trim();
  const allowedCaps = resolveProfileCapabilities(activeProfile);
  const isCapAllowed = (name: string) => {
    if (!allowedCaps || allowedCaps.includes('*')) return true;
    return allowedCaps.includes(name);
  };

  const eligibleCapabilities = HELA_CAPABILITIES.filter(cap => isCapAllowed(cap.name));

  const scored = eligibleCapabilities.map(cap => {
    let score = 0;

    // 1. Exact and stemmed keyword hits
    for (const kw of cap.keywords) {
      if (kw.includes(' ')) {
        if (keywordHit(text, kw)) score += 3.5;
      } else {
        if (keywordHit(text, kw)) {
          score += 3.0;
        } else if (taskWords.some(tw => stemMatches(tw, kw))) {
          score += 1.8;
        }
      }
    }

    // 2. Description token overlap (BM25 term-frequency style)
    const descTokens = cap.description.toLowerCase().split(/[^a-z0-9_-]+/).filter(w => !STOPWORDS.has(w) && w.length >= 3);
    for (const dt of descTokens) {
      if (taskWords.some(tw => stemMatches(tw, dt))) {
        score += 0.6;
      }
    }

    // 3. Transition boost
    if (transitionBoosts[cap.name]) {
      score += transitionBoosts[cap.name];
    }

    // 4. Episodic precedent boost
    if (precedentBoosts[cap.name]) {
      score += precedentBoosts[cap.name];
    }

    return { name: cap.name, score };
  }).filter(s => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map(s => s.name);
}

export interface ScopeResult {
  tools: ToolDecl[];
  scoped: boolean;
  capabilities: string[];
}

/**
 * Capability-first scoping: keep only tools behind the task's
 * capabilities. Falls back to the full catalog when there is no signal
 * or the filter would blind the planner (empty result).
 */
export function scopeToolsForTask<T extends ToolDecl>(
  tools: T[],
  task: string,
  options: number | ScopeOptions = 3
): ScopeResult & { tools: T[] } {
  const opts: ScopeOptions = typeof options === 'number' ? { maxCaps: options } : (options || {});
  const caps = selectCapabilitiesForTask(task, opts);
  if (caps.length === 0) return { tools: orderCanonicalTools(tools, task), scoped: false, capabilities: [] };
  const keep = tools.filter(t => {
    const cap = capabilityOfTool(t.server || '', t.name);
    return caps.includes(cap);
  });
  if (keep.length === 0) return { tools: orderCanonicalTools(tools, task), scoped: false, capabilities: caps };
  return { tools: orderCanonicalTools(keep, task, true), scoped: true, capabilities: caps };
}

/** Rendered prompt-list size (same `- name: desc` render as the loop). */
export function promptContextSize(tools: ToolDecl[]): number {
  return tools.map(t => `- ${t.name}${t.description ? ': ' + t.description.slice(0, 80) : ''}`).join('\n').length;
}

/** Render condensed 1-line tool index for minimal context overhead. */
export function scopeCompactTools(tools: ToolDecl[]): string {
  return tools.map(t => `- ${t.name}: ${(t.description || '').replace(/\s+/g, ' ').slice(0, 75)}`).join('\n');
}
