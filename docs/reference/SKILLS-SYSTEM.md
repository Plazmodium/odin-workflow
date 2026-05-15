# Skills System

The Skills System enables SDD agents to have **composable, domain-specific knowledge and workflow protocols** that can be mixed and matched based on project requirements and phase intent.

## Overview

Instead of bloating agents with knowledge of every framework, language, tool, and lifecycle practice, skills are modular units of expertise that are **injected into agents when relevant**.

```
┌─────────────────────────────────────────────────────────────────┐
│                         SKILLS SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Phase + Spec define workflow intent and tech stack            │
│         ↓                                                       │
│   Orchestrator resolves phase, artifact, and repo signals       │
│         ↓                                                       │
│   Orchestrator selects relevant Skills                          │
│         ↓                                                       │
│   Skills injected into Agent prompt                             │
│         ↓                                                       │
│   Agent has phase workflow + domain-specific knowledge          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Principles

1. **Explicit over Magic** - Phase workflow skills are deterministic; tech skills come from repo and artifact signals
2. **Composable** - Multiple skills can be combined (Next.js + Prisma + Tailwind)
3. **Mandatory** - Agents require skills; `generic-dev` is the fallback when no specific skills match
4. **Maintainable** - Skills updated independently of agents
5. **Extensible** - Easy to add new skills for new technologies

## Skill File Structure

### Location

```
agents/skills/
├── generic-dev/              # Fallback skill for any tech stack
│   └── SKILL.md
│
├── workflow/ (22 skills)        # Phase and lifecycle protocols
│   ├── using-agent-skills/SKILL.md
│   ├── spec-driven-development/SKILL.md
│   ├── incremental-implementation/SKILL.md
│   ├── code-review-and-quality/SKILL.md
│   ├── shipping-and-launch/SKILL.md
│   └── ...
│
├── frontend/ (9 skills)
│   ├── alpine-dev/SKILL.md
│   ├── angular-dev/SKILL.md
│   ├── astro-dev/SKILL.md
│   ├── htmx-dev/SKILL.md
│   ├── nextjs-dev/SKILL.md
│   ├── react-patterns/SKILL.md
│   ├── svelte-dev/SKILL.md
│   ├── tailwindcss/SKILL.md
│   └── vuejs-dev/SKILL.md
│
├── backend/ (5 skills)
│   ├── golang-gin/SKILL.md
│   ├── nodejs-express/SKILL.md
│   ├── nodejs-fastify/SKILL.md
│   ├── python-django/SKILL.md
│   └── python-fastapi/SKILL.md
│
├── database/ (5 skills)
│   ├── mongodb/SKILL.md
│   ├── postgresql/SKILL.md
│   ├── prisma-orm/SKILL.md
│   ├── redis/SKILL.md
│   └── supabase/SKILL.md
│
├── testing/ (4 skills)
│   ├── cypress/SKILL.md
│   ├── jest/SKILL.md
│   ├── playwright/SKILL.md
│   └── vitest/SKILL.md
│
├── devops/ (5 skills)
│   ├── aws/SKILL.md
│   ├── docker/SKILL.md
│   ├── github-actions/SKILL.md
│   ├── kubernetes/SKILL.md
│   └── terraform/SKILL.md
│
├── api/ (4 skills)
│   ├── graphql/SKILL.md
│   ├── grpc/SKILL.md
│   ├── rest-api/SKILL.md
│   └── trpc/SKILL.md
│
└── architecture/ (4 skills)
    ├── clean-architecture/SKILL.md
    ├── domain-driven-design/SKILL.md
    ├── event-driven/SKILL.md
    └── microservices/SKILL.md
```

### Skill File Format

Each skill is a markdown file with frontmatter:

```markdown
---
name: nextjs-dev
description: Next.js development expertise including App Router, Server Components, and API routes
category: frontend
version: "14.x"
depends_on:                    # Skills that MUST be loaded first (auto-resolved by orchestrator)
  - react-patterns
compatible_with:               # Skills that work well together (informational)
  - tailwindcss
  - prisma-orm
  - supabase
---

# Next.js Development

## Core Concepts

[Framework-specific knowledge...]

## Best Practices

[Recommended patterns...]

## Common Patterns

[Code examples...]

## Gotchas & Pitfalls

[Things to watch out for...]

## Integration Notes

