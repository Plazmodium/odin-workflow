# Multi-Agent SDD Workflow: Complete Example

This document demonstrates a complete feature implementation using the three-agent system (Architect → Guardian → Builder), with practical usage instructions for AI coding assistants (e.g., **Claude Code**, **OpenCode**, **Cursor**, **Codex**).

---

## Table of Contents

1. [Feature Request](#feature-request)
2. [Usage Guide: Agent-Based Workflow](#usage-guide-agent-based-workflow)
3. [Usage Guide: Cursor](#usage-guide-cursor)
4. [Complete Workflow Example](#complete-workflow-example)
5. [Artifacts Produced](#artifacts-produced)

---

## Feature Request

**User Story**:
> As a user, I want to update my profile information (name and bio) so that other users see accurate information about me.

**Context**:
- We have an existing user authentication system
- User profile data is stored in PostgreSQL
- Frontend is React with TypeScript
- Backend is Express with TypeScript

**Initial Requirements**:
- Users should be able to edit their name and bio
- Changes should be validated (name required, bio max 500 chars)
- Only authenticated users can update their own profile
- API should return updated profile on success

---

## Usage Guide: Agent-Based Workflow

### Approach 1: Parallel Agent Execution (Recommended)

**When to use**: Maximum speed, agents run independently

```bash
# Step 1: Launch Architect Agent
# The Architect creates the spec and tasks
$ claude-code

> Use the architect agent to create a spec for the profile update feature.
>
> Feature: Allow users to update their profile (name and bio)
> - User must be authenticated
> - Name is required, bio is optional (max 500 chars)
> - API endpoint: PATCH /api/users/:id/profile
> - Return updated profile on success

[Architect agent runs...]
[Produces: specs/USER-004-profile-update/spec.md]
[Produces: specs/USER-004-profile-update/tasks.md]

# Step 2: Launch Guardian Agent (after Architect completes)
> Use the guardian agent to validate specs/USER-004-profile-update/spec.md

[Guardian agent runs...]
[Produces: specs/USER-004-profile-update/review.md (APPROVED)]
[Produces: specs/USER-004-profile-update/context.md]

# Step 3: Launch Builder Agent (after Guardian approves)
> Use the builder agent to implement specs/USER-004-profile-update/spec.md

[Builder agent runs...]
[Produces: Implementation code + tests]
[Produces: specs/USER-004-profile-update/implementation-notes.md]

✅ Done! Feature implemented in ~15 minutes
```

---

### Approach 2: Delegated/Coordinated Workflow

**When to use**: You want one agent to coordinate the entire process

```bash
$ claude-code

> I need you to coordinate the multi-agent workflow to implement a profile update feature.
>
> Use the three-agent system:
> 1. Architect agent creates the spec
> 2. Guardian agent validates it
> 3. Builder agent implements it
>
> Feature requirements:
> - Allow users to update their profile (name and bio)
> - User must be authenticated
> - Name is required, bio is optional (max 500 chars)
> - API endpoint: PATCH /api/users/:id/profile
> - Return updated profile on success
>
> Coordinate all three agents and show me the results at each stage.

[Orchestrator acts as coordinator:]

Phase 1: Launching Architect Agent...
[Architect runs and produces spec.md + tasks.md]

Architect Complete ✅
- Spec: specs/USER-004-profile-update/spec.md
- Tasks: 7 tasks
- Complexity: Level 2 (Standard Feature)
- Self-score: 2/2 (AI-Ready)

Phase 2: Launching Guardian Agent...
[Guardian validates spec against codebase]

Guardian Complete ✅
- Decision: APPROVED
- Issues found: 0
- Context bundle created: 8,500 tokens
- Review: specs/USER-004-profile-update/review.md

Phase 3: Launching Builder Agent...
[Builder implements following spec and context bundle]

Builder Complete ✅
- Files created: 3
- Tests: 6 (all passing)
- Deviations: 0
- Time: 12 minutes

✅ Feature Complete!
All artifacts in: specs/USER-004-profile-update/
```

---

### Approach 3: Manual Agent Invocation (Most Control)

**When to use**: You want to review/modify between each stage

```bash
# Terminal 1: Architect
$ claude-code agent:architect

> Create a spec for profile update feature:
> - Users can update name and bio
> - Authentication required
> - Validation: name required, bio max 500 chars

[Review spec.md output, make manual edits if needed]

# Terminal 2: Guardian (after reviewing Architect output)
$ claude-code agent:guardian

> Validate specs/USER-004-profile-update/spec.md

[Review review.md - if REJECTED, go back to Architect]
[If APPROVED, proceed to Builder]

# Terminal 3: Builder (after Guardian approval)
$ claude-code agent:builder

> Implement specs/USER-004-profile-update/spec.md

[Review implementation, tests pass]
✅ Done
```

---

## Usage Guide: Cursor

### Setup in Cursor

1. **Add Agent Definitions to Cursor Rules**

Create or update `.cursorrules` in your project root:

```markdown
# Multi-Agent SDD Workflow

This project uses a three-agent specification-driven development workflow.

## Available Agents

### Architect Agent (The Planner)
See: agents/definitions/architect.md
Role: Creates specifications and task breakdowns
Use: @architect <feature request>

### Guardian Agent (The Validator)
See: agents/definitions/guardian.md
Role: Validates specs against codebase
Use: @guardian <spec file path>

### Builder Agent (The Implementer)
See: agents/definitions/builder.md
Role: Implements approved specifications
Use: @builder <spec file path>

## Workflow

1. Architect creates spec → specs/[ID]/spec.md
2. Guardian validates → specs/[ID]/review.md (APPROVED/REJECTED)
3. Builder implements → code + tests

Always follow the three-phase workflow for new features.
```

---

### Approach 1: Using Cursor Composer (Coordinated)

**Best for**: Full feature implementation in one session

1. **Open Cursor Composer** (Cmd/Ctrl + Shift + I)

2. **Send coordinated request**:

```
I need to implement a profile update feature using the multi-agent SDD workflow.

Phase 1 - ARCHITECT:
Read agents/definitions/architect.md and act as the Architect agent.
Create a spec for this feature:
- Allow users to update their profile (name and bio)
- Authentication required
- Name required, bio optional (max 500 chars)
- PATCH /api/users/:id/profile endpoint

Create:
- specs/USER-004-profile-update/spec.md
- specs/USER-004-profile-update/tasks.md

When done, tell me and I'll proceed to Guardian phase.
```

3. **After Architect completes**, continue in same Composer:

```
Phase 2 - GUARDIAN:
Read agents/definitions/guardian.md and act as the Guardian agent.
Validate specs/USER-004-profile-update/spec.md

Verify:
- All referenced files exist
- Database schemas match
- Patterns align with codebase

Create:
- specs/USER-004-profile-update/review.md
- specs/USER-004-profile-update/context.md

If APPROVED, tell me and I'll proceed to Builder.
```

4. **After Guardian approves**, continue:

```
Phase 3 - BUILDER:
Read agents/definitions/builder.md and act as the Builder agent.
Implement specs/USER-004-profile-update/spec.md

Use the context bundle from Guardian.
Create implementation code and tests.

Create:
- Implementation files (as specified)
- Test files
- specs/USER-004-profile-update/implementation-notes.md
```

---

### Approach 2: Using Cursor Chat (Step-by-Step)

**Best for**: Reviewing each stage before proceeding

**Step 1: Architect Phase**

Open Cursor Chat (Cmd/Ctrl + L) and type:

```
@architect

I need a spec for a profile update feature.

Feature requirements:
- Users can update their name and bio
- Must be authenticated
- Validation: name required, bio max 500 chars
- Endpoint: PATCH /api/users/:id/profile

Read agents/definitions/architect.md for your instructions.
Create the spec following the template.

Output files:
- specs/USER-004-profile-update/spec.md
- specs/USER-004-profile-update/tasks.md
```

**Step 2: Review Architect Output**

- Open `specs/USER-004-profile-update/spec.md`
- Review for clarity and completeness
- Make manual edits if needed
- When satisfied, proceed to Guardian

**Step 3: Guardian Phase**

In Cursor Chat:

```
@guardian

Validate the spec at specs/USER-004-profile-update/spec.md

Read agents/definitions/guardian.md for your instructions.

Verify against our codebase:
- Check file references exist
- Validate against database schema
- Ensure patterns match our conventions

Create review.md and context.md
```

**Step 4: Review Guardian Output**

- Open `specs/USER-004-profile-update/review.md`
- If **REJECTED**: Fix issues and re-run Architect
- If **APPROVED**: Proceed to Builder

**Step 5: Builder Phase**

In Cursor Chat:

```
@builder

Implement the approved spec at specs/USER-004-profile-update/spec.md

Read agents/definitions/builder.md for your instructions.

Use the context bundle from specs/USER-004-profile-update/context.md

Implement:
- All tasks from tasks.md
- Tests for all acceptance criteria
- Link code to spec sections

Create implementation-notes.md documenting your work.
```

**Step 6: Verify Implementation**

- Run tests: `npm test`
- Review implementation against spec
- Check all acceptance criteria met

---

### Approach 3: Using Cursor Rules + Agent Files

**Best for**: Automatic agent behavior without explicit prompting

**Setup**:

1. Create `.cursor/rules/architect.md`:
```markdown
When the user says "architect:" or "@architect", you should:
1. Read the content of agents/definitions/architect.md
2. Follow all instructions in that file
3. Act as the Architect agent
4. Create specifications following the SDD template
```

2. Create `.cursor/rules/guardian.md`:
```markdown
When the user says "guardian:" or "@guardian", you should:
1. Read the content of agents/definitions/guardian.md
2. Follow all instructions in that file
3. Act as the Guardian agent
4. Validate specifications against the codebase
```

3. Create `.cursor/rules/builder.md`:
```markdown
When the user says "builder:" or "@builder", you should:
1. Read the content of agents/definitions/builder.md
2. Follow all instructions in that file
3. Act as the Builder agent
4. Implement code following approved specifications
```

**Usage**:

```
# In Cursor Chat:

architect: Create spec for profile update feature (name and bio editing)

[Architect produces spec...]

guardian: Validate specs/USER-004-profile-update/spec.md

[Guardian validates...]

builder: Implement specs/USER-004-profile-update/spec.md

[Builder implements...]
```

---

## Complete Workflow Example

### Phase 1: Architect Agent Output

**File**: `specs/USER-004-profile-update/spec.md`

```markdown
# Specification: User Profile Update

**ID**: USER-004-profile-update
**Complexity Level**: 2
**Status**: draft
**Created**: 2026-01-06
**Version**: 1.0

---

## 1. Context & Goals (The "Why")

**User Story**:
As a user, I want to update my profile information (name and bio) so that other users see accurate information about me.

**Problem Solved**:
Users currently cannot modify their profile information after account creation, leading to outdated or incorrect information being displayed.

**Success Metrics**:
- [ ] User can update profile within 2 clicks
- [ ] Profile updates complete within 500ms (p95)
- [ ] Validation errors are clear and actionable
- [ ] Only profile owner can update their own profile (security)

---

## 2. Behavioral Requirements (The "What")

### Core Flows

**Happy Path**:
1. User navigates to profile settings page
2. User edits name field (required) and/or bio field (optional)
3. User clicks "Save Changes" button
4. System validates input
5. System saves changes to database
6. System displays success message
7. Updated profile is immediately visible

**Alternative Path (Partial Update)**:
1. User edits only name OR only bio (not both)
2. System accepts partial updates
3. Only modified fields are updated

**Alternative Path (Cancel)**:
1. User edits fields
2. User clicks "Cancel" button
3. Form resets to original values
4. No changes saved

### Edge Cases & Constraints

- **ec_1**: What if name field is empty?
  - Display validation error: "Name is required"
  - Do not submit form
  - Highlight name field in red

- **ec_2**: What if bio exceeds 500 characters?
  - Display validation error: "Bio must be 500 characters or less"
  - Show character count: "523/500"
  - Do not submit form

- **ec_3**: What if network request fails?
  - Display error: "Failed to save changes. Please try again."
  - Keep form data (don't clear)
  - Retry button shown

- **ec_4**: What if user tries to update another user's profile?
  - API returns 403 Forbidden
  - Display error: "You can only edit your own profile"

- **ec_5**: What if user is not authenticated?
  - API returns 401 Unauthorized
  - Redirect to login page

- **constraint_1**: Must use existing User type from `@types/user.ts` - TO BE VERIFIED BY GUARDIAN
- **constraint_2**: Must use existing authentication middleware - TO BE VERIFIED BY GUARDIAN
- **constraint_3**: Must match existing API response format - TO BE VERIFIED BY GUARDIAN

---

## 3. Acceptance Criteria (The "Test")

### Scenario 1: Successful Profile Update

- **Given**: User is authenticated and viewing their own profile
- **When**: User updates name to "Jane Smith" and bio to "Software engineer"
- **Then**:
  - API request: PATCH /api/users/:id/profile
  - Request body: `{ name: "Jane Smith", bio: "Software engineer" }`
  - HTTP 200 response
  - Response contains updated user object with new name and bio
  - Success message shown: "Profile updated successfully"
  - Form displays updated values

### Scenario 2: Validation - Empty Name

- **Given**: User is editing profile
- **When**: User clears name field and clicks Save
- **Then**:
  - Validation error shown: "Name is required"
  - Name field highlighted in red
  - No API request sent
  - Bio field retains its value

### Scenario 3: Validation - Bio Too Long

- **Given**: User is editing profile
- **When**: User enters 523 characters in bio and clicks Save
- **Then**:
  - Validation error shown: "Bio must be 500 characters or less"
  - Character counter shows: "523/500"
  - Bio field highlighted in red
  - No API request sent
  - Name field retains its value

### Scenario 4: Unauthorized Access

- **Given**: User is authenticated as user ID 123
- **When**: User attempts to PATCH /api/users/456/profile
- **Then**:
  - HTTP 403 response
  - Response body: `{ error: "You can only edit your own profile", code: "FORBIDDEN" }`
  - Error message shown to user
  - No changes saved

### Scenario 5: Network Failure

- **Given**: User has edited profile
- **When**: User clicks Save but network request times out
- **Then**:
  - Error message: "Failed to save changes. Please try again."
  - Form data preserved (not cleared)
  - Retry button shown
  - User can edit and retry

### Scenario 6: Unauthenticated User

- **Given**: User is not logged in
- **When**: User attempts to access PATCH /api/users/:id/profile
- **Then**:
  - HTTP 401 response
  - User redirected to login page
  - After login, user can access profile edit

---

## 4. Technical Implementation Design (The "How")

### Proposed Changes

**New Files**:
- `src/api/routes/profile.ts` - Profile update API endpoint
- `src/components/ProfileEditForm.tsx` - React form component
- `tests/api/profile.test.ts` - API endpoint tests
- `tests/components/ProfileEditForm.test.tsx` - Component tests

**Modified Files**:
- `src/api/routes/index.ts` - Register profile routes
- `src/types/user.ts` - Add ProfileUpdateRequest type (TO BE VERIFIED IF NEEDED)

### API Contract (Schema-First)

```typescript
// Request
interface ProfileUpdateRequest {
  name: string;      // Required, 1-100 chars
  bio?: string;      // Optional, max 500 chars
}

// Response (Success)
interface ProfileUpdateResponse {
  user: {
    id: string;
    email: string;
    name: string;
    bio: string | null;
    updatedAt: string;  // ISO 8601 timestamp
  };
}

// Response (Error)
interface ProfileUpdateError {
  error: string;
  code: 'VALIDATION_ERROR' | 'FORBIDDEN' | 'UNAUTHORIZED' | 'SERVER_ERROR';
  details?: {
    field: string;
    message: string;
  }[];
}
```

### Data Models

**TO BE VERIFIED BY GUARDIAN**:
- `users` table should have columns: id, email, name, bio, updated_at
- `name` column: varchar, NOT NULL
- `bio` column: varchar(500), NULL
- User type definition location: `src/types/user.ts`

### Frontend Component Structure

```typescript
interface ProfileEditFormProps {
  userId: string;
  initialName: string;
  initialBio: string | null;
  onSuccess?: (user: User) => void;
  onCancel?: () => void;
}

// Component will use:
// - React Hook Form for form management
// - Existing validation utilities (TO BE VERIFIED BY GUARDIAN)
// - Existing API client (TO BE VERIFIED BY GUARDIAN)
```

---

## 5. System Context (For AI Agents)

**Reference Implementations** (TO BE VERIFIED BY GUARDIAN):
- `@src/api/routes/auth.ts` - Follow error handling pattern
- `@src/components/LoginForm.tsx` - Follow form validation pattern
- `@src/api/middleware/auth.ts` - Use authentication middleware

**Global State**:
- Uses JWT authentication (tokens in localStorage)
- API client uses Axios (TO BE VERIFIED)
- Form validation uses React Hook Form (TO BE VERIFIED)

**Dependencies** (TO BE VERIFIED BY GUARDIAN):
- react-hook-form (for form management)
- axios (for API requests)
- jsonwebtoken (for auth verification)

---

## Questions for Guardian to Verify

1. Does `src/types/user.ts` exist with User type definition?
2. Does `users` table have `name` and `bio` columns with expected types?
3. Is there an authentication middleware we should use?
4. Do we have existing form validation patterns to follow?
5. What's our API client setup (Axios, fetch, other)?
6. Are there existing error handling utilities?
7. Do we have a pattern for optimistic updates in React?

---

## Self-Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| Ambiguity | 2 | All metrics concrete (500ms, 500 chars, specific error messages) |
| Testability | 2 | All scenarios in Given/When/Then format with exact assertions |
| Context | 2 | Specific file paths referenced (marked for Guardian verification) |
| Edge Cases | 2 | 6 edge cases defined with specific behaviors |
| Data Shape | 2 | Exact TypeScript interfaces for request/response |

**Overall**: 2/2 (AI-Ready)

**Issues to fix before Guardian review**: None
```

---

**File**: `specs/USER-004-profile-update/tasks.md`

```markdown
# Task Breakdown: User Profile Update

**Spec**: USER-004-profile-update
**Total Tasks**: 7
**Estimated Complexity**: Medium

---

## Phase 1: Backend API

### Task 1: Define Profile Update Types
**Acceptance Criteria**:
- [ ] Create or update `src/types/user.ts`
- [ ] Define `ProfileUpdateRequest` interface
- [ ] Define `ProfileUpdateResponse` interface
- [ ] Define `ProfileUpdateError` interface
- [ ] Export all types

**Dependencies**: None
**Estimated Time**: 5 minutes
**References**: Spec Section 4 (API Contract)

---

### Task 2: Implement Profile Update Endpoint
**Acceptance Criteria**:
- [ ] Create `src/api/routes/profile.ts`
- [ ] Implement PATCH /api/users/:id/profile route
- [ ] Use authentication middleware
- [ ] Verify user can only update own profile
- [ ] Validate name (required, 1-100 chars)
- [ ] Validate bio (optional, max 500 chars)
- [ ] Update database
- [ ] Return updated user object

**Dependencies**: Task 1
**Estimated Time**: 20 minutes
**References**: Spec Section 2 (Behavioral Requirements), Section 3 (Scenarios 1, 4, 6)

---

### Task 3: Add Error Handling
**Acceptance Criteria**:
- [ ] Handle validation errors (ec_1, ec_2)
- [ ] Handle unauthorized access (ec_4, ec_5)
- [ ] Handle database errors
- [ ] Return appropriate HTTP status codes
- [ ] Return error objects matching ProfileUpdateError type

**Dependencies**: Task 2
**Estimated Time**: 10 minutes
**References**: Spec Section 2 (Edge Cases), Section 3 (Scenarios 2, 3, 4, 6)

---

### Task 4: Write API Tests
**Acceptance Criteria**:
- [ ] Create `tests/api/profile.test.ts`
- [ ] Test Scenario 1: Successful update
- [ ] Test Scenario 2: Empty name validation
- [ ] Test Scenario 3: Bio too long validation
- [ ] Test Scenario 4: Unauthorized access
- [ ] Test Scenario 6: Unauthenticated user
- [ ] All tests passing

**Dependencies**: Task 3
**Estimated Time**: 15 minutes
**References**: Spec Section 3 (All Scenarios)

---

## Phase 2: Frontend Component

### Task 5: Create Profile Edit Form Component
**Acceptance Criteria**:
- [ ] Create `src/components/ProfileEditForm.tsx`
- [ ] Implement form with name and bio fields
- [ ] Add character counter for bio (X/500)
- [ ] Add Save and Cancel buttons
- [ ] Implement client-side validation
- [ ] Call PATCH /api/users/:id/profile on submit
- [ ] Show success message on completion
- [ ] Show error messages for validation/network failures

**Dependencies**: Task 4 (API must exist)
**Estimated Time**: 25 minutes
**References**: Spec Section 2 (Core Flows), Section 3 (All Scenarios)

---

### Task 6: Handle Edge Cases in UI
**Acceptance Criteria**:
- [ ] Highlight fields with validation errors
- [ ] Preserve form data on network failure (ec_3)
- [ ] Show retry button on failure
- [ ] Reset form on cancel
- [ ] Disable submit while request in progress
- [ ] Handle 401/403 responses appropriately

**Dependencies**: Task 5
**Estimated Time**: 15 minutes
**References**: Spec Section 2 (Edge Cases)

---

### Task 7: Write Component Tests
**Acceptance Criteria**:
- [ ] Create `tests/components/ProfileEditForm.test.tsx`
- [ ] Test successful form submission
- [ ] Test validation errors (empty name, long bio)
- [ ] Test cancel functionality
- [ ] Test error handling
- [ ] Test loading states
- [ ] All tests passing

**Dependencies**: Task 6
**Estimated Time**: 20 minutes
**References**: Spec Section 3 (All Scenarios)

---

## Summary

**Total Tasks**: 7
**Total Estimated Time**: 110 minutes (~2 hours)
**Phases**: 2 (Backend API → Frontend Component)
**Critical Path**: Task 1 → 2 → 3 → 4 → 5 → 6 → 7

**Parallel Opportunities**:
- None (tasks are sequential due to dependencies)
- However, if separate builders are used:
  - Builder 1: Tasks 1-4 (Backend)
  - Builder 2: Tasks 5-7 (Frontend) - can start once Task 4 completes
```

---

### Phase 2: Guardian Agent Output

**File**: `specs/USER-004-profile-update/review.md`

```markdown
# Guardian Validation Report

**Spec**: USER-004-profile-update
**Review Date**: 2026-01-06
**Reviewer**: Guardian Agent
**Decision**: APPROVED ✅

---

## Validation Checklist Results

### 1. Context Validation
- [x] All referenced files checked
  - ✓ `src/types/user.ts` exists
  - ⚠️ `src/api/routes/profile.ts` does not exist (will be created - OK)
  - ✓ `src/api/routes/index.ts` exists
  - ✓ `src/api/middleware/auth.ts` exists
  - ⚠️ `src/components/ProfileEditForm.tsx` does not exist (will be created - OK)
- [x] File versions match expected structure
- [x] No conflicting file names
- [x] Dependencies available
  - ✓ react-hook-form@7.48.2 in package.json
  - ✓ axios@1.6.2 in package.json
  - ✓ jsonwebtoken@9.0.2 in package.json

### 2. Data Model Validation
- [x] Database schemas verified
  - ✓ `users` table exists
  - ✓ Column: `id` (uuid, primary key)
  - ✓ Column: `email` (varchar, unique, not null)
  - ✓ Column: `name` (varchar(100), not null)
  - ✓ Column: `bio` (varchar(500), null) ✓
  - ✓ Column: `updated_at` (timestamp, default NOW())
- [x] Type definitions match
  - ✓ User type in `src/types/user.ts:8-15` matches database schema
- [x] No type name conflicts

### 3. Pattern Alignment
- [x] Error handling follows `src/api/routes/auth.ts:67-89`
- [x] Form validation follows `src/components/LoginForm.tsx:45-78`
- [x] Authentication middleware at `src/api/middleware/auth.ts:12-34`
- [x] API response format consistent with existing endpoints

### 4. Edge Case Coverage
- [x] Empty name validation → Pattern exists in validation utils
- [x] Bio length validation → Pattern exists in validation utils
- [x] Network failures → Error pattern exists
- [x] Unauthorized access → Auth middleware handles this
- [x] Unauthenticated users → Auth middleware handles this

### 5. Breaking Change Assessment
- [x] No breaking changes to public APIs
- [x] Backward compatible (new endpoint, no modifications to existing)
- [x] No database migrations needed (schema already supports this)

### 6. Security Review
- [x] No SQL injection risk (using ORM with parameterized queries)
- [x] Authentication required (middleware in place)
- [x] Authorization check (user can only update own profile)
- [x] Input validation (name and bio length limits)
- [x] No sensitive data exposure

### 7. Spec Quality Re-Check
- [x] Acceptance criteria are testable
- [x] Tasks in correct dependency order
- [x] No hallucination risk
- [x] Complexity estimates reasonable

### 8. Context Bundle Created
- [x] Identified 8 files for Builder to read
- [x] Extracted relevant patterns
- [x] Documented anti-patterns to avoid
- [x] Context bundle size: 8,750 tokens ✓

---

## Issues Found

**None** - Spec is AI-Ready ✅

---

## Context Verification

**Files Checked**: 8
- `src/types/user.ts`
- `src/api/routes/auth.ts`
- `src/api/routes/index.ts`
- `src/api/middleware/auth.ts`
- `src/components/LoginForm.tsx`
- `src/utils/validation.ts`
- `src/db/models/user.model.ts`
- `tests/api/auth.test.ts`

**Schemas Verified**: 1
- `users` table (PostgreSQL)

**Patterns Confirmed**: 4
- Error handling pattern
- Form validation pattern
- Authentication middleware pattern
- API response format

---

## Recommendations for Builder

### Use Authentication Middleware
From `src/api/middleware/auth.ts:12-34`:
```typescript
import { authMiddleware, requireOwnership } from '../middleware/auth';

router.patch(
  '/users/:id/profile',
  authMiddleware,              // Verifies JWT token
  requireOwnership('userId'),  // Ensures user can only edit own profile
  async (req, res) => {
    // Handler implementation
  }
);
```

### Follow Error Handling Pattern
From `src/api/routes/auth.ts:67-89`:
```typescript
try {
  // Main logic
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: error.message,
      code: 'VALIDATION_ERROR',
      details: error.details
    });
  }
  if (error instanceof DatabaseError) {
    logger.error('Database error:', error);
    return res.status(500).json({
      error: 'Server error',
      code: 'SERVER_ERROR'
    });
  }
  throw error;
}
```

### Follow Form Validation Pattern
From `src/components/LoginForm.tsx:45-78`:
```typescript
const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
  setError
} = useForm<FormData>();

const onSubmit = async (data: FormData) => {
  try {
    await api.updateProfile(data);
    showSuccess('Profile updated successfully');
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      error.details?.forEach(({ field, message }) => {
        setError(field, { message });
      });
    } else {
      showError('Failed to save changes. Please try again.');
    }
  }
};
```

---

## Decision Matrix

| Criterion | Result |
|-----------|--------|
| All files exist or will be created | ✓ |
| Schemas match | ✓ |
| Patterns aligned | ✓ |
| No security issues | ✓ |
| No breaking changes | ✓ |

**Final Decision**: APPROVED ✅

---

## Next Steps

1. Builder Agent may proceed with implementation
2. Read context bundle from `context.md`
3. Follow patterns documented above
4. Implement tasks in order from `tasks.md`
5. Run tests after each phase

---

**Guardian Validation Complete**
**Timestamp**: 2026-01-06T11:15:00Z
```

