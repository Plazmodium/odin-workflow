# Specification: [FEATURE-ID] [Feature Name]

**Template Type**: API Feature
**Complexity Level**: [1/2/3]
**Status**: draft

---

## 1. Context & Goals

**Problem Statement**: [What problem does this API solve?]

**User Stories**:
- As a [role], I want to [action] so that [benefit]

**Success Metrics**: [How do we measure success?]

---

## 2. API Design

### Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST   | /api/v1/... | Create resource | Yes |
| GET    | /api/v1/... | Get resource | Yes |

### Request/Response Models

```json
// POST /api/v1/resource — Request
{
  "field": "type — description"
}

// POST /api/v1/resource — Response (201)
{
  "id": "string — UUID",
  "field": "type",
  "created_at": "string — ISO 8601"
}

// Error Response (4xx/5xx)
{
  "error": "string — error code",
  "message": "string — human-readable message",
  "details": {}
}
```

### Authentication & Authorization

- **Auth method**: [JWT / API Key / OAuth2]
- **Required roles**: [admin / member / public]
- **Rate limiting**: [requests per minute]

---

## 3. Behavioral Requirements

### Happy Path Scenarios

1. **[Scenario Name]**: [Description of expected behavior]
   - Given: [preconditions]
   - When: [action]
   - Then: [expected result]

### Error Scenarios

1. **Invalid input**: Returns 400 with validation details
2. **Unauthorized**: Returns 401 with generic message (no info leakage)
3. **Not found**: Returns 404
4. **Conflict**: Returns 409 (e.g., duplicate resource)

### Edge Cases

- [Empty input handling]
- [Concurrent requests]
- [Large payloads]

---

## 4. Acceptance Criteria

- [ ] All endpoints return correct status codes
- [ ] Request validation rejects invalid input with clear errors
- [ ] Authentication enforced on all protected endpoints
- [ ] Response shapes match documented models
- [ ] Rate limiting enforced
- [ ] [Additional criteria]

---

## 5. Technical Implementation

### Required Skills

| Skill | Category | Why Needed |
|-------|----------|------------|
| [skill] | [category] | [reason] |

### Database Changes

```sql
-- Migrations needed (if any)
```

### Performance Requirements

| Metric | Target |
|--------|--------|
| Response time (p95) | < [X]ms |
| Throughput | [X] req/sec |
| Payload size limit | [X] KB |

### Dependencies

- [External service or API dependency]
- [Internal service dependency]

---

## 6. Security Considerations

- [ ] Input validation on all fields
- [ ] Parameterized queries (no SQL injection)
- [ ] No sensitive data in responses (PII, passwords)
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Audit logging for sensitive operations
