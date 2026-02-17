---
name: mongodb
description: MongoDB document database patterns, schema design, indexing, and aggregation
category: database
version: "7.x"
compatible_with:
  - nodejs-express
  - nodejs-fastify
  - python-fastapi
  - rest-api
---

# MongoDB

## Overview

MongoDB is a document database that stores data in flexible JSON-like documents. This skill covers schema design, queries, indexing, and aggregation pipelines.

## Schema Design

### Embedding vs Referencing

```javascript
// EMBED when data is read together and has a 1:few relationship
{
  _id: ObjectId("..."),
  name: "John",
  addresses: [
    { street: "123 Main", city: "Springfield", type: "home" },
    { street: "456 Work", city: "Springfield", type: "work" }
  ]
}

// REFERENCE when data is many:many, frequently updated independently, or large
{
  _id: ObjectId("..."),
  name: "John",
  organization_id: ObjectId("...")  // Reference to organizations collection
}
```

### Schema Validation

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name", "createdAt"],
      properties: {
        email: { bsonType: "string", pattern: "^.+@.+$" },
        name: { bsonType: "string", maxLength: 100 },
        role: { enum: ["admin", "member", "viewer"] },
        createdAt: { bsonType: "date" }
      }
    }
  }
});
```

## Query Patterns

### CRUD

```javascript
// Find with projection
const user = await db.collection('users').findOne(
  { email: "john@example.com" },
  { projection: { password_hash: 0 } }  // Exclude sensitive fields
);

// Update with operators
await db.collection('users').updateOne(
  { _id: userId },
  { $set: { name: "New Name" }, $currentDate: { updatedAt: true } }
);

// Upsert
await db.collection('metrics').updateOne(
  { date: today, type: "pageview" },
  { $inc: { count: 1 } },
  { upsert: true }
);
```

### Aggregation Pipeline

```javascript
const result = await db.collection('orders').aggregate([
  { $match: { status: "completed", createdAt: { $gte: thirtyDaysAgo } } },
  { $group: { _id: "$customerId", totalSpent: { $sum: "$total" }, orderCount: { $sum: 1 } } },
  { $sort: { totalSpent: -1 } },
  { $limit: 10 },
  { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "customer" } },
  { $unwind: "$customer" },
  { $project: { name: "$customer.name", totalSpent: 1, orderCount: 1 } }
]).toArray();
```

### Indexes

```javascript
// Single field
db.users.createIndex({ email: 1 }, { unique: true });

// Compound (order matters for query optimization)
db.orders.createIndex({ customerId: 1, createdAt: -1 });

// TTL (auto-delete documents after expiry)
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Text search
db.articles.createIndex({ title: "text", body: "text" });
```

## Best Practices

1. **Design for queries** — model data based on access patterns, not normalization
2. **Embed by default** — reference only when there's a clear reason
3. **Index for your queries** — use `explain()` to verify index usage
4. **Use `$project` early** — reduce document size in aggregation pipelines
5. **Avoid unbounded arrays** — arrays that grow without limit cause performance issues
6. **Use transactions sparingly** — multi-document transactions add overhead; design schemas to minimize need
7. **Connection pooling** — reuse client instances; don't connect/disconnect per request

## Gotchas

- **No JOINs** — `$lookup` exists but is expensive; embed data you read together
- **Document size limit** — 16MB per document; watch out for growing arrays
- **ObjectId ordering** — ObjectIds contain timestamps, so default `_id` sort is chronological
- **Schemaless trap** — lack of enforced schema leads to inconsistent data; use validation
- **Write concern** — default `w:1` may lose data on failover; use `w:"majority"` for durability