[How this works with other technologies...]
```

## Workflow vs Technology Skills

Odin loads two broad skill types:

- **Workflow skills** (`category: workflow`) are short operating protocols for phases and lifecycle concerns: specification, planning, incremental implementation, review, debugging, release, migration, and documentation.
- **Technology skills** (`frontend`, `backend`, `database`, `testing`, `devops`, `api`, `architecture`) provide stack-specific patterns, gotchas, and examples.

Workflow skills should stay concise and evidence-oriented. Technology skills can include deeper examples and framework-specific guidance.

## Defining Tech Stack in Specifications

### In Requirements (Discovery Agent Output)

```markdown
## Technical Context

### Tech Stack

**Frontend**:
- Framework: Next.js 14 (App Router)
- UI Library: React 18
- Styling: Tailwind CSS
- State: Zustand

**Backend**:
- Runtime: Node.js 20
- Framework: Next.js API Routes
- ORM: Prisma
- Database: PostgreSQL (Supabase)

**Testing**:
- Unit: Jest + React Testing Library
- E2E: Playwright

**DevOps**:
- CI/CD: GitHub Actions
- Hosting: Vercel
```

### In Specification (Architect Agent Output)

```markdown
## Technical Implementation Design

### Required Skills

The following skills should be loaded for this feature:

| Skill | Category | Why Needed |
|-------|----------|------------|
| `nextjs-dev` | frontend | App Router, Server Components |
| `prisma-orm` | database | Database queries and migrations |
| `tailwindcss` | frontend | Component styling |
| `jest` | testing | Unit test implementation |
| `playwright` | testing | E2E test implementation |

### Tech Stack Reference

See requirements.md section "Technical Context" for full stack details.
```

## Skill Injection Process

### Step 1: Orchestrator Reads Spec

When spawning an agent, the orchestrator resolves phase workflow skills first, then extracts stack and artifact signals:

```javascript
// Pseudo-code
const phaseSkills = getPhaseWorkflowSkills(phase);
const spec = readFile('specs/AUTH-001/spec.md');
const requiredSkills = [...phaseSkills, ...extractRequiredSkills(spec)];
// Returns: ['using-agent-skills', 'incremental-implementation', 'unit-tests-sdd', 'nextjs-dev', 'prisma-orm']
```

### Step 2: Orchestrator Loads Skill Files

```javascript
const skillContents = requiredSkills.map(skillName => {
  const skillPath = findSkill(skillName); // Searches skill folders
  return {
    name: skillName,
    content: readFile(skillPath)
  };
});
```

### Step 3: Orchestrator Injects into Agent Prompt

```markdown
<!-- Injected at start of agent context -->

## Active Skills

The following skills are loaded for this feature based on the tech stack:

---
### Skill: nextjs-dev (Frontend)

[Full contents of nextjs-dev/SKILL.md]

---
### Skill: prisma-orm (Database)

[Full contents of prisma-orm/SKILL.md]

---
### Skill: tailwindcss (Frontend)

[Full contents of tailwindcss/SKILL.md]

---

## End of Skills

Now proceeding with your primary task...
```

### Step 4: Agent Uses Skill Knowledge

The agent now has domain-specific knowledge available in its context and can apply it while performing its task.

## Which Agents Use Skills?

All agents use skills. Workflow skills are selected by phase and artifact language. If no technology/domain-specific skill matches a tech-aware phase, the `generic-dev` fallback skill is also injected.

| Agent | Skill Injection | Primary Skill Categories |
|-------|-----------------|-------------------------|
| **Planning** | Via shared-context | Workflow, architecture patterns |
| **Product** | Via shared-context | Workflow, product boundary patterns |
| **Discovery** | Via shared-context | Workflow, domain knowledge, business patterns |
| **Architect** | Explicit block | Workflow, patterns, architecture, all tech categories |
| **Guardian** | Explicit block | Workflow, testing, security, patterns |
| **Builder** | Explicit block | Workflow plus all tech categories (primary user) |
| **Reviewer** | Explicit block | Workflow, testing, security, review patterns |
| **Integrator** | Via shared-context | Workflow, DevOps, CI/CD, runtime verification |
| **Documenter** | Via shared-context | Workflow, documentation patterns |
| **Release** | Via shared-context | Workflow, DevOps, deployment |

### Builder Agent - Primary Skill User

Builder benefits most from skills because it writes actual code:

```markdown
## Builder with Skills

### Without Skills
Builder: "I'll create a React component..."
[Generic React patterns, may not match project conventions]

