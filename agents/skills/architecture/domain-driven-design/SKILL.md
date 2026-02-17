---
name: domain-driven-design
description: Domain-Driven Design patterns — bounded contexts, aggregates, and strategic design
category: architecture
version: "1.0"
compatible_with:
  - clean-architecture
  - event-driven
  - microservices
---

# Domain-Driven Design (DDD)

## Overview

DDD is a software design approach that models complex business domains through a shared ubiquitous language, bounded contexts, and tactical patterns like aggregates and domain events.

## Strategic Design

### Bounded Contexts

```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐
│   Identity &    │    │    Ordering       │    │   Shipping    │
│   Access        │    │                   │    │               │
│                 │    │  Order            │    │  Shipment     │
│  User           │◄──►│  LineItem         │◄──►│  Tracking     │
│  Role           │    │  Cart             │    │  Address      │
│  Permission     │    │  Payment          │    │  Carrier      │
└─────────────────┘    └──────────────────┘    └───────────────┘
     Context Map: Published Language / Anti-Corruption Layer
```

Each bounded context has its own:
- **Ubiquitous language** — "User" in Identity vs "Customer" in Ordering
- **Models** — same real-world concept, different representations
- **Data store** — ideally its own database/schema

### Context Mapping

| Pattern | When to Use |
|---------|------------|
| **Shared Kernel** | Two teams co-own a small shared model |
| **Customer-Supplier** | Upstream provides what downstream needs |
| **Anti-Corruption Layer** | Translate between contexts to prevent leaking |
| **Published Language** | Well-defined API/events for integration |

## Tactical Patterns

### Aggregate

```typescript
// Aggregate Root — consistency boundary
class Order {
  private items: OrderItem[] = [];
  private status: OrderStatus = 'draft';

  addItem(product: ProductRef, quantity: number, price: Money): void {
    if (this.status !== 'draft') throw new DomainError('Cannot modify submitted order');
    const existing = this.items.find(i => i.productId === product.id);
    if (existing) {
      existing.increaseQuantity(quantity);
    } else {
      this.items.push(new OrderItem(product.id, quantity, price));
    }
  }

  submit(): DomainEvent[] {
    if (this.items.length === 0) throw new DomainError('Cannot submit empty order');
    this.status = 'submitted';
    return [new OrderSubmitted(this.id, this.total(), this.items.length)];
  }

  get total(): Money {
    return this.items.reduce((sum, item) => sum.add(item.subtotal()), Money.zero());
  }
}
```

### Domain Events

```typescript
// Events represent something that happened in the domain
class OrderSubmitted implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(
    public readonly orderId: string,
    public readonly total: Money,
    public readonly itemCount: number,
  ) {}
}

// Handle in application layer
class OnOrderSubmitted {
  constructor(private emailService: EmailService, private inventoryService: InventoryService) {}

  async handle(event: OrderSubmitted): Promise<void> {
    await this.emailService.sendOrderConfirmation(event.orderId);
    await this.inventoryService.reserveItems(event.orderId);
  }
}
```

### Repository

```typescript
// Repository per aggregate root — NOT per table
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;  // Saves entire aggregate
  nextId(): OrderId;
}
```

## Best Practices

1. **One aggregate = one transaction** — don't modify multiple aggregates in one transaction
2. **Reference aggregates by ID** — not by direct object reference
3. **Small aggregates** — only include what's needed for invariant enforcement
4. **Domain events for cross-aggregate communication** — eventual consistency between aggregates
5. **Ubiquitous language** — code names must match domain expert vocabulary
6. **Anti-Corruption Layer** — always translate at context boundaries

## Gotchas

- **Anemic domain model** — entities with only getters/setters and all logic in services
- **Big aggregate** — putting everything in one aggregate kills performance
- **Premature context splitting** — start with one context, split when language diverges
- **Ignoring the domain expert** — DDD requires ongoing collaboration, not just patterns
