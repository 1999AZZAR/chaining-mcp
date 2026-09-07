import { Tool } from '@modelcontextprotocol/sdk/types.js';

/** Skills management surface: analyze, list, chain skills; combine skills+tools. */
export const skillTools: Tool[] = [
  {
    name: 'list_skills',
    description: 'List all discovered agent skills (name, description, files) from the local skills catalog. Read-only; never executes skill scripts.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_skills',
    description: 'Search the skills catalog by keywords against names and descriptions. Returns ranked matches for chaining.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords describing the capability needed' },
        limit: { type: 'number', minimum: 1, maximum: 20, default: 5, description: 'Maximum matches to return' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_skill',
    description: 'Load a skill\'s full instructions (SKILL.md body) plus its file manifest, for injection into agent context or harness use.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name from list_skills/search_skills' },
        maxChars: { type: 'number', minimum: 500, maximum: 60000, default: 8000, description: 'Truncate body to this many characters' },
      },
      required: ['name'],
    },
  },
  {
    name: 'suggest_skill_chain',
    description: 'Plan a task with Needle over registry tools and attach skill recommendations per step (deterministic catalog match, labeled). Combines skills+tools into one executable chain.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task to plan a skill+tool chain for' },
      },
      required: ['task'],
    },
  },
];