---

**File**: `specs/USER-004-profile-update/context.md`

```markdown
# Context Bundle for Builder Agent

**Spec**: USER-004-profile-update
**Created**: 2026-01-06
**Size**: 8,750 tokens

This file contains everything the Builder needs to implement the feature without reading the entire codebase.

---

## Files to Read

### 1. `src/types/user.ts` (lines 8-15)
**Purpose**: Understand existing User type structure

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Action**: Add ProfileUpdateRequest, ProfileUpdateResponse, ProfileUpdateError types as specified in spec.

---

### 2. `src/api/middleware/auth.ts` (lines 12-34, 45-67)
**Purpose**: Use authentication and authorization middleware

```typescript
import jwt from 'jsonwebtoken';

// Verify JWT token
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'UNAUTHORIZED'
    });
  }
};

// Ensure user can only modify their own resources
export const requireOwnership = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params[paramName];
    const userId = req.user?.id;

    if (resourceId !== userId) {
      return res.status(403).json({
        error: 'You can only edit your own profile',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};
```

**Pattern to copy**:
- Use both `authMiddleware` and `requireOwnership('id')` in route
- authMiddleware adds `req.user.id`
- requireOwnership checks params.id === req.user.id

---

### 3. `src/api/routes/auth.ts` (lines 67-89)
**Purpose**: Error handling pattern to follow

```typescript
import { Router } from 'express';
import { ValidationError, DatabaseError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

router.post('/auth/register', async (req, res) => {
  try {
    // Main logic here
    const user = await createUser(req.body);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: error.message,
        code: 'VALIDATION_ERROR',
        details: error.details  // [{ field: 'email', message: 'Invalid format' }]
      });
    }

    if (error instanceof DatabaseError) {
      logger.error('Database error:', error);
      return res.status(500).json({
        error: 'Server error',
        code: 'SERVER_ERROR'
      });
    }

    // Unknown error
    logger.error('Unexpected error:', error);
    res.status(500).json({
      error: 'Server error',
      code: 'SERVER_ERROR'
    });
  }
});

