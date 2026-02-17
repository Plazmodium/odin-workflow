# Specification: [FEATURE-ID] [Feature Name]

**Template Type**: Data / Migration Feature
**Complexity Level**: [1/2/3]
**Status**: draft

---

## 1. Context & Goals

**Problem Statement**: [What data problem does this solve?]

**Motivation**: [Why is this migration/schema change needed?]

**Success Metrics**: [Query performance targets, data integrity checks]

---

## 2. Schema Changes

### New Tables

```sql
CREATE TABLE [table_name] (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- columns
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Modified Tables

```sql
-- Add columns
ALTER TABLE [table_name] ADD COLUMN [column] [type] [constraints];

-- Modify columns
ALTER TABLE [table_name] ALTER COLUMN [column] SET NOT NULL;
```

### Indexes

```sql
-- Justify each index with the query it supports
CREATE INDEX idx_[name] ON [table]([columns]);
-- Supports: SELECT ... WHERE [column] = ? ORDER BY ...
```

### Foreign Keys & Constraints

```sql
ALTER TABLE [child] ADD CONSTRAINT fk_[name]
    FOREIGN KEY ([column]) REFERENCES [parent]([column])
    ON DELETE [CASCADE/RESTRICT/SET NULL];
```

---

## 3. Data Migration

### Migration Strategy

- **Approach**: [Online / Offline / Blue-green]
- **Estimated duration**: [Time estimate]
- **Rollback plan**: [How to reverse if needed]

### Migration Steps

1. [Step 1 — e.g., create new table]
2. [Step 2 — e.g., backfill data]
3. [Step 3 — e.g., add constraints]
4. [Step 4 — e.g., drop old columns]

### Data Transformation

```sql
-- Backfill script (if needed)
INSERT INTO new_table (col1, col2)
SELECT old_col1, transform(old_col2) FROM old_table;
```

---

## 4. Query Patterns

### Read Queries

```sql
-- [Query name]: [Description]
-- Expected frequency: [X/sec]
-- Expected rows: [count]
EXPLAIN ANALYZE
SELECT ... FROM ... WHERE ...;
```

### Write Queries

```sql
-- [Query name]: [Description]
INSERT INTO ... VALUES ...
ON CONFLICT ... DO UPDATE ...;
```

---

## 5. Acceptance Criteria

- [ ] Migration runs without data loss
- [ ] Migration is reversible (rollback tested)
- [ ] All foreign keys and constraints enforced
- [ ] Indexes support primary query patterns
- [ ] Query performance meets targets (EXPLAIN ANALYZE verified)
- [ ] No breaking changes to existing queries
- [ ] [Additional criteria]

---

## 6. Performance & Integrity

### Performance Targets

| Query | Target p95 | Current (if applicable) |
|-------|-----------|------------------------|
| [Query name] | < [X]ms | [Current] |

### Data Integrity

- [ ] NOT NULL on required fields
- [ ] UNIQUE constraints where needed
- [ ] Foreign keys prevent orphaned records
- [ ] CHECK constraints for valid ranges/enums
- [ ] Default values for new columns (backward compatible)

### Capacity Planning

- **Current row count**: [estimate]
- **Growth rate**: [rows/day]
- **Storage impact**: [estimated size increase]

---

## 7. Security

- [ ] No PII stored unencrypted
- [ ] Row-level security (RLS) configured if applicable
- [ ] Migration scripts use parameterized queries
- [ ] Audit columns present (created_at, updated_at, created_by)
