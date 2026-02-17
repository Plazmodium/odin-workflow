---
name: rest-api
description: REST API design and implementation expertise. Covers HTTP methods, status codes, resource naming, versioning, authentication, and OpenAPI documentation.
category: api
compatible_with:
  - nodejs-express
  - nodejs-fastify
  - python-fastapi
  - golang-gin
---

# REST API Design

## Instructions

1. **Assess the API need**: CRUD operations, complex queries, or real-time data.
2. **Follow REST conventions**:
   - Use nouns for resources, not verbs
   - Proper HTTP methods and status codes
   - Consistent naming conventions
   - HATEOAS where appropriate
3. **Provide complete examples**: Include routes, handlers, and response schemas.
4. **Guide on best practices**: Versioning, pagination, filtering, error handling.

## HTTP Methods

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| GET | Retrieve resource(s) | Yes | Yes |
| POST | Create resource | No | No |
| PUT | Replace resource | Yes | No |
| PATCH | Partial update | No | No |
| DELETE | Remove resource | Yes | No |

## Resource Naming

```
# Good - Nouns, plural
GET    /users
GET    /users/:id
POST   /users
PUT    /users/:id
PATCH  /users/:id
DELETE /users/:id

# Nested resources
GET    /users/:userId/posts
GET    /users/:userId/posts/:postId
POST   /users/:userId/posts

# Bad - Verbs, actions in URL
GET    /getUsers
POST   /createUser
GET    /getUserById/:id
```

## Status Codes

### Success (2xx)

```javascript
// 200 OK - Successful GET, PUT, PATCH
res.status(200).json({ data: user });

// 201 Created - Successful POST
res.status(201).json({ data: newUser });

// 204 No Content - Successful DELETE
res.status(204).send();
```

### Client Errors (4xx)

```javascript
// 400 Bad Request - Invalid input
res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request body',
    details: [
      { field: 'email', message: 'Must be a valid email' }
    ]
  }
});

// 401 Unauthorized - Not authenticated
res.status(401).json({
  error: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
  }
});

// 403 Forbidden - Authenticated but not authorized
res.status(403).json({
  error: {
    code: 'FORBIDDEN',
    message: 'You do not have permission to access this resource'
  }
});

// 404 Not Found
res.status(404).json({
  error: {
    code: 'NOT_FOUND',
    message: 'User not found'
  }
});

// 409 Conflict - Resource already exists
res.status(409).json({
  error: {
    code: 'CONFLICT',
    message: 'Email already registered'
  }
});

// 422 Unprocessable Entity - Semantic errors
res.status(422).json({
  error: {
    code: 'UNPROCESSABLE_ENTITY',
    message: 'Cannot delete user with active subscriptions'
  }
});

// 429 Too Many Requests - Rate limiting
res.status(429).json({
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    retryAfter: 60
  }
});
```

### Server Errors (5xx)

```javascript
// 500 Internal Server Error
res.status(500).json({
  error: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  }
});

// 503 Service Unavailable
res.status(503).json({
  error: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service temporarily unavailable',
    retryAfter: 300
  }
});
```

## Response Structure

### Single Resource

```json
{
  "data": {
    "id": "123",
    "type": "user",
    "attributes": {
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Collection

```json
{
  "data": [
    { "id": "1", "name": "Item 1" },
    { "id": "2", "name": "Item 2" }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  },
  "links": {
    "self": "/items?page=1",
    "first": "/items?page=1",
    "prev": null,
    "next": "/items?page=2",
    "last": "/items?page=5"
  }
}
```

## Pagination

### Offset-based

```
GET /users?page=2&limit=20
GET /users?offset=20&limit=20
```

### Cursor-based (recommended for large datasets)

```
GET /users?cursor=eyJpZCI6MTAwfQ&limit=20

Response:
{
  "data": [...],
  "meta": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTIwfQ"
  }
}
```

## Filtering & Sorting

```
# Filtering
GET /users?status=active
GET /users?role=admin&status=active
GET /users?createdAt[gte]=2024-01-01
GET /users?search=john

# Sorting
GET /users?sort=createdAt
GET /users?sort=-createdAt         # Descending
GET /users?sort=lastName,firstName # Multiple fields

# Field selection
GET /users?fields=id,email,name
GET /users?include=posts,comments  # Relations
```

## Versioning

### URL Path (recommended)

```
GET /api/v1/users
GET /api/v2/users
```

### Header-based

```
GET /api/users
Accept: application/vnd.myapi.v2+json
```

### Query Parameter

```
GET /api/users?version=2
```

## Authentication

### Bearer Token (JWT)

```javascript
// Request
GET /api/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

// Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: { message: 'Token required' } });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
};
```

### API Key

```javascript
// Request
GET /api/users
X-API-Key: sk_live_abc123

// Middleware
const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: { message: 'API key required' } });
  }

  const client = await db.apiKeys.findOne({ key: apiKey, active: true });
  if (!client) {
    return res.status(401).json({ error: { message: 'Invalid API key' } });
  }

  req.client = client;
  next();
};
```

## Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
      }
    });
  }
});

app.use('/api/', limiter);
```

## OpenAPI/Swagger

```yaml
openapi: 3.0.3
info:
  title: My API
  version: 1.0.0

paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
    post:
      summary: Create user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserInput'
      responses:
        '201':
          description: User created

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        email:
          type: string
          format: email
        name:
          type: string
        createdAt:
          type: string
          format: date-time
    CreateUserInput:
      type: object
      required:
        - email
        - name
      properties:
        email:
          type: string
          format: email
        name:
          type: string
```

## Best Practices

- **Use HTTPS** - Always encrypt in transit
- **Validate input** - Never trust client data
- **Return consistent responses** - Same structure for success/error
- **Use proper status codes** - Don't use 200 for everything
- **Version your API** - Plan for breaking changes
- **Document thoroughly** - OpenAPI/Swagger
- **Implement rate limiting** - Protect against abuse
- **Log requests** - For debugging and auditing
- **Use ETags** - For caching and conditional requests
- **CORS** - Configure properly for web clients

## Error Handling Pattern

```javascript
class APIError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Usage
throw new APIError('VALIDATION_ERROR', 'Invalid email', 400, [
  { field: 'email', message: 'Must be valid email format' }
]);

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof APIError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});
```

## References

- REST API Design: https://restfulapi.net/
- HTTP Status Codes: https://httpstatuses.com/
- OpenAPI Specification: https://swagger.io/specification/
