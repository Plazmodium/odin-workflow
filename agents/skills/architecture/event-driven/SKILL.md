---
name: event-driven
description: Event-driven architecture patterns — event sourcing, CQRS, message brokers, and async workflows
category: architecture
version: "1.0"
compatible_with:
  - domain-driven-design
  - microservices
  - redis
---

# Event-Driven Architecture

## Overview

Event-driven architecture (EDA) uses events as the primary mechanism for communication between components. Events represent facts — things that have happened — and enable loose coupling, scalability, and auditability.

## Patterns

### Event Notification

```
Producer → Event Bus → Consumer(s)

OrderService                    NotificationService
    │                                  │
    ├── publishes ──►  OrderPlaced ──► │ sends email
    │                                  │
InventoryService                PaymentService
    │                                  │
    ├── subscribes ─► OrderPlaced ──►  │ charges card
```

### Event Sourcing

```typescript
// Store events, not state — rebuild state by replaying events
class OrderEventStore {
  async save(orderId: string, events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.db.insert('events', {
        stream_id: orderId,
        type: event.type,
        data: JSON.stringify(event),
        version: event.version,
        occurred_at: event.occurredAt,
      });
    }
  }

  async load(orderId: string): Promise<DomainEvent[]> {
    return this.db.query(
      'SELECT * FROM events WHERE stream_id = $1 ORDER BY version ASC',
      [orderId]
    );
  }
}

// Rebuild aggregate from events
function rehydrate(events: DomainEvent[]): Order {
  const order = new Order();
  for (const event of events) {
    order.apply(event); // Mutates internal state
  }
  return order;
}
```

### CQRS (Command Query Responsibility Segregation)

```
Commands (Write)                    Queries (Read)
    │                                   │
    ▼                                   ▼
┌──────────┐   events    ┌──────────────────┐
│ Write DB │ ──────────► │ Read Projections  │
│ (events) │             │ (denormalized)    │
└──────────┘             └──────────────────┘
```

```typescript
// Command side — validates and stores events
async function placeOrder(cmd: PlaceOrderCommand): Promise<void> {
  const order = await eventStore.load(cmd.orderId);
  const events = order.place(cmd.items); // Returns new events
  await eventStore.save(cmd.orderId, events);
  await eventBus.publish(events);
}

// Query side — read from optimized projections
async function getOrderSummary(orderId: string): Promise<OrderSummary> {
  return readDb.query('SELECT * FROM order_summaries WHERE id = $1', [orderId]);
}

// Projector — updates read model when events arrive
class OrderProjector {
  async handle(event: OrderPlaced): Promise<void> {
    await readDb.insert('order_summaries', {
      id: event.orderId,
      status: 'placed',
      total: event.total,
      item_count: event.items.length,
    });
  }
}
```

### Message Broker Patterns

```typescript
// Dead letter queue for failed messages
const config = {
  queue: 'order-processing',
  deadLetterQueue: 'order-processing-dlq',
  maxRetries: 3,
  retryDelay: [1000, 5000, 30000], // Exponential backoff
};

// Idempotent consumers — handle duplicate delivery
async function handleOrderPlaced(event: OrderPlaced): Promise<void> {
  const processed = await cache.get(`processed:${event.id}`);
  if (processed) return; // Already handled

  await processOrder(event);
  await cache.set(`processed:${event.id}`, '1', 'EX', 86400);
}
```

## Best Practices

1. **Events are facts** — immutable, past-tense (`OrderPlaced`, not `PlaceOrder`)
2. **Idempotent consumers** — always handle duplicate delivery gracefully
3. **Schema evolution** — version events; add fields, don't rename/remove
4. **Dead letter queues** — capture failed messages for manual inspection
5. **Correlation IDs** — trace events across services with a shared ID
6. **Eventually consistent** — accept that read models may lag; design UX accordingly
7. **Start without event sourcing** — event notification is simpler; add sourcing when you need audit trails

## Gotchas

- **Ordering guarantees** — most message brokers guarantee order per partition/key, not globally
- **Eventual consistency** — read model may be stale; handle "not found yet" in consumers
- **Event versioning** — changing event schemas without migration breaks consumers
- **Debugging** — tracing an operation across async events is harder than a synchronous call stack
- **Two-phase commit trap** — don't try to atomically write to DB + publish event; use outbox pattern
