---
name: generic-dev
description: Universal software development best practices - the fallback skill when no specific tech stack skills are available
category: foundation
version: "1.0"
compatible_with:
  - all
---

# Generic Software Development

## Overview

This skill provides universal software development principles that apply across all languages, frameworks, and platforms. Use this as a fallback when specific tech stack skills are not available, or as a foundation that complements specialized skills.

## When This Skill Applies

- No specific framework/language skills match the project's tech stack
- Building from scratch without established patterns
- Working with unfamiliar or legacy codebases
- General architectural decisions before tech stack selection

## Core Principles

### SOLID Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **S**ingle Responsibility | One class/module = one reason to change | Split large files by concern |
| **O**pen/Closed | Open for extension, closed for modification | Use interfaces and composition |
| **L**iskov Substitution | Subtypes must be substitutable for base types | Don't break contracts in subclasses |
| **I**nterface Segregation | Many specific interfaces > one general interface | Split large interfaces |
| **D**ependency Inversion | Depend on abstractions, not concretions | Inject dependencies, use interfaces |

### DRY, KISS, YAGNI

- **DRY** (Don't Repeat Yourself): Extract repeated logic into functions/modules
- **KISS** (Keep It Simple): Prefer simple solutions over clever ones
- **YAGNI** (You Aren't Gonna Need It): Don't build features "just in case"

## Code Organization

### File Structure Patterns

```
src/
├── index.{ext}           # Entry point
├── config/               # Configuration loading
├── types/                # Type definitions
├── utils/                # Pure utility functions
├── services/             # Business logic
├── repositories/         # Data access layer
├── controllers/          # Request handlers (if applicable)
├── middleware/           # Cross-cutting concerns
└── tests/                # Test files (or alongside source)
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case or snake_case | `user-service.ts`, `user_service.py` |
| Classes | PascalCase | `UserService`, `AuthController` |
| Functions | camelCase or snake_case | `getUser()`, `get_user()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| Private members | Prefix with `_` | `_internalState`, `_validateInput()` |

### Module Boundaries

1. **Public API**: Export only what's needed by other modules
2. **Internal implementation**: Keep helpers private to the module
3. **Dependencies**: Import from well-defined module entry points

## Error Handling

### Error Categories

| Category | HTTP Code | When to Use |
|----------|-----------|-------------|
| Validation Error | 400 | Invalid input from user |
| Authentication Error | 401 | Missing or invalid credentials |
| Authorization Error | 403 | Valid user, insufficient permissions |
| Not Found | 404 | Resource doesn't exist |
| Conflict | 409 | Resource state conflict (duplicate, etc.) |
| Internal Error | 500 | Unexpected server error |

### Error Handling Pattern

```
try {
  // Operation that may fail
  result = performOperation()
  return success(result)
} catch (error) {
  if (isExpectedError(error)) {
    // Handle gracefully - return user-friendly message
    return failure(userFriendlyMessage(error))
  }
  // Unexpected error - log and return generic message
  log.error("Unexpected error", { error, context })
  return failure("An unexpected error occurred")
}
```

### Error Best Practices

1. **Never expose internal details** - Stack traces, SQL queries, file paths
2. **Log unexpected errors** - Include context for debugging
3. **Fail fast** - Validate inputs at boundaries
4. **Use typed errors** - Create error classes/types for different failure modes
5. **Provide actionable messages** - Tell users what they can do to fix the issue

## Input Validation

### Validation Rules

```
// Always validate at system boundaries:
1. API endpoints - validate request body, query params, path params
2. Form submissions - validate before processing
3. External data - never trust data from external sources
4. Configuration - validate at startup

// Validation order:
1. Required fields present?
2. Correct types?
3. Within allowed ranges/lengths?
4. Matches expected format (email, URL, etc.)?
5. Business rule validation
```

### Sanitization

- **Escape output** - Prevent XSS when rendering user data
- **Parameterize queries** - Never concatenate user input into queries
- **Whitelist allowed values** - For enums, use explicit allowed lists
- **Trim and normalize** - Remove leading/trailing whitespace, normalize unicode

## Testing Patterns

### Test Pyramid

```
        /\
       /  \  E2E Tests (few)
      /----\  
     /      \ Integration Tests (some)
    /--------\
   /          \ Unit Tests (many)
  --------------
```

### Test Organization

```
// Unit test structure (Arrange-Act-Assert)
test("should return user when valid ID provided", () => {
  // Arrange
  const userId = "123"
  const expectedUser = { id: "123", name: "Test" }
  mockRepository.findById.returns(expectedUser)
  
  // Act
  const result = userService.getUser(userId)
  
  // Assert
  expect(result).toEqual(expectedUser)
})
```

### What to Test

| Test Type | Focus | Examples |
|-----------|-------|----------|
| Unit | Single function/class in isolation | `calculateTotal()`, `validateEmail()` |
| Integration | Multiple components working together | Service + Database, API + Auth |
| E2E | Full user flows | Login flow, checkout process |

### Test Best Practices

1. **Test behavior, not implementation** - Tests should survive refactoring
2. **One assertion focus per test** - Test one thing at a time
3. **Use descriptive test names** - `should_returnError_when_userNotFound`
4. **Avoid test interdependence** - Each test should be independent
5. **Mock external dependencies** - Network calls, databases, time

## Security Fundamentals

### Authentication & Authorization

```
// Authentication: Who are you?
1. Verify credentials (password, token, certificate)
2. Issue session/token upon success
3. Include identity in subsequent requests

// Authorization: What can you do?
1. Check permissions before every protected action
2. Use principle of least privilege
3. Deny by default, allow explicitly
```

### Security Checklist

- [ ] **Secrets management**: Environment variables, never hardcoded
- [ ] **Input validation**: Validate and sanitize all inputs
- [ ] **Output encoding**: Escape output to prevent XSS
- [ ] **Parameterized queries**: Prevent SQL injection
- [ ] **Authentication required**: Protect sensitive endpoints
- [ ] **Authorization checked**: Verify permissions for each action
- [ ] **HTTPS only**: Encrypt data in transit
- [ ] **Sensitive data handling**: Don't log passwords, tokens, PII
- [ ] **Rate limiting**: Prevent abuse and brute force
- [ ] **Error messages**: Don't reveal internal details

## Performance Considerations

### Common Optimizations

| Issue | Solution |
|-------|----------|
| N+1 queries | Use eager loading / batch queries |
| Large payloads | Pagination, field selection |
| Slow operations | Caching, background jobs |
| Memory leaks | Clean up resources, limit growth |

### Performance Best Practices

1. **Measure first** - Don't optimize without profiling
2. **Cache appropriately** - Cache expensive, rarely-changing data
3. **Batch operations** - Combine multiple small operations
4. **Use indexes** - On frequently queried fields
5. **Set timeouts** - On all external calls

## Documentation

### Code Documentation

```
// Document the "why", not the "what"

// Bad: Increment counter by 1
counter++

// Good: Track retry attempts to enforce max retry limit
retryCount++
```

### What to Document

1. **Public APIs** - Parameters, return values, errors
2. **Complex algorithms** - Explain the approach
3. **Non-obvious decisions** - Why this solution over alternatives
4. **Configuration options** - What each setting does
5. **Dependencies** - What's required and why

## Anti-Patterns to Avoid

### Code Smells

| Smell | Problem | Solution |
|-------|---------|----------|
| God class/file | Too many responsibilities | Split by concern |
| Deep nesting | Hard to read/maintain | Early returns, extract functions |
| Magic numbers | Unclear meaning | Named constants |
| Copy-paste code | DRY violation | Extract shared function |
| Long parameter lists | Hard to use correctly | Use objects/builders |

### Architecture Smells

- **Circular dependencies** - Modules depending on each other
- **Leaky abstractions** - Implementation details exposed
- **Shotgun surgery** - One change requires many file edits
- **Feature envy** - Code using another module's data excessively

## When to Escalate

**Request specific tech stack skills when**:

1. Framework-specific patterns are needed (routing, ORM, etc.)
2. Language idioms are unclear (Rust ownership, Go channels, etc.)
3. Build/deployment configuration is required
4. Performance optimization needs framework-specific knowledge
5. Security requires framework-specific hardening

**Flag in your output**:
```markdown
## Skill Escalation Needed

**Reason**: [Why generic patterns are insufficient]
**Recommended Skills**: [e.g., "nextjs-dev", "python-fastapi"]
**Blocking**: [Yes/No - can work continue without specific skills?]
```

## Summary

This skill provides foundational patterns that apply universally. When implementing:

1. **Structure code** using layered architecture
2. **Handle errors** gracefully with proper logging
3. **Validate inputs** at system boundaries
4. **Write tests** following the test pyramid
5. **Secure the application** using the security checklist
6. **Document decisions** not obvious from code
7. **Avoid anti-patterns** that lead to technical debt

If the task requires framework-specific patterns, request appropriate skills from the orchestrator.
