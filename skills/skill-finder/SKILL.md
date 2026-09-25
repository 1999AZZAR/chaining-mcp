---
name: skill-finder
description: Unified agent skill management, discovery, installation, and creation. Use when searching for capabilities (skills.sh, GitHub), installing curated or repository skills, listing available skills, or scaffolding and authoring new AgentSkills.
---

# Skill Finder & Manager

Unified tool for discovering, evaluating, installing, and authoring Agent Skills.

## Supported Workflows

1. **Find & Discover**: Search the open agent skills ecosystem (`skills.sh`, GitHub registries) and recommend verified skills.
2. **Install**: Download and configure skills from official curated collections, experimental indexes, or custom Git repositories.
3. **Scaffold & Create**: Generate valid, production-ready new skills with required frontmatter, reference docs, and helper scripts.
4. **List & Audit**: Inspect currently installed skills, check versions, and review lockfile status.

---

## 1. Finding and Evaluating Skills

Use when a user asks "how do I do X", "find a skill for X", or seeks capabilities for a specific domain (testing, design, deployment, database).

### Discovery Steps

1. **Search CLI**:
   ```bash
   npx skills find "<query>"
   ```
2. **Browse Repositories**:
   Check well-known skill sources (`openai/skills`, `vercel-labs/agent-skills`, `anthropics/skills`).
3. **Quality Verification**:
   - Prefer skills with proven install counts (1,000+ installs).
   - Check GitHub star counts and maintenance activity.
   - Inspect `SKILL.md` for clear tool boundaries and valid YAML frontmatter.

### Presentation Format

When recommending a skill, output:
- Name and primary function
- Source repository and install count
- Installation command
- URL or reference link

---

## 2. Installing Skills

### Local Installation Commands

Use the bundled helper scripts in `scripts/`:

- **List Curated Skills**:
  ```bash
  python3 scripts/list-skills.py
  python3 scripts/list-skills.py --format json
  ```
- **List Experimental Skills**:
  ```bash
  python3 scripts/list-skills.py --path skills/.experimental
  ```
- **Install from GitHub**:
  ```bash
  python3 scripts/install-skill-from-github.py --repo <owner>/<repo> --path <path/to/skill>
  python3 scripts/install-skill-from-github.py --url https://github.com/<owner>/<repo>/tree/<branch>/<path>
  ```
- **Install via Skills CLI**:
  ```bash
  npx skills add <package>
  ```

Installation targets `$CODEX_HOME/skills` or `~/.agents/skills`.

---

## 3. Creating and Scaffolding New Skills

When creating a new skill, follow standard Agent Skill architecture:

### Required Directory Structure

```text
<skill-name>/
├── SKILL.md              # Required: frontmatter and instructions
├── scripts/              # Optional: deterministic executable helpers
├── references/           # Optional: deep reference documentation
└── tests/                # Optional: verification test cases
```

### Frontmatter Schema

```yaml
---
name: skill-name
description: A concise description of the skill's purpose, triggers, and capabilities. Keep under 100 words.
disable-model-invocation: false # Set true only for manual/slash-command tools
---
```

### Content Guidelines

- **Concise trigger conditions**: State when the skill should be invoked and when it should not be used.
- **Workflow steps**: Numbered, sequential procedures with expected inputs and outputs.
- **Human prose**: Direct technical instructions without promotional phrasing.
- **Executable tools over text**: Prefer small, testable scripts in `scripts/` for deterministic tasks rather than asking the LLM to invent code on the fly.