export default router;
```

**Pattern to copy**:
- Try-catch structure
- Check error types with instanceof
- Return appropriate status codes (400 for validation, 401 for auth, 403 for forbidden, 500 for server errors)
- Log server errors but return generic message
- Include error details for validation errors

---

### 4. `src/utils/validation.ts` (lines 23-45, 67-89)
**Purpose**: Validation utilities

```typescript
export class ValidationError extends Error {
  public details: { field: string; message: string }[];

  constructor(message: string, details: { field: string; message: string }[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function validateString(
  value: any,
  fieldName: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): { valid: boolean; error?: { field: string; message: string } } {

  if (options.required && (!value || value.trim() === '')) {
    return {
      valid: false,
      error: { field: fieldName, message: `${fieldName} is required` }
    };
  }

  if (value && options.maxLength && value.length > options.maxLength) {
    return {
      valid: false,
      error: {
        field: fieldName,
        message: `${fieldName} must be ${options.maxLength} characters or less`
      }
    };
  }

  if (value && options.minLength && value.length < options.minLength) {
    return {
      valid: false,
      error: {
        field: fieldName,
        message: `${fieldName} must be at least ${options.minLength} characters`
      }
    };
  }

  return { valid: true };
}
```

**Pattern to copy**:
- Use ValidationError class for validation failures
- Use validateString for name and bio validation
- Collect all validation errors before returning

---

### 5. `src/db/models/user.model.ts` (lines 34-56)
**Purpose**: Database operations pattern

```typescript
import { db } from '../connection';

export async function updateUser(
  userId: string,
  updates: Partial<{ name: string; bio: string }>
): Promise<User> {

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }

  if (updates.bio !== undefined) {
    setClauses.push(`bio = $${paramIndex++}`);
    values.push(updates.bio);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(userId);

  const query = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, name, bio, created_at, updated_at
  `;

  const result = await db.query(query, values);

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    bio: row.bio,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

**Pattern to copy**:
- Dynamic query building for partial updates
- Always update `updated_at` timestamp
- Use RETURNING to get updated row
- Map snake_case to camelCase

---

### 6. `src/components/LoginForm.tsx` (lines 45-120)
**Purpose**: Form component pattern

```typescript
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { api } from '../utils/api';

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError
  } = useForm<LoginFormData>();

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const onSubmit = async (data: LoginFormData) => {
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await api.post('/auth/login', data);
      setSuccessMessage('Login successful!');
      // Handle success (e.g., save token, redirect)
    } catch (error: any) {
      if (error.response?.data?.code === 'VALIDATION_ERROR') {
        // Set field-specific errors
        error.response.data.details?.forEach(({ field, message }: any) => {
          setError(field as keyof LoginFormData, { message });
        });
      } else {
        // Set general error message
        setErrorMessage(
          error.response?.data?.error || 'An error occurred. Please try again.'
        );
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register('email', { required: 'Email is required' })}
          className={errors.email ? 'error' : ''}
        />
        {errors.email && <span className="error-message">{errors.email.message}</span>}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register('password', { required: 'Password is required' })}
          className={errors.password ? 'error' : ''}
        />
        {errors.password && <span className="error-message">{errors.password.message}</span>}
      </div>

      {successMessage && <div className="success-message">{successMessage}</div>}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
```

**Pattern to copy**:
- Use React Hook Form's register, handleSubmit, errors, isSubmitting
- Clear messages at start of submit
- Handle validation errors by setting field-specific errors
- Handle general errors with errorMessage state
- Disable submit button while submitting
- Add 'error' class to fields with errors

---

### 7. `src/utils/api.ts` (lines 12-34)
**Purpose**: API client setup

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**Pattern to copy**:
- Use the existing `api` client (already configured)
- Auth token automatically added by interceptor
- 401 responses automatically redirect to login

---

### 8. `tests/api/auth.test.ts` (lines 23-89)
**Purpose**: API test structure

```typescript
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/db/connection';

describe('API: Auth', () => {
  beforeEach(async () => {
    // Clean database before each test
    await db.query('DELETE FROM users');
  });

  afterAll(async () => {
    // Close database connection
    await db.end();
  });

  describe('POST /auth/register', () => {
    it('should register user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
          name: 'Test User'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return validation error for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: expect.any(String)
          })
        ])
      );
    });

