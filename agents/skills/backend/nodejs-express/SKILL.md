---
name: nodejs-express
description: Node.js with Express.js framework expertise for building REST APIs, middleware patterns, and server-side applications
category: backend
version: "4.x"
compatible_with:
  - postgresql
  - prisma-orm
  - supabase
  - jest
  - typescript
---

# Node.js + Express Development

## Overview

Express.js is a minimal, flexible Node.js web application framework providing robust features for building web and mobile applications.

## Project Structure

```
src/
├── index.ts              # Entry point
├── app.ts                # Express app setup
├── routes/
│   ├── index.ts          # Route aggregator
│   ├── auth.routes.ts    # Auth endpoints
│   └── user.routes.ts    # User endpoints
├── controllers/
│   ├── auth.controller.ts
│   └── user.controller.ts
├── services/
│   ├── auth.service.ts
│   └── user.service.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   └── validation.middleware.ts
├── models/               # Database models
├── utils/
│   └── asyncHandler.ts   # Async error wrapper
└── types/
    └── index.ts          # TypeScript types
```

## Core Patterns

### App Setup

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error.middleware';
import routes from './routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', routes);

// Error handling (must be last)
app.use(errorHandler);

export default app;
```

### Async Handler Pattern

```typescript
// src/utils/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

type AsyncFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### Controller Pattern

```typescript
// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as userService from '../services/user.service';

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await userService.findAll();
  res.json({ success: true, data: users });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findById(req.params.id);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({ success: true, data: user });
});
```

### Route Definition

```typescript
// src/routes/user.routes.ts
import { Router } from 'express';
import { getUsers, getUserById, createUser } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createUserSchema } from '../validators/user.validator';

const router = Router();

router.get('/', authenticate, getUsers);
router.get('/:id', authenticate, getUserById);
router.post('/', authenticate, validate(createUserSchema), createUser);

export default router;
```

### Error Handling Middleware

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};
```

### Auth Middleware

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
    };
    req.user = decoded;
    next();
  } catch {
    throw new AppError(401, 'Invalid token');
  }
};
```

## Best Practices

1. **Always use asyncHandler** - Prevents unhandled promise rejections
2. **Validate input** - Use Zod or Joi for request validation
3. **Layer your code** - Routes → Controllers → Services → Models
4. **Use TypeScript** - Type safety prevents runtime errors
5. **Environment variables** - Never hardcode secrets
6. **Error middleware last** - Must be registered after routes
7. **Use HTTP status codes correctly** - 200, 201, 400, 401, 403, 404, 500

## Common Response Format

```typescript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Error message" }

// Paginated
{
  success: true,
  data: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5
  }
}
```

## Gotchas & Pitfalls

- **Forgetting async error handling** - Always use asyncHandler or try-catch
- **Middleware order matters** - Auth before routes, error handler last
- **Not ending response** - Always call res.json(), res.send(), or next()
- **Memory leaks** - Clean up listeners, close DB connections on shutdown
- **CORS issues** - Configure cors() properly for your frontend domain

## Integration Notes

### With Prisma
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// In service
export const findAll = () => prisma.user.findMany();
```

### With Supabase
```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// In service
export const findAll = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw new AppError(500, error.message);
  return data;
};
```