### With Skills (nextjs-dev + tailwindcss)
Builder: "I'll create a Server Component using App Router conventions with Tailwind styling..."
[Project-specific patterns, correct file locations, proper imports]
```

## Duration Considerations

Skills are loaded as context for agents. Keep skills concise (500-3000 tokens) to leave room for feature-specific context. Runtime-managed invocation tracking now opens through `odin.prepare_phase_context(...)` and closes through `odin.record_phase_result(...)`; agents do not need to manage that lifecycle directly.

## Skill Dependencies

### `depends_on` — Required Dependencies

Skills declare hard dependencies via `depends_on`. The orchestrator MUST load these first:

```yaml
# nextjs-dev/SKILL.md
depends_on:
  - react-patterns    # Must load before nextjs-dev

# supabase/SKILL.md
depends_on:
  - postgresql        # Must load before supabase

# kubernetes/SKILL.md
depends_on:
  - docker            # Must load before kubernetes

# microservices/SKILL.md
depends_on:
  - domain-driven-design
  - event-driven
```

**Dependency resolution**:
1. Read requested skill's `depends_on` list
2. For each dependency, recursively resolve its `depends_on`
3. Load in dependency order (dependencies first)
4. Detect circular dependencies and warn (do not load circular chain)

### Phase Workflow Skills

These workflow skills are loaded by phase before tech-stack auto-detection:

| Phase | Core workflow skills |
|-------|----------------------|
| 0 Planning | `using-agent-skills`, `idea-refine` |
| 1 Product | `using-agent-skills`, `idea-refine` |
| 2 Discovery | `using-agent-skills`, `context-engineering`, `spec-driven-development` |
| 3 Architect | `using-agent-skills`, `spec-driven-development`, `planning-and-task-breakdown` |
| 4 Guardian | `using-agent-skills`, `code-review-and-quality`, `doubt-driven-development`, `security-and-hardening` |
| 5 Builder | `using-agent-skills`, `incremental-implementation`, `test-driven-development`, `unit-tests-sdd` |
| 6 Reviewer | `using-agent-skills`, `code-review-and-quality`, `security-and-hardening`, `unit-tests-eval-sdd` |
| 7 Integrator | `using-agent-skills`, `debugging-and-error-recovery` |
| 8 Documenter | `using-agent-skills`, `documentation-and-adrs` |
| 9 Release | `using-agent-skills`, `shipping-and-launch`, `git-workflow-and-versioning`, `ci-cd-and-automation`, `documentation-and-adrs` |

Topical workflow skills such as `api-and-interface-design`, `frontend-ui-engineering`, `browser-testing-with-devtools`, `performance-optimization`, and `deprecation-and-migration` are added when feature or artifact language indicates they are relevant.

### `compatible_with` — Soft Recommendations

Skills that work well together but are not required:

```yaml
compatible_with:
  - tailwindcss       # Styling
  - prisma-orm        # Database
  - jest              # Testing
```

Orchestrator can suggest compatible skills but should not auto-load them.

## Creating New Skills

### Skill Template

```markdown
---
name: [skill-name]
description: [One-line description]
    category: [workflow|frontend|backend|database|testing|devops|api|architecture]
version: "[version or 'latest']"
depends_on:                    # Optional — skills that must load first
  - [required-skill]
compatible_with:               # Optional — skills that work well together
  - [other-skill-1]
  - [other-skill-2]
---

# [Technology Name] Development

## Overview

[Brief description of the technology and when to use it]

## Core Concepts

### [Concept 1]
[Explanation with code example]

### [Concept 2]
[Explanation with code example]

## Best Practices

1. **[Practice 1]**: [Description]
2. **[Practice 2]**: [Description]
3. **[Practice 3]**: [Description]

## Common Patterns

### [Pattern Name]

```[language]
// Code example
```

[When to use this pattern]

## File Structure

```
project/
├── [typical file structure for this tech]
```

## Gotchas & Pitfalls

- **[Gotcha 1]**: [What to watch out for]
- **[Gotcha 2]**: [Common mistake]

## Integration with Other Technologies

### With [Other Tech]
[How these work together]

## Resources

- [Official Documentation](url)
- [Key reference](url)
```

### Skill Quality Checklist

Before adding a new skill:

- [ ] Clear, actionable guidance (not just documentation links)
- [ ] Code examples are correct and tested
- [ ] Best practices are current (not outdated patterns)
- [ ] Gotchas are real issues developers encounter
- [ ] Compatible skills listed accurately
- [ ] Token count is reasonable (under 3,000 tokens)

## Skill Versioning

Skills should be version-aware:

```markdown
---
name: nextjs-dev
version: "14.x"
---

# Next.js 14 Development

## Version Notes

This skill covers Next.js 14 with App Router. Key differences from Pages Router:
- Server Components by default
- New file conventions (page.tsx, layout.tsx, loading.tsx)
- Server Actions for mutations
```

When tech stack specifies a version, orchestrator can select matching skill version.

## Learning Propagation to Skills

Skills grow from learnings. When a high-confidence learning (>= 0.80) is relevant to a skill, it can be propagated to that skill's `## Session Learnings` section.

