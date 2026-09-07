import type { PrebuiltPrompt } from '../prompts/prompt-definitions.js';

/** Minimal surface the guidance builder needs from the prompt registry. */
export interface GuidanceSource {
  searchPrompts(query: string): PrebuiltPrompt[];
  getAllPrompts(): PrebuiltPrompt[];
}

const MAX_CHARS = parseInt(process.env.AGENT_GUIDANCE_CHARS || '600', 10);
const MAX_PROMPTS = 2;

/**
 * Retrieve task-relevant prompt guidance: keyword hits plus prompts whose
 * expectedTools intersect the agent's toolset. Returns compact text for
 * model context, or '' when nothing is relevant. Purely local.
 */
export function buildGuidance(source: GuidanceSource, task: string, toolNames: string[], maxChars = MAX_CHARS): string {
  const keywords = task.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3).slice(0, 8);
  const toolSet = new Set(toolNames);
  const scored = new Map<string, { prompt: PrebuiltPrompt; score: number }>();

  for (const kw of keywords) {
    for (const p of source.searchPrompts(kw)) {
      const hit = scored.get(p.id) || { prompt: p, score: 0 };
      hit.score += 1;
      scored.set(p.id, hit);
    }
  }
  for (const p of source.getAllPrompts()) {
    const overlap = (p.expectedTools || []).filter(t => toolSet.has(t)).length;
    if (overlap > 0) {
      const hit = scored.get(p.id) || { prompt: p, score: 0 };
      hit.score += overlap * 2;
      scored.set(p.id, hit);
    }
  }
  const top = [...scored.values()].sort((a, b) => b.score - a.score).slice(0, MAX_PROMPTS);
  if (!top.length) return '';
  let out = top.map(({ prompt: p }) => `- ${p.name}: ${p.prompt.slice(0, 220).replace(/\s+/g, ' ')}`).join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars) + '…';
  return out;
}