    it('should return 401 for missing auth token', async () => {
      const response = await request(app)
        .patch('/api/users/123/profile')
        .send({ name: 'New Name' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });
  });
});
```

**Pattern to copy**:
- Use supertest for API testing
- Clean database in beforeEach
- Close connections in afterAll
- Test success cases first
- Test error cases separately
- Check exact status codes and error codes
- Verify response structure matches spec

---

## Database Schema

### `users` table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  bio VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Fields for this feature**:
- `id`: User identifier (from URL params and JWT)
- `name`: Required, max 100 chars (spec says 1-100)
- `bio`: Optional, max 500 chars
- `updated_at`: Auto-update on save

---

## Environment Variables

**Required**:
- `JWT_SECRET`: Secret key for JWT verification (already configured)
- `DATABASE_URL`: PostgreSQL connection string (already configured)
- `REACT_APP_API_URL`: API base URL for frontend (already configured)

---

## Patterns to Follow

### 1. Route Definition

```typescript
// src/api/routes/profile.ts
import { Router } from 'express';
import { authMiddleware, requireOwnership } from '../middleware/auth';

const router = Router();

router.patch(
  '/users/:id/profile',
  authMiddleware,              // Verify JWT
  requireOwnership('id'),      // Check ownership
  async (req, res) => {
    // Implementation
  }
);

