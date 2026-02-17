# Specification-Driven Development (SDD) Framework

A comprehensive training framework for AI-assisted software development that emphasizes specification-first workflows, context-aware prompting, and quality-gated implementation.

---

## Table of Contents

1. [The Adaptive Master Specification Template](#artifact-1-the-adaptive-master-specification-template)
2. [The SDD Prompt Library](#artifact-2-the-sdd-prompt-library)
3. [The Spec Quality Rubric](#artifact-3-the-spec-quality-rubric-sqr)
4. [The MCP Setup Guide](#artifact-4-the-mcp-setup-guide-for-sdd)
5. [The "Zero to Spec" Workshop Agenda](#artifact-5-the-zero-to-spec-workshop-agenda)

---

## Artifact #1: The Adaptive Master Specification Template

### Purpose

This template provides a scalable structure for writing specifications that AI agents can accurately implement. It adapts to three complexity levels:

- **Level 1 ("The Nut")**: Bug fixes and small tweaks — Complete Sections 1 and 3 only
- **Level 2 ("The Feature")**: Standard features — Complete Sections 1–4
- **Level 3 ("The Epic")**: Architectural changes — Complete all sections including System Context and Data Models

### File Naming Convention
````
specs/[id]-[short-description].md
````

**Example:** `specs/AUTH-001-login-flow.md`

---

### Template Structure
````markdown
## Specification: [Feature Name]

## 1. Context & Goals (The "Why")

> **AI Instruction:** Focus on *intent* here. If the code contradicts this section, the code is wrong.

* **User Story:** As a [role], I want [feature], so that [benefit].
* **Problem Solved:** [1-sentence description of the pain point]
* **Success Metrics:**
    * [ ] Metric 1 (e.g., "User can log in within 200ms")
    * [ ] Metric 2 (e.g., "Error rate < 1%")

---

## 2. Behavioral Requirements (The "What")

> **AI Instruction:** These are strict rules. Use them to generate test cases first.

### Core Flows

1. **Happy Path:** [Step-by-step description of the standard workflow]
2. **Alternative Path:** [What happens if the user clicks 'Cancel'?]

### Edge Cases & Constraints

* **ec_1:** [What if the network is down?]
* **ec_2:** [What if the input is empty?]
* **constraint_1:** [Must use existing `User` type defined in `@types/user.ts`]

---

## 3. Acceptance Criteria (The "Test")

> **AI Instruction:** Generate test cases based on these scenarios.

### Scenario 1: Successful Execution

* **Given:** [Precondition]
* **When:** [Action]
* **Then:** [Expected Result]

### Scenario 2: Error Handling

* **Given:** [Bad Input]
* **When:** [Action]
* **Then:** [Specific Error Message/State]

---

## 4. Technical Implementation Design (The "How")

> **AI Instruction:** Propose the code structure before generating full code.

### Proposed Changes

* **New Files:** `src/components/AuthModal.tsx`
* **Modified Files:** `src/api/client.ts`

### API Contract (Schema-First)
```typescript
// Define the shape of data BEFORE writing logic
interface AuthResponse {
  token: string;
  expiresIn: number;
}
```

---

## 5. System Context (For AI Agents)

> **AI Instruction:** Read these specific files to understand the existing pattern. Do not hallucinate new patterns.

* **Reference Implementation:** `@src/components/OldModal.tsx` (Copy this style)
* **Global State:** Uses Zustand store at `@src/store/auth.ts`
````

---

### Training Module: The "Context-First" Prompt Strategy

**Core Principle:** Never ask for code immediately. Always ask for a *plan* first.

#### The "Activation Prompt"

Use this prompt structure to engage any AI agent properly:
````
I have defined a specification in `specs/[SPEC-ID].md`.

1. **Read** the spec and the referenced files in 'System Context'.
2. **Critique** the spec: Are there missing edge cases or ambiguities?
3. **Plan**: Output a checklist of files you intend to create or modify.
4. **Wait** for my approval before writing code.
````

---

### Training Exercise: "The Logic Trap"

This exercise demonstrates why specifications matter.

**Scenario:** Create a function that calculates a shopping cart total with discounts.

#### Step 1: The Baseline

Prompt your AI agent: *"Write a cart calculator function."*

**Expected Result:** Generic code that likely hallucinates business logic (tax rules, discount structures).

#### Step 2: The Specification

Fill out **Section 3 (Acceptance Criteria)** of the template first:
````
Scenario: BOGO Discount Applied
Given: A user has 3 items where Item A is "Buy 1 Get 1 Free"
When: The cart total is calculated
Then: The total should only charge for 2 items
````

#### Step 3: The Comparison

Feed the specification to the AI agent.

**Expected Result:** Code that correctly implements the BOGO logic, effectively "passing" the test before execution.

---

## Artifact #2: The SDD Prompt Library

This library provides reusable prompts for each phase of the SDD workflow. These prompts are **AI-agnostic** and work with GitHub Copilot, Cursor, Claude, Gemini, Amazon Kiro, or any other AI coding assistant.

---

### 1. Global Configuration (The "System Prompt")

Add this to your AI agent's configuration:

**Locations:**
- **Cursor/Windsurf:** `.cursorrules` file in repository root
- **Claude Projects:** Project Instructions
- **GitHub Copilot:** Workspace instructions or comments
- **Amazon Kiro:** Project context settings
- **JetBrains IDEs (with AI):** AI Assistant settings
````markdown
# Role
You are a Principal Software Architect practicing Specification-Driven Development (SDD).

# Core Philosophy
1. **Spec-First:** You never generate implementation code without a clear, approved specification first.
2. **Single Source of Truth:** The Specification (Markdown file) is the truth. If the code contradicts the spec, the code is wrong.
3. **Safety:** You rely on "Context Pulling" (reading files/schemas) rather than guessing.

# Behavioral Rules
- **Phase 1 (Drafting):** When asked to design a feature, draft a structured Spec using the provided template. Do not write code.
- **Phase 2 (Critique):** If I provide a spec, act as a "Critical Reviewer." Find ambiguity, missing edge cases, and security risks.
- **Phase 3 (Coding):** When asked to implement, read the Spec file line-by-line. Implement only what is defined.
- **Phase 4 (Refinement):** If you hit a logic error, update the Spec first, then update the code.

# Formatting
- Specs must be in Markdown.
- Acceptance Criteria must use Gherkin (Given/When/Then) format.
- Code blocks must include file paths (e.g., `// src/utils/auth.ts`).
````

---

### 2. Workflow Prompts (Phase-by-Phase)

#### Phase 1: The "Architect" Prompt (Drafting)

Use this when starting a new ticket.
````
I need to work on [Ticket ID/User Story].

1. **Research:** Read [Reference File A] and [Reference File B] to understand the current pattern.
2. **Draft:** Create a new specification file `specs/[ID-Name].md` following the SDD Master Template.
3. **Focus:** Ensure you define the Data Schema in Section 4 before writing any logic.

Do not generate implementation code yet. Just the spec.
````

---

#### Phase 2: The "Critique" Prompt (Validation)

Use this after drafting a spec to validate quality.
````
Review the specification in `specs/[ID-Name].md`.

Act as a critical reviewer. Find holes in this logic:

1. Are there missing edge cases (e.g., network failure, null data)?
2. Is the Acceptance Criteria testable (Binary pass/fail)?
3. Does the Data Model match our existing schema?

**Output:**
- List of 3-5 critical issues
- A revised version of Section 3 (Acceptance Criteria) that fixes these issues
````

---

#### Phase 3: The "Builder" Prompt (Implementation)

Use this only after the spec is approved.
````
We are ready to build. Read `specs/[ID-Name].md` carefully.

**Execution Plan:**
1. Create/Modify the files exactly as described in the 'Technical Implementation' section.
2. Add comments in the code linking back to the Spec (e.g., `// See Spec Requirement 2.1`).
3. Do not add 'extra' features not listed in the spec.

Start with the Data Types/Interfaces first.
````

---

#### Phase 4: The "Verifier" Prompt (Test Generation)

Use this to generate tests that validate the specification.
````
Generate a test suite for `specs/[ID-Name].md`.

1. Map every 'Scenario' in Section 3 (Acceptance Criteria) to a specific test case.
2. Use [your testing framework] and follow the patterns in `tests/example.test.[ext]`.
3. Ensure you cover the Edge Cases defined in Section 2.

Output the test file content.
````

---

### 3. Recovery Prompts

Use these when the AI agent deviates from the specification.

#### The "Drift Check"

Use when code and spec have diverged.
````
Compare `src/[file].ts` against `specs/[spec-file].md`. 
List every discrepancy where the code does not match the spec. 
Which one should be the source of truth?
````

---

#### The "Context Refresh"

Use when the AI hallucinates structure or schema.
````
Stop. You are guessing [column names/types/structure]. 
Check the actual [database schema/file structure/API contract] and rewrite your last response.
````

---

#### The "De-Bloat"

Use when the specification is over-engineered.
````
This spec is over-engineered. Rewrite it to be 'Level 1' complexity. 
Keep only the Goal and the Acceptance Criteria. 
Remove unnecessary sections.
````

---

### Training Activity: "Prompt Golf"

**Objective:** Get the AI to write a perfect specification with the fewest words.

**Rules:**
- Goal: Generate a complete "Login Function" spec
- Constraint: Maximum 50 words in your prompt
- Winner: Highest quality score (using Artifact #3 rubric) with fewest words

**Learning Outcome:** Developers learn that referencing the template and using context is more efficient than verbose instructions.

---

## Artifact #3: The Spec Quality Rubric (SQR)

This rubric provides a quality gate for specifications before implementation begins. Use it for:

1. **Manual Peer Reviews:** Senior developers grade junior developers' specs during training
2. **AI Auto-Grading:** Feed this rubric to an AI agent to critique specs automatically

---

### Scoring Guide

| Score | Meaning | Action |
|-------|---------|--------|
| **0 - Blocker** | The AI will likely hallucinate or generate bugs | Do not proceed to code |
| **1 - Risky** | The AI might work, but will require heavy manual cleanup | Needs refinement |
| **2 - AI-Ready** | The spec is precise enough for "One-Shot" generation | Ready for implementation |

---

### Section A: Intent & Clarity (The "Why")

| Criteria | 0 - Blocker | 1 - Risky | 2 - AI-Ready |
|----------|-------------|-----------|--------------|
| **Ambiguity Level** | Uses subjective words ("fast," "pretty," "easy") | Uses general terms but implies standard patterns | Uses concrete, binary terms ("<200ms," "Material UI Grid," "3 clicks") |
| **Problem Definition** | Describes implementation only (e.g., "Add a column") | Describes the user need vaguely | Clearly links the change to a User Story or Business Metric |
| **Negative Constraints** | No mention of what the system shouldn't do | Implies constraints | Explicitly lists boundaries (e.g., "Do NOT modify the legacy auth controller") |

---

### Section B: Testability (The "What")

| Criteria | 0 - Blocker | 1 - Risky | 2 - AI-Ready |
|----------|-------------|-----------|--------------|
| **Acceptance Criteria** | Missing or prose-based paragraphs | Bullet points, but open to interpretation | Given/When/Then format (Gherkin) covering inputs and outputs |
| **Edge Cases** | "Happy Path" only | Mentions error handling generally | Explicitly defines specific error states (Network fail, Null inputs, Auth timeout) |
| **Data Specificity** | "Return the user object" | "Return user with name and email" | Defines the exact JSON schema or references a specific TypeScript Interface |

---

### Section C: Context & Implementation (The "How")

| Criteria | 0 - Blocker | 1 - Risky | 2 - AI-Ready |
|----------|-------------|-----------|--------------|
| **File Awareness** | No files mentioned. AI will guess where code goes | Mentions folder names generally | Specific file paths (`src/utils/calc.ts`) are targeted for modification |
| **Pattern Matching** | Asks for code from scratch | "Make it look like the rest of the app" | "Follow the pattern in `src/components/ReferenceModal.tsx`" |
| **Volume Control** | Spec is longer/more complex than the needed code (Over-engineering) | Spec is detailed but verbose | Right-sized: Concise instructions proportional to task complexity |

---

### Training Activity: "The Roast"

**Objective:** Train developers to internalize the rubric through real examples.

#### Steps:

1. **Select:** Take a poorly written ticket from your actual backlog
2. **Score:** Ask the team to score it using the rubric (expect mostly 0s)
3. **The Reveal:** Feed that bad spec to your AI agent and show the hallucinated/buggy code it generates
4. **Refine:** Improve the spec together until it scores all 2s
5. **Compare:** Generate code again to demonstrate the quality improvement

---

### The "Auto-Grader" Prompt

Use this prompt to automate spec quality checking:
````markdown
## Role
Act as a Senior QA Architect.

## Task
Review the specification below against the "SDD Quality Rubric".

## Rubric Criteria
1. **Unambiguous:** Are metrics concrete? (No "fast", "clean")
2. **Testable:** Are acceptance criteria in Given/When/Then format?
3. **Context-Aware:** Does it reference specific existing files/patterns?
4. **Edge-Cases:** Does it handle failure states?

## Output
1. Assign a Score (0-2) for each criterion.
2. If the total score is not perfect, list 3 specific questions the developer must answer to fix the spec.
3. DO NOT generate code. Only critique the spec.

## The Specification to Review:
[PASTE SPEC HERE]
````

---

## Artifact #4: The MCP Setup Guide for SDD

**Goal:** Enable AI agents to directly access codebases, database schemas, and external systems through the Model Context Protocol (MCP). This shifts the workflow from "push context" to "pull context."

---

### 1. The Concept: "Pull" vs. "Push" Context

| Workflow | Action | Result |
|----------|--------|--------|
| **Old Way ("Push")** | Developer manually copies files, schemas, and ticket text into chat | ❌ High friction. Developer forgets files; Context window overflows; AI hallucinates |
| **SDD Way ("Pull")** | Developer prompts: "Draft a spec for TICKET-123 using the patterns in `user.ts`" | ✅ Low friction. AI uses MCP to fetch ticket details and read files autonomously |

---

### 2. MCP Server Installation

MCP servers provide AI agents with tool access to various systems. Below are common configurations.

#### Supported AI Tools with MCP

- **Claude Desktop** (Native MCP support)
- **Cursor AI** (Built-in MCP manager in settings)
- **Windsurf** (MCP configuration in settings)
- **VS Code with Continue** (MCP server configuration)
- **Cline** (VS Code extension with MCP support)

---

### Configuration File Locations

**Claude Desktop:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

**Cursor / Windsurf:**
- Navigate to: **Settings > Features > MCP > Add New Server**

**VS Code (Continue/Cline):**
- Configuration varies by extension; typically in workspace settings

---

### Sample MCP Configuration

**Prerequisites:** Ensure you have **Node.js** and **Docker** installed.
````json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/absolute/path/to/your/project",
        "/absolute/path/to/your/docs"
      ]
    },
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here",
        "mcp/github"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://read_only_user:password@localhost:5432/your_database"
      ]
    }
  }
}
````

