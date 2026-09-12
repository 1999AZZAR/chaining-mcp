/**
 * HeLa capability graph (P1-C4, capability-first routing).
 *
 * The planner must select CAPABILITIES first (`filesystem.read`,
 * `terminal.execute`, ...) and only then see the concrete tools behind
 * them — never a 200+ flat tool dump (Cytosol ~88, Genome 34, Enzyme 28,
 * Phenotype 27). This module is the static graph + task→capability
 * selector; the agent loop consumes it via `scopeToolsForTask` (opt-in
 * `capabilityRouting` flag — default off, planner behavior unchanged).
 *
 * Safety invariants:
 * - No keyword hit → return the full catalog (never blind the planner).
 * - Filter yielding zero tools → return the full catalog.
 * - Selection is deterministic (keyword score, registry order tie-break).
 */

import { needleFamilyOf } from './needle-provider.js';

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
    servers: ['terminal', 'nucleus'],
    toolPatterns: ['execute_command', 'terminal_', 'transfer', 'pty', 'session_'],
    keywords: ['run', 'running', 'execute', 'shell', 'command', 'terminal', 'script', 'pytest', 'npm', 'build', 'deploy', 'ssh'],
  },
  {
    name: 'browser.observe',
    description: 'Observe pages: state, text, screenshots, a11y (R0)',
    servers: ['browser', 'cytosol'],
    toolPatterns: ['get_state', 'get_text', 'get_visible', 'screenshot', 'observe', 'accessibility', 'extract', 'console', 'network', 'performance', 'health'],
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
    description: 'Design tokens, components, templates, palettes (R0/pure)',
    servers: ['designer', 'phenotype'],
    toolPatterns: ['design', 'palette', 'template', 'tokens', 'component', 'motion', 'brand', 'theme', 'style', 'genre'],
    keywords: ['design', 'landing page', 'component', 'palette', 'theme', 'style', 'css', 'mockup', 'ui'],
  },
];

export interface ToolDecl { name: string; description?: string; schema?: unknown; server?: string }

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
export function capabilityOfTool(serverName: string, toolName: string): string {
  for (const cap of HELA_CAPABILITIES) {
    if (compiled(cap).some(re => re.test(toolName))) return cap.name;
  }
  const server = (serverName || '').toLowerCase();
  for (const cap of HELA_CAPABILITIES) {
    if (cap.servers.some(h => server.includes(h))) return cap.name;
  }
  return `family:${needleFamilyOf(toolName)}`;
}

/**
 * Score capabilities against task text. Returns up to `max` names.
 * Empty = no signal → caller must expose the FULL catalog.
 */
function keywordHit(text: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${esc}\\b`, 'i').test(text);
}

export function selectCapabilitiesForTask(task: string, max = 3): string[] {
  const text = task || '';
  const scored = HELA_CAPABILITIES.map(cap => ({
    name: cap.name,
    score: cap.keywords.filter(k => keywordHit(text, k)).length,
  })).filter(s => s.score > 0);
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
export function scopeToolsForTask< T extends ToolDecl>(tools: T[], task: string, maxCaps = 3): ScopeResult & { tools: T[] } {
  const caps = selectCapabilitiesForTask(task, maxCaps);
  if (caps.length === 0) return { tools, scoped: false, capabilities: [] };
  const keep = tools.filter(t => {
    const cap = capabilityOfTool(t.server || '', t.name);
    return caps.includes(cap);
  });
  if (keep.length === 0) return { tools, scoped: false, capabilities: caps };
  return { tools: keep, scoped: true, capabilities: caps };
}

/** Rendered prompt-list size (same `- name: desc` render as the loop). */
export function promptContextSize(tools: ToolDecl[]): number {
  return tools.map(t => `- ${t.name}${t.description ? ': ' + t.description.slice(0, 80) : ''}`).join('\n').length;
}