export default router;
```

### 2. Input Validation

```typescript
import { validateString, ValidationError } from '../utils/validation';

const errors: { field: string; message: string }[] = [];

// Validate name
const nameValidation = validateString(req.body.name, 'name', {
  required: true,
  minLength: 1,
  maxLength: 100
});
if (!nameValidation.valid && nameValidation.error) {
  errors.push(nameValidation.error);
}

// Validate bio
if (req.body.bio !== undefined) {
  const bioValidation = validateString(req.body.bio, 'bio', {
    maxLength: 500
  });
  if (!bioValidation.valid && bioValidation.error) {
    errors.push(bioValidation.error);
  }
}

if (errors.length > 0) {
  throw new ValidationError('Validation failed', errors);
}
```

### 3. React Form with Character Counter

```tsx
// Character counter for bio
const [bioLength, setBioLength] = useState(0);

<textarea
  {...register('bio', {
    maxLength: {
      value: 500,
      message: 'Bio must be 500 characters or less'
    }
  })}
  onChange={(e) => setBioLength(e.target.value.length)}
  className={errors.bio ? 'error' : ''}
/>
<div className="character-count">
  {bioLength}/500
</div>
{errors.bio && <span className="error-message">{errors.bio.message}</span>}
```

---

## Anti-Patterns to Avoid

### ❌ Don't allow updating other fields

```typescript
// WRONG - Allows updating any user field
router.patch('/users/:id/profile', async (req, res) => {
  await updateUser(userId, req.body);  // Security risk!
});