**Note:** Replace placeholder paths, tokens, and credentials with your actual values.

---

### 3. The SDD Workflow with MCP

Train developers to use these "trigger phrases" to activate MCP tools.

#### A. Requirements Gathering

**Prompt:**
````
Read issue #123 from the repository...
````

**Tool Used:** `github`

**Value:** Fetches exact acceptance criteria from issue trackers, ensuring alignment with business goals.

---

#### B. Schema Verification

**Prompt:**
````
Check the users table schema to see if middle_name column exists...
````

**Tool Used:** `postgres`

**Value:** Prevents hallucination of non-existent columns. Ensures correct data types.

---

#### C. Pattern Matching

**Prompt:**
````
Read `src/legacy/auth_provider.py` to understand how we handle tokens...
````

**Tool Used:** `filesystem`

**Value:** Ensures new specs adhere to existing architectural patterns and coding standards.

---

### 4. Training Activity: "The Blindfold Test"

**Objective:** Prove the value of MCP by having developers write specs without manually viewing code.

#### Steps:

1. **Setup:** Assign a complex ticket (e.g., "Refactor the payment webhook handler")
2. **Constraint:** Developer cannot open files in their IDE
3. **Task:** Write a complete, accurate specification using only the AI chat interface
4. **Execution:**
    - Ask AI to list directory structure
    - Ask AI to read specific files
    - Ask AI to describe database tables
