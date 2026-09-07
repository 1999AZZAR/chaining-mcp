import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface SkillInfo {
  name: string;
  description: string;
  shortDescription?: string;
  path: string;
  files: string[];
  bodyChars: number;
}

export interface SkillDetail extends SkillInfo {
  content: string;
}

function defaultSkillDirs(): string[] {
  if (process.env.MITOSIS_SKILLS_DIRS) {
    return process.env.MITOSIS_SKILLS_DIRS.split(':').filter(Boolean);
  }
  return [join(homedir(), '.config', 'opencode', 'skills')];
}

function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const data: Record<string, string> = {};
  if (!text.startsWith('---')) return { data, body: text };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { data, body: text };
  const head = text.slice(3, end);
  let currentKey = '';
  for (const line of head.split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      data[currentKey] = m[2].trim();
    } else if (currentKey && /^\s+/.test(line)) {
      data[currentKey] += ' ' + line.trim();
    }
  }
  return { data, body: text.slice(end + 4).trim() };
}

function listFilesRecursive(dir: string, base: string, out: string[], depth = 0): void {
  if (depth > 3) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.startsWith('.')) continue;
    const full = join(dir, e);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) listFilesRecursive(full, base, out, depth + 1);
    else if (st.size < 500000) out.push(full.slice(base.length + 1));
  }
}

/**
 * Local skill-catalog discovery (opencode AgentSkills layout: one dir per
 * skill with SKILL.md frontmatter). Read-only: never executes skill scripts.
 */
export class SkillDiscovery {
  private cache: { key: string; at: number; skills: SkillInfo[] } | undefined;
  private readonly cacheTtlMs = 10000;

  /** Scan with short TTL cache (per directory-set) so hot guidance paths
   *  don't re-read every SKILL.md on each call. */
  scan(dirs: string[] = defaultSkillDirs()): SkillInfo[] {
    const key = JSON.stringify(dirs);
    const now = Date.now();
    if (this.cache && this.cache.key === key && now - this.cache.at < this.cacheTtlMs) {
      return this.cache.skills;
    }
    const skills = this.scanFresh(dirs);
    this.cache = { key, at: now, skills };
    return skills;
  }

  clearCache(): void {
    this.cache = undefined;
  }

  private scanFresh(dirs: string[]): SkillInfo[] {
    const skills: SkillInfo[] = [];
    for (const dir of dirs) {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.startsWith('.')) continue;
        const skillDir = join(dir, e);
        const skillFile = join(skillDir, 'SKILL.md');
        if (!existsSync(skillFile)) continue;
        try {
          const text = readFileSync(skillFile, 'utf8');
          const { data, body } = parseFrontmatter(text);
          const files: string[] = [];
          listFilesRecursive(skillDir, skillDir, files);
          skills.push({
            name: data.name || e,
            description: data.description || '',
            shortDescription: data['short-description'],
            path: skillDir,
            files,
            bodyChars: body.length,
          });
        } catch {
          continue;
        }
      }
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  search(query: string, dirs?: string[]): SkillInfo[] {
    const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    if (!words.length) return [];
    return this.scan(dirs)
      .map(s => {
        const hay = `${s.name} ${s.description} ${s.shortDescription || ''}`.toLowerCase();
        const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
        return { s, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ s }) => s);
  }

  get(name: string, dirs?: string[]): SkillDetail | undefined {
    const found = this.scan(dirs).find(s => s.name === name);
    if (!found) return undefined;
    try {
      const text = readFileSync(join(found.path, 'SKILL.md'), 'utf8');
      const { body } = parseFrontmatter(text);
      return { ...found, content: body };
    } catch {
      return undefined;
    }
  }
}

let shared: SkillDiscovery | undefined;

/** Process-wide skill catalog (scan is cheap; always fresh per call site). */
export function sharedSkills(): SkillDiscovery {
  if (!shared) shared = new SkillDiscovery();
  return shared;
}