// CORRECT - Only allow name and bio
router.patch('/users/:id/profile', async (req, res) => {
  const { name, bio } = req.body;  // Explicit extraction
  await updateUser(userId, { name, bio });
});
```

### ❌ Don't skip ownership check

```typescript
// WRONG - Any authenticated user can update any profile
router.patch('/users/:id/profile', authMiddleware, handler);

// CORRECT - User can only update own profile
router.patch('/users/:id/profile', authMiddleware, requireOwnership('id'), handler);
```

### ❌ Don't expose database errors

```typescript
// WRONG - Exposes database details
} catch (error) {
  res.status(500).json({ error: error.message });  // Might leak SQL
}

// CORRECT - Generic error message
} catch (error) {
  logger.error('Database error:', error);
  res.status(500).json({ error: 'Server error', code: 'SERVER_ERROR' });
}
```

---

## Security Notes

1. **Authorization**: Always use both authMiddleware AND requireOwnership
2. **Input Sanitization**: validateString handles trimming and length checks
3. **Field Whitelisting**: Only extract `name` and `bio` from req.body
4. **Error Messages**: Don't expose whether user exists (403 vs 404)

---

## Performance Targets

From spec acceptance criteria:
- Response time: < 500ms (p95)
- Test with realistic payload sizes

---

## Summary

**What to build**:
1. Backend: `src/api/routes/profile.ts` (PATCH endpoint)
2. Backend: Update `src/types/user.ts` (add new types)
3. Frontend: `src/components/ProfileEditForm.tsx` (React form)
4. Tests: `tests/api/profile.test.ts` (6 scenarios)
5. Tests: `tests/components/ProfileEditForm.test.tsx` (form tests)

**Patterns to copy**:
- Auth: Use authMiddleware + requireOwnership
- Validation: Use validateString utility
- Error handling: Try-catch with error type checking
- Forms: React Hook Form with field-specific errors
- Database: Dynamic query building for partial updates

**Key rules**:
- Only allow updating name and bio (nothing else)
- User can only update their own profile
- Name required, bio optional
- Bio max 500 chars
- Update updated_at timestamp

---

**Context Bundle Complete**
**Builder may now proceed with implementation**
```

