---
name: nodejs-fastify
description: Fastify framework for building high-performance Node.js APIs with schema-based validation
category: backend
version: "4.x"
compatible_with:
  - postgresql
  - prisma-orm
  - mongodb
  - redis
  - rest-api
  - typescript
---

# Node.js + Fastify

## Overview

Fastify is a high-performance Node.js web framework focused on developer experience and low overhead. It uses JSON Schema for request/response validation and serialization.

## Project Structure

```
src/
├── app.ts                   # Fastify instance + plugin registration
├── server.ts                # Entry point (start server)
├── plugins/
│   ├── auth.ts              # Auth decorator/plugin
│   └── database.ts          # DB connection plugin
├── routes/
│   ├── auth/
│   │   ├── index.ts         # Route registration
│   │   └── schema.ts        # JSON schemas
│   └── users/
│       ├── index.ts
│       └── schema.ts
├── services/
│   └── user.service.ts      # Business logic
├── types/
│   └── index.ts             # TypeScript types
└── tests/
    └── routes/
        └── auth.test.ts
```

## Core Patterns

### App Setup

```typescript
import Fastify from 'fastify';

const app = Fastify({
  logger: true,
  ajv: { customOptions: { removeAdditional: 'all' } },
});

// Register plugins
await app.register(import('./plugins/database'));
await app.register(import('./plugins/auth'));

// Register routes
await app.register(import('./routes/auth'), { prefix: '/auth' });
await app.register(import('./routes/users'), { prefix: '/users' });

export default app;
```

### Routes with Schema Validation

```typescript
import { FastifyPluginAsync } from 'fastify';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = await fastify.userService.getById(id);
      if (!user) return reply.code(404).send({ error: 'Not found' });
      return user;
    },
  });
};

export default userRoutes;
```

### Plugins (Decorators)

```typescript
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  const db = await connectToDatabase(fastify.config.DATABASE_URL);

  fastify.decorate('db', db);
  fastify.addHook('onClose', async () => { await db.close(); });
});

// Type augmentation
declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}
```

### Error Handling

```typescript
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.validation) {
    return reply.code(400).send({ error: 'Validation failed', details: error.validation });
  }

  reply.code(error.statusCode ?? 500).send({
    error: error.message || 'Internal Server Error',
  });
});
```

## Best Practices

1. **Schema-first** — define JSON Schema for all request/response; Fastify uses it for validation AND serialization (faster than manual serialization)
2. **Encapsulation** — use plugins for encapsulated contexts; `fastify-plugin` for shared decorators
3. **Type augmentation** — extend `FastifyInstance`/`FastifyRequest` for decorators
4. **Autoload** — use `@fastify/autoload` to auto-register routes and plugins
5. **Testing** — use `app.inject()` for integration tests (no real HTTP needed)
6. **Hooks** — prefer `onRequest`/`preHandler` hooks over middleware for auth

## Gotchas

- **Plugin encapsulation** — decorators are scoped to the plugin unless wrapped with `fastify-plugin`
- **Schema serialization** — response schemas strip undeclared properties (security feature, but surprising)
- **Async/await** — always return or `await`; unhandled promise rejections crash the server
- **Decorator timing** — decorators must be registered before routes that use them
