---
name: redis
description: Redis in-memory data store patterns for caching, sessions, queues, and real-time features
category: database
version: "7.x"
compatible_with:
  - nodejs-express
  - nodejs-fastify
  - python-fastapi
  - python-django
  - golang-gin
---

# Redis

## Overview

Redis is an in-memory data structure store used as a cache, message broker, and database. This skill covers caching patterns, data structures, and common use cases.

## Common Use Cases

### Caching

```typescript
// Cache-aside pattern (most common)
async function getUser(id: string): Promise<User> {
  const cacheKey = `user:${id}`;

  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 2. Cache miss → fetch from DB
  const user = await db.users.findById(id);
  if (!user) throw new NotFoundError();

  // 3. Populate cache with TTL
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600); // 1 hour

  return user;
}

// Invalidate on mutation
async function updateUser(id: string, data: UpdateUserDto): Promise<User> {
  const user = await db.users.update(id, data);
  await redis.del(`user:${id}`); // Invalidate cache
  return user;
}
```

### Sessions

```typescript
// Store session data with TTL
await redis.set(`session:${sessionId}`, JSON.stringify({
  userId: user.id,
  role: user.role,
  loginAt: Date.now(),
}), 'EX', 86400); // 24 hours

// Retrieve
const session = JSON.parse(await redis.get(`session:${sessionId}`) || 'null');
```

### Rate Limiting

```typescript
// Sliding window rate limiter
async function checkRateLimit(ip: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSec);
  }

  return current <= limit;
}
```

### Pub/Sub

```typescript
// Publisher
await redis.publish('notifications', JSON.stringify({
  userId: '123',
  type: 'new_message',
  payload: { from: 'Jane', text: 'Hello' },
}));

// Subscriber
const sub = redis.duplicate();
await sub.subscribe('notifications');
sub.on('message', (channel, message) => {
  const notification = JSON.parse(message);
  sendToWebSocket(notification.userId, notification);
});
```

## Data Structures

```bash
# Strings — basic key-value, counters
SET user:123:name "John"
INCR page:views:homepage

# Hashes — object-like storage (memory efficient)
HSET user:123 name "John" email "john@example.com" role "admin"
HGET user:123 email

# Lists — queues, recent items
LPUSH queue:emails '{"to":"john@..."}'
RPOP queue:emails

# Sets — unique collections, tags
SADD post:456:tags "javascript" "react" "tutorial"
SISMEMBER post:456:tags "react"

# Sorted Sets — leaderboards, time-series
ZADD leaderboard 1500 "player1" 2300 "player2"
ZREVRANGE leaderboard 0 9 WITHSCORES  # Top 10
```

## Best Practices

1. **Use key namespaces** — `entity:id:field` pattern (`user:123:profile`)
2. **Always set TTL** — prevent unbounded memory growth; use `EX` or `EXPIREAT`
3. **Use pipelines** — batch multiple commands in one round trip
4. **Prefer hashes** for objects — more memory-efficient than separate string keys
5. **Avoid large keys** — break large values into smaller structures or use Streams
6. **Use Lua scripts** for atomic operations — `EVAL` guarantees atomicity
7. **Monitor memory** — use `INFO memory` and set `maxmemory-policy` (e.g., `allkeys-lru`)

## Gotchas

- **No built-in persistence guarantees** — RDB snapshots + AOF help, but Redis is not a primary database
- **Single-threaded** — long-running commands (KEYS *, large SORT) block all clients; use SCAN instead
- **Pub/Sub is fire-and-forget** — messages are lost if no subscriber is listening; use Streams for durability
- **Serialization overhead** — JSON.stringify/parse adds latency; consider MessagePack for large payloads
- **Connection limits** — each subscriber needs its own connection; use connection pooling
