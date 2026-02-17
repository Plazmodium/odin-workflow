---
name: python-fastapi
description: FastAPI framework for building high-performance async Python APIs with automatic OpenAPI docs
category: backend
version: "0.100+"
compatible_with:
  - postgresql
  - mongodb
  - redis
  - rest-api
---

# Python FastAPI

## Overview

FastAPI is a modern, high-performance Python web framework for building APIs. It uses Python type hints for automatic validation, serialization, and OpenAPI documentation.

## Project Structure

```
src/
├── main.py                  # FastAPI app instance + startup
├── config.py                # Settings via pydantic-settings
├── routers/
│   ├── auth.py              # Auth endpoints
│   └── users.py             # User endpoints
├── models/
│   ├── user.py              # SQLAlchemy / ORM models
│   └── schemas.py           # Pydantic request/response schemas
├── services/
│   └── user_service.py      # Business logic
├── middleware/
│   └── auth.py              # Auth dependency
├── db/
│   ├── session.py           # Database session
│   └── migrations/          # Alembic migrations
└── tests/
    ├── conftest.py           # Fixtures
    └── test_users.py
```

## Core Patterns

### App Setup

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.connect()
    yield
    # Shutdown
    await db.disconnect()

app = FastAPI(title="My API", lifespan=lifespan)
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/users", tags=["users"])
```

### Pydantic Schemas

```python
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str = Field(max_length=100)

class UserResponse(BaseModel):
    id: int
    email: str
    name: str

    model_config = {"from_attributes": True}  # ORM mode
```

### Dependency Injection

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    user = await user_service.get_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return user

# Use in endpoint
@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user
```

### Error Handling

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse

class AppException(Exception):
    def __init__(self, status_code: int, detail: str, code: str):
        self.status_code = status_code
        self.detail = detail
        self.code = code

@app.exception_handler(AppException)
async def app_exception_handler(request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "detail": exc.detail},
    )
```

## Best Practices

1. **Use async** — prefer `async def` endpoints with async DB drivers (asyncpg, motor)
2. **Pydantic v2** — use `model_config` dict, not inner `Config` class
3. **Dependency injection** — use `Depends()` for auth, DB sessions, services
4. **Response models** — always set `response_model` to control serialization
5. **Background tasks** — use `BackgroundTasks` for non-blocking operations
6. **Settings** — use `pydantic-settings` with `.env` files for configuration
7. **Alembic** — use for database migrations, never raw SQL in app code

## Gotchas

- **Sync vs async**: Mixing sync and async code blocks the event loop — use `run_in_executor` for sync operations
- **Pydantic v1 vs v2**: Many tutorials use v1 syntax — check for `model_config` vs inner `Config`
- **Dependency scope**: Dependencies are per-request by default; use `yield` dependencies for cleanup
- **OpenAPI schema**: Circular model references require `model_rebuild()` calls
