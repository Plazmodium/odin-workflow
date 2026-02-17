---
name: microservices
description: Microservices design patterns — service boundaries, communication, resilience, and observability
category: architecture
version: "1.0"
depends_on:
  - domain-driven-design
  - event-driven
compatible_with:
  - docker
  - kubernetes
  - rest-api
  - grpc
---

# Microservices Architecture

## Overview

Microservices decompose an application into small, independently deployable services organized around business capabilities. Each service owns its data and communicates via APIs or events.

## Service Design

### Service Boundaries

```
✅ Good boundaries (aligned with business capabilities):
┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐
│  Users   │  │  Orders   │  │ Payments │  │ Shipping  │
│          │  │           │  │          │  │           │
│ - Auth   │  │ - Cart    │  │ - Charge │  │ - Track   │
│ - Profile│  │ - Checkout│  │ - Refund │  │ - Fulfill │
│ - Prefs  │  │ - History │  │ - Ledger │  │ - Label   │
└──────────┘  └───────────┘  └──────────┘  └───────────┘

❌ Bad boundaries (tech layers):
┌──────────┐  ┌───────────┐  ┌──────────┐
│ Frontend │  │  Backend  │  │ Database │  ← Not microservices
└──────────┘  └───────────┘  └──────────┘
```

### Communication

```
Synchronous (request/response):
  REST API   — Simple CRUD, public APIs
  gRPC       — Internal service-to-service, streaming

Asynchronous (event-driven):
  Message Queue (RabbitMQ, SQS) — Task processing, commands
  Event Stream (Kafka)          — Event sourcing, data sync
```

## Core Patterns

### API Gateway

```yaml
# Route external requests to internal services
routes:
  /api/users/*:    upstream: http://user-service:3000
  /api/orders/*:   upstream: http://order-service:3000
  /api/payments/*: upstream: http://payment-service:3000

# Cross-cutting concerns at the gateway:
# - Authentication / JWT validation
# - Rate limiting
# - Request logging
# - Response caching
```

### Service Communication

```typescript
// Sync: REST with circuit breaker
import CircuitBreaker from 'opossum';

const paymentBreaker = new CircuitBreaker(
  async (orderId: string) => {
    return fetch(`http://payment-service/charges/${orderId}`);
  },
  { timeout: 3000, errorThresholdPercentage: 50, resetTimeout: 30000 }
);

// Fallback when circuit is open
paymentBreaker.fallback(() => ({ status: 'pending', message: 'Payment service unavailable' }));
```

### Saga Pattern (distributed transactions)

```
Choreography (events):
  OrderCreated → PaymentCharged → InventoryReserved → ShipmentScheduled
       ↓ (if fails)
  OrderCreated → PaymentCharged → InventoryFailed → PaymentRefunded → OrderCancelled

Orchestration (central coordinator):
  OrderSaga:
    1. Create order (pending)
    2. Charge payment → if fails → cancel order
    3. Reserve inventory → if fails → refund payment → cancel order
    4. Schedule shipment → if fails → release inventory → refund → cancel
    5. Mark order complete
```

### Service Mesh / Observability

```yaml
# Distributed tracing headers (propagate across services)
X-Request-ID: unique-per-request
X-Correlation-ID: unique-per-user-action

# Health check endpoint (every service)
GET /health
{
  "status": "healthy",
  "version": "1.2.3",
  "uptime": 86400,
  "dependencies": {
    "database": "connected",
    "cache": "connected",
    "payment-service": "healthy"
  }
}
```

## Best Practices

1. **Database per service** — no shared databases; communicate via APIs/events
2. **Smart endpoints, dumb pipes** — business logic in services, not in the messaging layer
3. **Design for failure** — circuit breakers, retries with backoff, fallbacks
4. **Health checks** — every service exposes `/health` with dependency status
5. **Distributed tracing** — propagate correlation IDs through all service calls
6. **Independent deployability** — each service has its own CI/CD pipeline
7. **Start with a monolith** — extract services when team/domain boundaries become clear

## Gotchas

- **Distributed monolith** — services that must deploy together aren't microservices
- **Data consistency** — no ACID across services; use sagas and eventual consistency
- **Network unreliability** — every service call can fail, timeout, or return stale data
- **Operational complexity** — monitoring, logging, tracing across N services is hard
- **Service discovery** — services need to find each other; use DNS, Consul, or Kubernetes services