---

### Phase 3: Builder Agent Output

**File**: `specs/USER-004-profile-update/implementation-notes.md`

```markdown
# Implementation Notes

**Spec**: USER-004-profile-update
**Builder**: Builder Agent
**Started**: 2026-01-06T11:30:00Z
**Completed**: 2026-01-06T13:22:00Z

---

## Tasks Completed

### Task 1: Define Profile Update Types
**Completed**: 2026-01-06T11:35:00Z
**Files Modified**: `src/types/user.ts` (+18 lines)
**Decisions**: Added types at end of file to maintain organization
**Deviations**: None

### Task 2: Implement Profile Update Endpoint
**Completed**: 2026-01-06T11:58:00Z
**Files Created**: `src/api/routes/profile.ts` (87 lines)
**Files Modified**: `src/api/routes/index.ts` (+2 lines)
**Decisions**:
- Registered route as `/api/users/:id/profile` (matches spec)
- Used existing validation utilities from context bundle
**Deviations**: None

### Task 3: Add Error Handling
**Completed**: 2026-01-06T12:08:00Z
**Files Modified**: `src/api/routes/profile.ts` (refactored error handling)
**Decisions**: Followed error pattern from auth.ts exactly
**Deviations**: None

### Task 4: Write API Tests
**Completed**: 2026-01-06T12:32:00Z
**Files Created**: `tests/api/profile.test.ts` (178 lines)
**Decisions**: Added 6 test cases matching all spec scenarios
**Test Results**: ✅ All 6 passing
**Deviations**: None

### Task 5: Create Profile Edit Form Component
**Completed**: 2026-01-06T13:02:00Z
**Files Created**: `src/components/ProfileEditForm.tsx` (156 lines)
**Decisions**:
- Added real-time character counter for bio field
- Followed LoginForm pattern from context bundle
**Deviations**: None

### Task 6: Handle Edge Cases in UI
**Completed**: 2026-01-06T13:12:00Z
**Files Modified**: `src/components/ProfileEditForm.tsx` (added error handling)
**Decisions**: Added retry button for network failures as specified
**Deviations**: None

### Task 7: Write Component Tests
**Completed**: 2026-01-06T13:22:00Z
**Files Created**: `tests/components/ProfileEditForm.test.tsx` (234 lines)
**Test Results**: ✅ All 8 tests passing
**Deviations**: None

---

## Assumptions Made

1. **JWT Token Location**
   - Assumption: Auth token stored in localStorage
   - Rationale: Matched existing pattern in api.ts (context bundle)
   - Risk: Low (already established pattern)

2. **Success Message Duration**
   - Assumption: Success message shows for 3 seconds then fades
   - Rationale: Standard UX pattern, not specified in spec
   - Risk: Low (minor UX detail)

---

## Deviations from Spec

**None** - Implemented exactly as specified ✅

---

## Blockers Encountered

**None** - Context bundle was complete and accurate ✅

---

## Files Created/Modified

### Created (5 files):
- `src/api/routes/profile.ts` (87 lines)
- `src/components/ProfileEditForm.tsx` (156 lines)
- `tests/api/profile.test.ts` (178 lines)
- `tests/components/ProfileEditForm.test.tsx` (234 lines)
- `specs/USER-004-profile-update/implementation-notes.md` (this file)

### Modified (2 files):
- `src/types/user.ts` (+18 lines)
- `src/api/routes/index.ts` (+2 lines)

**Total Lines Added**: 675
**Total Lines Modified**: 20

---

## Tests Summary

**Backend Tests**: 6
- ✅ Should update profile with valid data
- ✅ Should return validation error for empty name
- ✅ Should return validation error for bio too long
- ✅ Should return 403 when updating another user's profile
- ✅ Should return 401 when not authenticated
- ✅ Should handle partial updates (name only, bio only)

**Frontend Tests**: 8
- ✅ Should render form with initial values
- ✅ Should update profile successfully
- ✅ Should show validation error for empty name
- ✅ Should show validation error for bio > 500 chars
- ✅ Should show character counter
- ✅ Should handle network errors with retry
- ✅ Should reset form on cancel
- ✅ Should disable submit while loading

**Total Tests**: 14
**Passing**: 14 ✅
**Coverage**: 100% of spec scenarios

---

## Code Quality Checklist

- [x] All code has spec section comments
- [x] Follows patterns from context bundle exactly
- [x] No features beyond spec
- [x] All tests passing
- [x] Error messages match spec exactly
- [x] No hardcoded secrets
- [x] No security vulnerabilities
- [x] Input validation in place
- [x] Authorization checks working

---

## Performance

**Target**: Response time < 500ms (Spec Section 1)
**Actual**: Average 78ms, p95 156ms ✅

**How verified**: Added performance tracking in tests, measured 100 requests

---

## Security Verification

- [x] Authentication required (authMiddleware)
- [x] Authorization checked (requireOwnership)
- [x] Input validation (name and bio)
- [x] SQL injection prevented (parameterized queries)
- [x] No sensitive data in responses
- [x] Error messages don't leak info

---

## Ready for Review

- [x] Implementation complete
- [x] All tests passing (14/14)
- [x] Spec requirements met (100%)
- [x] No blockers
- [x] Documentation complete
- [x] Performance targets met
- [x] Security verified

---

## Next Steps

1. Run full test suite: `npm test`
2. Manual QA testing
3. Code review
4. Merge to main

**Feature is ready for production** ✅
```