5. **Win Condition:** Generated spec lists correct file paths and database columns without manual inspection

---

### 5. Security & Best Practices

#### 🔒 Read-Only Principle

Always configure database MCP servers with **read-only** users. AI agents should never have `DROP`, `INSERT`, `UPDATE`, or `DELETE` permissions during the specification phase.

#### 🔐 Secrets Management

- Never hardcode API keys in configuration files committed to version control
- Use environment variables where possible
- Consider using secret management tools for sensitive credentials

#### 📂 Scope Limiting

Only grant filesystem MCP access to specific project directories. Never provide access to:
- Root directory (`/`)
- Home directory (`~`)
- System directories

---

## Artifact #5: The "Zero to Spec" Workshop Agenda

This workshop connects all artifacts into a cohesive 6-hour training experience.

---

### Workshop Overview

**Title:** AI-Assisted Specification-Driven Development (SDD) Bootcamp

**Duration:** 1 Day (6 hours total)

**Audience:** Software Engineers, QA Engineers, Technical Leads

**Prerequisites:**
- Code editor installed (VS Code, Cursor, JetBrains IDE, etc.)
- AI agent access (GitHub Copilot, Claude, Gemini, Amazon Kiro, or similar)
- Docker and Node.js installed
- Access to sample codebase

---