### How It Works

1. **At learning creation time**, the creating agent declares propagation targets with relevance scores:
   ```sql
   SELECT * FROM declare_propagation_target(
     'learning-uuid'::UUID,
     'skill',                    -- target_type: 'agents_md', 'skill', 'agent_definition'
     'frontend/nextjs-dev',      -- target_path
     0.85                        -- relevance_score (must be >= 0.60)
   );
   ```

2. **Propagation queue** shows learnings ready to propagate:
   ```sql
   SELECT * FROM get_skill_propagation_queue();
   -- Returns learnings with confidence >= 0.80, relevance >= 0.60, no open conflicts
   ```

3. **Orchestrator propagates** by appending to the skill file's `## Session Learnings` section (creating the section if it doesn't exist):
   ```markdown
   ## Session Learnings

   ### GOTCHA: Next.js 14 Build Issues (2026-02-09)

   Three build issues to watch for...

   **See also**: database/supabase (context hint)
   **Confidence**: 0.90 | **Source**: DASH-001
   ```

4. **Record the propagation** to prevent duplicates:
   ```sql
   SELECT * FROM record_skill_propagation(
     'learning-uuid'::UUID,
     'skill',
     'frontend/nextjs-dev',
     'orchestrator'
   );
   ```

### Cross-References

When a learning propagates to multiple skills, each copy includes a "See also" link:

```markdown
**See also**: database/supabase (Server-side data fetching patterns)
```

### Auto-Creation of New Skills

When a learning targets a skill that doesn't exist yet, the orchestrator creates it from a template:

```markdown
---
name: [skill-name]
description: [Generated from learning content]
category: [category]
version: "1.0.0"
---

# [Skill Name]

## Overview

[Generated from learning content and context]

## Session Learnings

### [Learning Category]: [Learning Title] ([date])

[Learning content]

**Confidence**: [score] | **Source**: [feature_id]
```

### Evolution Sync

When a learning evolves (L_n → L_{n+1}), all propagated copies should be updated:

```sql
-- Find propagated learnings that need updating
SELECT * FROM get_pending_evolution_syncs();
```

### Propagation Targets

| Target Type | Target Path | Example |
|-------------|-------------|---------|
| `agents_md` | NULL | AGENTS.md (project-level insights) |
| `skill` | `frontend/nextjs-dev` | Skill file (technology patterns) |
| `agent_definition` | `architect` | Agent definition (workflow improvements) |

## Future Enhancements

### Skill Registry (Future)

```yaml
# agents/skill-registry.yaml
registered_skills:
  - path: skills/frontend/nextjs-dev
    active: true
    priority: 1
  - path: skills/frontend/react-patterns
    active: true
    priority: 2
  - path: skills/custom/company-patterns
    active: true
    priority: 0  # Highest priority (company-specific)
```

### Skill Inheritance (Future)

```yaml
# nextjs-dev could inherit from react-patterns
inherits: react-patterns
```

### Remote Skills (Future)

```yaml
# Load skills from remote repository
remote_skills:
  - url: https://github.com/company/sdd-skills
    skills:
      - company-coding-standards
      - company-api-patterns
```

## Example: Full Flow

### 1. User Request

"Implement user authentication with email/password login"

### 2. Discovery Creates Requirements

```markdown
## Tech Stack
- Frontend: Next.js 14
- Backend: Next.js API Routes
- Database: PostgreSQL + Prisma
- Auth: NextAuth.js
```

### 3. Architect Creates Spec

```markdown
## Required Skills
| Skill | Why |
|-------|-----|
| nextjs-dev | App Router, Server Actions |
| prisma-orm | User model, queries |
| nextauth | Authentication patterns |
```

### 4. Orchestrator Spawns Builder

```markdown
## Active Skills

### nextjs-dev
[Skill content...]

### prisma-orm
[Skill content...]

### nextauth
[Skill content...]

---

## Your Task

Implement AUTH-001 according to spec...
```

### 5. Builder Implements

Builder now knows:
- Next.js 14 App Router conventions
- Prisma schema patterns
- NextAuth.js configuration

Result: Higher quality, project-consistent code.

## Related Documentation

- `HYBRID-ORCHESTRATION-PATTERN.md` - How orchestrator works
- `agents/definitions/builder.md` - Builder agent definition
- `agents/skills/` - Skill files

---

**Status**: Design complete, ready for implementation
**Next Steps**: Create skill folder structure, implement injection logic
