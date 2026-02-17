---
name: prisma-orm
description: Prisma ORM expertise for type-safe database access, schema design, migrations, and query optimization
category: database
version: "5.x"
depends_on:
  - postgresql
compatible_with:
  - mysql
  - nodejs-express
  - nextjs-dev
  - typescript
---

# Prisma ORM Development

## Overview

Prisma is a next-generation ORM for Node.js and TypeScript that provides type-safe database access, automated migrations, and an intuitive data modeling language.

## Project Structure

```
prisma/
├── schema.prisma         # Database schema
├── migrations/           # Migration history
│   └── 20240115_init/
│       └── migration.sql
└── seed.ts               # Database seeding

src/
├── lib/
│   └── prisma.ts         # Prisma client singleton
└── services/
    └── user.service.ts   # Using Prisma client
```

## Schema Design

### Basic Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  password  String
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}

model Post {
  id          String   @id @default(uuid())
  title       String
  content     String?
  published   Boolean  @default(false)
  author      User     @relation(fields: [authorId], references: [id])
  authorId    String   @map("author_id")
  categories  Category[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([authorId])
  @@map("posts")
}

model Profile {
  id     String @id @default(uuid())
  bio    String?
  avatar String?
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String @unique @map("user_id")

  @@map("profiles")
}

model Category {
  id    String @id @default(uuid())
  name  String @unique
  posts Post[]

  @@map("categories")
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

## Prisma Client Setup

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

## Common Query Patterns

### CRUD Operations

```typescript
import prisma from '@/lib/prisma';

// Create
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
    password: hashedPassword,
  },
});

// Read (single)
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Read (with relations)
const userWithPosts = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    posts: true,
    profile: true,
  },
});

// Read (many with filtering)
const users = await prisma.user.findMany({
  where: {
    email: { contains: '@company.com' },
    role: 'USER',
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 0,
});

// Update
const updated = await prisma.user.update({
  where: { id: userId },
  data: { name: 'Jane Doe' },
});

// Delete
await prisma.user.delete({
  where: { id: userId },
});
```

### Select Specific Fields

```typescript
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
    // password intentionally excluded
  },
});
```

### Nested Writes

```typescript
// Create user with profile
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John',
    password: hash,
    profile: {
      create: {
        bio: 'Developer',
      },
    },
  },
  include: { profile: true },
});

// Create post with categories
const post = await prisma.post.create({
  data: {
    title: 'My Post',
    content: 'Content...',
    authorId: userId,
    categories: {
      connectOrCreate: [
        {
          where: { name: 'Tech' },
          create: { name: 'Tech' },
        },
      ],
    },
  },
});
```

### Transactions

```typescript
// Sequential transaction
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.post.create({ data: postData }),
]);

// Interactive transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });

  if (someCondition) {
    throw new Error('Rollback!');
  }

  const post = await tx.post.create({
    data: { ...postData, authorId: user.id },
  });

  return { user, post };
});
```

### Aggregations

```typescript
// Count
const count = await prisma.user.count({
  where: { role: 'USER' },
});

// Group by
const postsByUser = await prisma.post.groupBy({
  by: ['authorId'],
  _count: { id: true },
  orderBy: { _count: { id: 'desc' } },
});

// Aggregate
const stats = await prisma.post.aggregate({
  _count: true,
  _avg: { views: true },
  _max: { views: true },
});
```

## Migrations

```bash
# Create migration
npx prisma migrate dev --name add_user_role

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only!)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate
```

## Best Practices

1. **Use singleton pattern** - Prevent connection pool exhaustion
2. **Select only needed fields** - Reduce data transfer
3. **Use transactions for related writes** - Ensure data consistency
4. **Add indexes for query fields** - `@@index([fieldName])`
5. **Use `@map` for snake_case** - Keep DB conventions, use camelCase in code
6. **Archive instead of delete** - Add `isArchived Boolean @default(false)` and `archivedAt DateTime?` for recoverable records. "Soft delete" is a misnomer - use archive terminology to match real-world concepts
7. **Always include `updatedAt`** - Use `@updatedAt` for automatic tracking

## Gotchas & Pitfalls

- **N+1 queries** - Use `include` or `select` with relations, not separate queries
- **Connection limits** - Use singleton pattern, especially in serverless
- **Migration conflicts** - Don't edit existing migrations, create new ones
- **Type mismatches** - Run `prisma generate` after schema changes
- **Forgetting indexes** - Add `@@index` for frequently queried fields
- **BigInt serialization** - JSON.stringify doesn't handle BigInt, convert to string

## Integration with Next.js

```typescript
// app/api/users/route.ts
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });
  return NextResponse.json(users);
}
```

## Seeding

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      password: 'hashed_password',
      role: 'ADMIN',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

```json
// package.json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```
