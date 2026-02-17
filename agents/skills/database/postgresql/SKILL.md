---
name: postgresql
description: PostgreSQL database best practices, query patterns, indexing, and performance optimization
category: database
version: "15+"
compatible_with:
  - prisma-orm
  - supabase
  - nodejs-express
  - nodejs-fastify
  - python-fastapi
  - python-django
---

# PostgreSQL

## Overview

PostgreSQL is an advanced open-source relational database. This skill covers schema design, query patterns, indexing, and performance for application developers.

## Schema Design

### Tables

```sql
-- Always use explicit types and constraints
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Use enums for fixed value sets
CREATE TYPE user_role AS ENUM ('admin', 'member', 'viewer');
ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'member';

-- Junction table for many-to-many
CREATE TABLE user_organizations (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, org_id)
);
```

### Indexes

```sql
-- B-tree (default) for equality and range queries
CREATE INDEX idx_users_email ON users(email);

-- Partial index for common filtered queries
CREATE INDEX idx_active_users ON users(created_at) WHERE is_active = true;

-- GIN for JSONB and full-text search
CREATE INDEX idx_metadata ON products USING GIN(metadata);
CREATE INDEX idx_search ON articles USING GIN(to_tsvector('english', title || ' ' || body));

-- Composite for multi-column queries (leftmost prefix rule)
CREATE INDEX idx_org_role ON user_organizations(org_id, role);
```

## Query Patterns

### Common Patterns

```sql
-- Upsert (INSERT ... ON CONFLICT)
INSERT INTO users (email, name) VALUES ($1, $2)
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
RETURNING *;

-- Pagination with cursor (better than OFFSET for large tables)
SELECT * FROM users
WHERE created_at < $1  -- cursor: last item's created_at
ORDER BY created_at DESC
LIMIT 20;

-- CTE for complex queries
WITH active_users AS (
    SELECT * FROM users WHERE last_login > now() - interval '30 days'
)
SELECT org_id, count(*) as active_count
FROM user_organizations uo
JOIN active_users au ON uo.user_id = au.id
GROUP BY org_id;
```

### JSONB

```sql
-- Query JSONB fields
SELECT * FROM products WHERE metadata->>'category' = 'electronics';
SELECT * FROM products WHERE metadata @> '{"tags": ["sale"]}';

-- Update JSONB
UPDATE products SET metadata = metadata || '{"featured": true}' WHERE id = $1;
```

## Best Practices

1. **Use UUID primary keys** for distributed-friendly IDs (`gen_random_uuid()`)
2. **Always `TIMESTAMPTZ`** — never `TIMESTAMP` without timezone
3. **Parameterized queries** — never interpolate user input into SQL
4. **Foreign keys with ON DELETE** — explicit cascade/restrict/set null behavior
5. **`EXPLAIN ANALYZE`** — profile queries before optimizing; check seq scans
6. **Connection pooling** — use PgBouncer or built-in pool (Supabase provides this)
7. **Migrations** — use a migration tool (Alembic, Prisma, Flyway); never manual DDL in production

## Gotchas

- **NULL semantics** — `NULL != NULL`, use `IS NOT DISTINCT FROM` for nullable comparisons
- **OFFSET performance** — degrades linearly with page number; use cursor-based pagination
- **Lock contention** — long-running transactions block writes; keep transactions short
- **Index bloat** — `REINDEX` or `pg_repack` for heavily updated tables
- **Text search** — `LIKE '%term%'` can't use B-tree indexes; use GIN + `tsvector` for full-text
