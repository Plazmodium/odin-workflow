---
name: python-django
description: Django web framework patterns for building full-stack Python applications with batteries included
category: backend
version: "5.x"
compatible_with:
  - postgresql
  - rest-api
---

# Python Django

## Overview

Django is a high-level Python web framework that follows the "batteries included" philosophy. It provides ORM, admin, auth, forms, and templating out of the box.

## Project Structure

```
project/
├── manage.py
├── config/
│   ├── settings/
│   │   ├── base.py          # Shared settings
│   │   ├── development.py   # Dev overrides
│   │   └── production.py    # Prod overrides
│   ├── urls.py              # Root URL conf
│   └── wsgi.py
├── apps/
│   └── users/
│       ├── models.py        # Database models
│       ├── views.py         # View logic
│       ├── serializers.py   # DRF serializers (if API)
│       ├── urls.py          # App URL routes
│       ├── admin.py         # Admin config
│       ├── services.py      # Business logic
│       ├── tests/
│       │   ├── test_models.py
│       │   └── test_views.py
│       └── migrations/
└── requirements/
    ├── base.txt
    └── dev.txt
```

## Core Patterns

### Models

```python
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    email = models.EmailField(unique=True)
    bio = models.TextField(blank=True, default="")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email
```

### Views (DRF)

```python
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(is_active=True)

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
```

### Services Layer

```python
# apps/users/services.py — keep business logic out of views
class UserService:
    @staticmethod
    def create_user(email: str, password: str, **kwargs) -> User:
        user = User.objects.create_user(email=email, password=password, **kwargs)
        send_welcome_email.delay(user.id)  # Celery task
        return user
```

### Querysets

```python
# Avoid N+1 queries
users = User.objects.select_related("profile").prefetch_related("groups").filter(is_active=True)

# Use F() and Q() for complex queries
from django.db.models import F, Q
Product.objects.filter(Q(stock__gt=0) | Q(preorder=True)).order_by(F("price").desc())
```

## Best Practices

1. **Fat models, thin views** — or better: fat services, thin everything else
2. **Custom User model** — always define one from the start (`AbstractUser`)
3. **select_related / prefetch_related** — prevent N+1 queries
4. **Migrations** — never edit auto-generated migrations; create new ones
5. **Settings split** — separate base/dev/prod settings files
6. **Signals sparingly** — prefer explicit service calls over implicit signals
7. **Django REST Framework** — use for API projects; serializers for validation

## Gotchas

- **Circular imports** — use string references in ForeignKey (`"app.Model"`)
- **Migration conflicts** — in team settings, use `--merge` to resolve
- **QuerySet laziness** — querysets aren't evaluated until iterated; chain freely
- **SECRET_KEY exposure** — never commit to VCS; use environment variables
- **Timezone handling** — always use `USE_TZ = True` and `django.utils.timezone`
