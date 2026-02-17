---
name: clean-architecture
description: Clean Architecture principles — dependency inversion, use cases, and layer separation
category: architecture
version: "1.0"
compatible_with:
  - nodejs-express
  - nodejs-fastify
  - python-fastapi
  - python-django
  - golang-gin
---

# Clean Architecture

## Overview

Clean Architecture separates code into concentric layers with the Dependency Rule: source code dependencies always point inward. Business logic never depends on frameworks, databases, or UI.

## Layer Structure

```
src/
├── domain/                  # Innermost — entities + business rules
│   ├── entities/
│   │   └── User.ts
│   └── value-objects/
│       └── Email.ts
├── application/             # Use cases — orchestrate domain logic
│   ├── use-cases/
│   │   ├── CreateUser.ts
│   │   └── GetUserById.ts
│   └── ports/               # Interfaces (driven/driving)
│       ├── UserRepository.ts
│       └── EmailService.ts
├── infrastructure/          # Outermost — frameworks, DB, external APIs
│   ├── persistence/
│   │   └── PgUserRepository.ts
│   ├── services/
│   │   └── SendGridEmailService.ts
│   └── web/
│       ├── routes.ts
│       └── controllers/
│           └── UserController.ts
└── main.ts                  # Composition root — wires everything together
```

## Core Patterns

### Entity (Domain Layer)

```typescript
// Pure business logic — no framework imports
export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    public name: string,
    private passwordHash: string,
  ) {}

  changeName(newName: string): void {
    if (newName.length < 2) throw new DomainError('Name too short');
    this.name = newName;
  }

  verifyPassword(plaintext: string): boolean {
    return hashCompare(plaintext, this.passwordHash);
  }
}
```

### Use Case (Application Layer)

```typescript
// Depends only on ports (interfaces), not implementations
export class CreateUser {
  constructor(
    private userRepo: UserRepository,
    private emailService: EmailService,
  ) {}

  async execute(input: { email: string; name: string; password: string }): Promise<User> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new ConflictError('Email already registered');

    const user = User.create(input);
    await this.userRepo.save(user);
    await this.emailService.sendWelcome(user.email);
    return user;
  }
}
```

### Port (Interface)

```typescript
// Defined in application layer — implemented in infrastructure
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

### Adapter (Infrastructure Layer)

```typescript
// Implements the port — depends on the interface, not the other way
export class PgUserRepository implements UserRepository {
  constructor(private db: Pool) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return row.rows[0] ? this.toDomain(row.rows[0]) : null;
  }

  async save(user: User): Promise<void> {
    await this.db.query(
      'INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
      [user.id, user.email.value, user.name, user.passwordHash],
    );
  }
}
```

## Best Practices

1. **Dependency Rule** — inner layers never import from outer layers
2. **Composition Root** — wire dependencies in `main.ts`, not inside classes
3. **Use Case = 1 operation** — each use case does one thing
4. **Domain has no dependencies** — no ORM decorators, no framework types
5. **Test use cases** with mock ports — fast, no DB needed
6. **Value Objects** for validated primitives (Email, Money, UserId)

## Gotchas

- **Over-engineering** — don't add layers for trivial CRUD; use clean architecture for complex domains
- **Mapping fatigue** — converting between layers (DB row → domain entity → DTO) adds boilerplate
- **Framework leakage** — ORM decorators on domain entities break the dependency rule
- **Where does validation go?** — input validation at the boundary, business rules in the domain