---

## Artifacts Produced

The complete multi-agent workflow produces these files:

```
specs/USER-004-profile-update/
├── spec.md                      # From Architect (detailed specification)
├── tasks.md                     # From Architect (7 tasks, dependencies)
├── review.md                    # From Guardian (validation report)
├── context.md                   # From Guardian (8,750 token context bundle)
├── implementation-notes.md      # From Builder (completion summary)
└── status.json                  # Workflow state tracking

src/
├── api/
│   └── routes/
│       ├── profile.ts          # From Builder (PATCH endpoint)
│       └── index.ts            # From Builder (route registration)
├── types/
│   └── user.ts                 # From Builder (added 3 new types)
└── components/
    └── ProfileEditForm.tsx     # From Builder (React form)

tests/
├── api/
│   └── profile.test.ts         # From Builder (6 API tests)
└── components/
    └── ProfileEditForm.test.tsx # From Builder (8 component tests)
```

**Total Workflow Time**: ~1 hour 52 minutes
- Architect: ~10 minutes
- Guardian: ~5 minutes
- Builder: ~1 hour 37 minutes

**Total Token Usage**: ~27,200 tokens (vs 60,000+ monolithic)

**Quality Metrics**:
- Spec Score: 2/2 (AI-Ready)
- Guardian Issues: 0
- Tests Passing: 14/14
- Spec Deviations: 0
- Blockers: 0

---

## Summary

This example demonstrates:

✅ **Complete workflow** from feature request to implementation
✅ **All three agents** working in sequence
✅ **Realistic complexity** (Level 2 feature with backend + frontend)
✅ **Practical usage** for any AI coding assistant (Claude Code, OpenCode, Cursor, etc.)
✅ **All artifacts** showing what gets produced
✅ **Quality gates** at each stage (rubric, validation, tests)
✅ **Token efficiency** (54% reduction vs monolithic)
✅ **Zero hallucination** (all references verified by Guardian)

The three-agent system successfully:
- Prevented hallucination (Guardian verified all file/schema references)
- Maintained spec alignment (Builder followed spec exactly)
- Produced complete documentation (full audit trail)
- Achieved quality targets (all tests passing, no deviations)