## 🌅 Morning Session: Foundation & Tooling (10:00 AM - 12:30 PM)

### 10:00 AM | Module 1: The Problem & The Solution (45 min)

**The Hook:**
- Show examples of buggy AI-generated code from vague prompts
- Present the "Verschlimmbesserung" concept (improvement that makes things worse)

**The Solution:**
- Introduce Specification-Driven Development
- Core concept: "The AI is the junior developer; you are the architect"

**The Framework:**
- Walk through the Master Template (Artifact #1)
- Explain why behavior (Section 2) must be separated from implementation (Section 4)

---

### 10:45 AM | Module 2: Toolchain Setup (45 min)

**Objective:** Every participant's environment must be MCP-ready.

**Activity: "The Connection Check"**

1. Distribute MCP Setup Guide (Artifact #4)
2. Participants install at minimum:
    - `filesystem` MCP server
    - One additional server based on tech stack (e.g., `postgres`, `sqlite`, `github`)
3. **Validation Task:**
````
   Ask your AI: "Read the file `README.md` in this repo and summarize it."
````
If the AI successfully reads and summarizes, they pass.

**Troubleshooting Support:** Have designated helper available for setup issues.

---

### 11:30 AM | Module 3: Prompt Engineering for Architects (60 min)

**Concept:** "Chain of Thought" for specifications.

**Activity: "Prompt Golf"**

**Challenge:**
````
Get the AI to ask YOU 3 clarifying questions about a Login feature 
before writing any code or spec.
````

**Scoring:**
- Most insightful questions from AI = Winner
- Fewest words in prompt = Bonus points

**Teaching Moment:** Show how using the Prompt Library (Artifact #2) produces better results with fewer tokens.

---

## 🍱 Lunch Break (12:30 PM - 1:30 PM)

---

## ☀️ Afternoon Session: The SDD Loop (1:30 PM - 4:00 PM)

### 1:30 PM | Module 4: Kata #1 - The "Greenfield" Spec (60 min)

**Scenario:**
````
Create a specification for a `calculate_shipping_cost(weight, distance, tier)` function.
````

**Steps:**

1. **Draft (20 min):**
    - Use the Architect Prompt (Artifact #2) to generate initial spec
    - AI creates first draft

2. **Refine (20 min):**
    - Manually edit the Markdown
    - **Critical lesson:** AI draft is just a starting point. Humans own the spec.

3. **The Roast (20 min):**
    - Pair up and swap laptops
    - Use the Quality Rubric (Artifact #3) to grade partner's spec
    - **Pass Condition:** Score of 2 across all categories

---

### 2:30 PM | Module 5: Kata #2 - The "Brownfield" Context (45 min)

**Scenario:**
````
Add a 'Dark Mode' toggle to an existing legacy component.
````

**Constraint:** Cannot copy-paste legacy code. Must use MCP to read files.

**The Prompt:**
````
Read `src/theme/Provider.tsx`. 
Draft a spec to add a toggle that respects the existing Context API pattern.
````

**Expected Outcome:**
- AI should match existing coding style automatically
- Variable naming conventions preserved
- Folder structure respected

---

### 3:15 PM | Module 6: The "Blindfold" Challenge (30 min)

**The Rules:**
1. Close the IDE file explorer
2. Use only the AI chat interface
3. **Task:** Identify and fix a bug in a provided file using only AI

**Execution Flow:**
````
Developer: "Read `src/utils/date_formatter.ts`"
AI: [Shows code]
Developer: "Create a reproduction test case spec"
Developer: "Draft the fix spec"
````

**Badge Ceremony:** Participants who successfully complete the challenge receive recognition.

---

### 3:45 PM | Wrap-Up & Next Steps (15 min)

**New Team Policies:**
- "No PR without a Spec" (or team-appropriate variation)
- Specs must score 2 across all rubric categories

**Resources Distribution:**
- Share the Prompt Library (Artifact #2) to team wiki
- Provide access to all framework artifacts
- Schedule follow-up check-ins (1 week, 1 month)

---

## 🎒 Instructor Preparation Checklist

Before running the workshop, ensure you have:

- [ ] **Sample Repository:** A codebase with:
    - Slightly messy/legacy code patterns
    - One obvious bug for the Blindfold Challenge
    - Clear file structure for MCP exploration

- [ ] **Golden Specs:** Pre-written "perfect" specifications for each Kata exercise as answer keys

- [ ] **MCP Support:** Designated helper for troubleshooting Docker/Node.js setup issues

- [ ] **Rubric Materials:**
    - Digital version in shared doc
    - Optional: Printed copies for "The Roast" activity

- [ ] **Workspace Setup:** Ensure all participants have access to:
    - Sample repository
    - Shared documentation
    - Communication channel for questions

---

## 🚀 Framework Summary

You now have a complete **AI-Assisted Specification-Driven Development Framework** consisting of:

1. ✅ **Artifact #1:** The Adaptive Master Specification Template (The Standard)
2. ✅ **Artifact #2:** The SDD Prompt Library (The Interface)
3. ✅ **Artifact #3:** The Spec Quality Rubric (The Quality Gate)
4. ✅ **Artifact #4:** The MCP Setup Guide (The Infrastructure)
5. ✅ **Artifact #5:** The Workshop Agenda (The Rollout)
6. 🔬 **Artifact #6:** The Multi-Agent SDD Protocol (Advanced Optimization) - See `multi-agent-protocol.md`

---

## 🔬 Advanced: Multi-Agent Architecture (Artifact #6)

For teams experiencing **context window bloat** or wanting to **optimize token usage by 50%+**, we've developed an advanced multi-agent architecture.

### The Problem
Traditional single-agent workflows load everything into one context:
- Planning + Validation + Implementation = 60,000+ tokens
- Context dilution (important info lost in noise)
- Role confusion (agent switches between planning and coding)
- Cannot parallelize work

### The Solution: Specialized Agents

**Three-Agent System:**
```
[ARCHITECT] → [GUARDIAN] → [BUILDER]
  Planning      Validation    Implementation
  ~3,700 tokens ~11,000 tokens ~12,500 tokens
```

**Key Benefits:**
- 54% token reduction (27K vs 60K)
- Focused context (no dilution)
- Structural guardrails (validation before implementation)
- Parallel execution possible (multiple builders)
- Reusable context bundles

### When to Use Multi-Agent Protocol

**Use single-agent workflow when:**
- Learning SDD for the first time
- Simple features (Level 1-2 complexity)
- Small team with low volume

**Upgrade to multi-agent when:**
- Hitting token/context limits regularly
- Need faster implementation (parallel builders)
- Large team with high feature volume
- Want systematic quality gates

### Learn More

See **`multi-agent-protocol.md`** for complete documentation including:
- Detailed agent definitions and prompts
- Workflow patterns (happy path, rejection, blockers, escalation)
- File structure and artifact templates
- Implementation options (AI coding assistant agents, coordinated workflow, separate sessions)
- Advanced patterns (parallel builders, context caching, incremental loading)
- 10 open questions for community exploration

### Try It Out

See **`example-workflow.md`** for a complete example:
- Real feature implementation (user profile update)
- Usage instructions for AI coding assistants (Claude Code, OpenCode, Cursor, etc.)
- All artifacts produced at each stage
- Step-by-step walkthrough from request to deployed code

**Agent Definitions**: Ready to use in `agents/definitions/` directory
- `architect.md` - The Planner
- `guardian.md` - The Validator
- `builder.md` - The Implementer

**Status**: Proposed architecture ready for testing and community feedback.

---

## 🎯 Recommended First Steps

1. **Personal Validation:**
    - Set up MCP servers on your machine (Artifact #4)
    - Select a real ticket from your backlog
    - Use the Template (Artifact #1) and Prompts (Artifact #2) to solve it
    - Validate the framework works in your environment

2. **Pilot Program:**
    - Run the workshop with a small group (3-5 developers)
    - Gather feedback and refine materials
    - Create team-specific examples

3. **Full Rollout:**
    - Schedule workshops for entire development team
    - Integrate specs into your PR/review process
    - Track metrics (spec quality scores, time-to-implementation, bug rates)

4. **Continuous Improvement:**
    - Collect examples of excellent specs for future reference
    - Update the Prompt Library based on common patterns
    - Share learnings across teams

---

## 📚 Additional Resources

- **Spec Kit (GitHub):** [https://github.com/github/spec-kit](https://github.com/github/spec-kit)
- **Spec Kit Documentation:** [https://speckit.org/](https://speckit.org/)
- **Martin Fowler on SDD:** [https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- **Microsoft on Spec-Driven Development:** [https://developer.microsoft.com/blog/spec-driven-development-spec-kit](https://developer.microsoft.com/blog/spec-driven-development-spec-kit)
- **MCP Servers by Microsoft:** [https://developer.microsoft.com/blog/10-microsoft-mcp-servers-to-accelerate-your-development-workflow](https://developer.microsoft.com/blog/10-microsoft-mcp-servers-to-accelerate-your-development-workflow)
- **Top MCP Servers 2025:** [https://www.docker.com/blog/top-mcp-servers-2025/](https://www.docker.com/blog/top-mcp-servers-2025/)

---

**Version:** 1.0  
**Last Updated:** 2025  
**License:** Adapt freely for your organization's use

