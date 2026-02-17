---
name: golang-gin
description: Gin HTTP web framework for building high-performance Go APIs
category: backend
version: "1.9+"
compatible_with:
  - postgresql
  - mongodb
  - redis
  - rest-api
  - grpc
---

# Go + Gin

## Overview

Gin is a high-performance HTTP web framework for Go. It provides routing, middleware, JSON validation, and rendering with minimal overhead.

## Project Structure

```
cmd/
├── server/
│   └── main.go              # Entry point
internal/
├── config/
│   └── config.go            # Configuration loading
├── handler/
│   ├── auth.go              # Auth handlers
│   └── user.go              # User handlers
├── middleware/
│   ├── auth.go              # JWT middleware
│   └── cors.go              # CORS middleware
├── model/
│   └── user.go              # Domain models + DB structs
├── repository/
│   └── user_repo.go         # Database access
├── service/
│   └── user_service.go      # Business logic
└── router/
    └── router.go            # Route registration
```

## Core Patterns

### Router Setup

```go
func SetupRouter(userHandler *handler.UserHandler, authMW gin.HandlerFunc) *gin.Engine {
    r := gin.Default()

    r.Use(middleware.CORS())

    api := r.Group("/api/v1")
    {
        auth := api.Group("/auth")
        auth.POST("/login", userHandler.Login)
        auth.POST("/register", userHandler.Register)

        users := api.Group("/users")
        users.Use(authMW)
        users.GET("/:id", userHandler.GetByID)
        users.PUT("/:id", userHandler.Update)
    }

    return r
}
```

### Handlers

```go
type UserHandler struct {
    service service.UserService
}

func (h *UserHandler) GetByID(c *gin.Context) {
    id := c.Param("id")
    user, err := h.service.GetByID(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
        return
    }
    c.JSON(http.StatusOK, user)
}

// Request binding with validation
type CreateUserRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Password string `json:"password" binding:"required,min=8"`
    Name     string `json:"name" binding:"required,max=100"`
}

func (h *UserHandler) Register(c *gin.Context) {
    var req CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    // ... create user
}
```

### Middleware

```go
func AuthMiddleware(secret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
            return
        }
        claims, err := validateJWT(strings.TrimPrefix(token, "Bearer "), secret)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
            return
        }
        c.Set("userID", claims.Subject)
        c.Next()
    }
}
```

## Best Practices

1. **Use `internal/`** — prevents external packages from importing your business logic
2. **Dependency injection** — pass dependencies via struct constructors, not globals
3. **Context propagation** — always pass `c.Request.Context()` to service/repo layers
4. **Graceful shutdown** — use `signal.NotifyContext` for clean shutdown
5. **Error wrapping** — use `fmt.Errorf("...: %w", err)` for error chains
6. **Structured logging** — use `slog` (Go 1.21+) or `zerolog`
7. **Interface-based repos** — define interfaces in the consumer package, not the provider

## Gotchas

- **Gin's `c.JSON` doesn't return** — always `return` after error responses
- **Binding validation tags** — `binding:"required"` only works with `ShouldBind*`
- **Goroutine safety** — don't share `gin.Context` across goroutines; copy needed values first
- **`c.Param` vs `c.Query`** — path params vs query strings are different methods
