---
name: trpc
description: tRPC expertise for building end-to-end typesafe APIs. Covers routers, procedures, context, middleware, and React Query integration for full-stack TypeScript applications.
category: api
compatible_with:
  - nextjs-dev
  - react-patterns
  - prisma-orm
---

# tRPC End-to-End Typesafe APIs

## Instructions

1. **Assess the project**: tRPC is ideal for full-stack TypeScript monorepos.
2. **Follow tRPC conventions**:
   - Define routers and procedures
   - Use Zod for input validation
   - Leverage TypeScript inference
   - Integrate with React Query
3. **Provide complete examples**: Include server routers and client usage.
4. **Guide on best practices**: Error handling, middleware, subscriptions.

## Server Setup

### Initialize tRPC

```typescript
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';
import superjson from 'superjson';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError
          ? error.cause.flatten()
          : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
```

### Context

```typescript
// server/context.ts
import { type inferAsyncReturnType } from '@trpc/server';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { getSession } from 'next-auth/react';
import { prisma } from './db';

export const createContext = async (opts: CreateNextContextOptions) => {
  const session = await getSession({ req: opts.req });

  return {
    session,
    user: session?.user,
    prisma,
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
```

### Middleware

```typescript
// server/trpc.ts
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});

const isAdmin = middleware(async ({ ctx, next }) => {
  if (ctx.user?.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(isAuthed).use(isAdmin);
```

## Routers

### Basic Router

```typescript
// server/routers/user.ts
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const userRouter = router({
  // Public query
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, email: true, image: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return user;
    }),

  // Protected query
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
    });
  }),

  // Mutation with input validation
  update: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      bio: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: input,
      });
    }),
});
```

### Nested Router with Pagination

```typescript
// server/routers/post.ts
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';

export const postRouter = router({
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().nullish(),
      filter: z.object({
        published: z.boolean().optional(),
        authorId: z.string().optional(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, cursor, filter } = input;

      const posts = await ctx.prisma.post.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          published: filter?.published,
          authorId: filter?.authorId,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: posts,
        nextCursor,
      };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1),
      published: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.post.create({
        data: {
          ...input,
          authorId: ctx.user.id,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().min(1).optional(),
      published: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify ownership
      const post = await ctx.prisma.post.findUnique({ where: { id } });
      if (!post || post.authorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.prisma.post.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.id }
      });

      if (!post || post.authorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      await ctx.prisma.post.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

### Root Router

```typescript
// server/routers/_app.ts
import { router } from '../trpc';
import { userRouter } from './user';
import { postRouter } from './post';

export const appRouter = router({
  user: userRouter,
  post: postRouter,
});

export type AppRouter = typeof appRouter;
```

## Client Setup

### React Client

```typescript
// utils/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import { type AppRouter } from '../server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
```

### Provider Setup

```typescript
// pages/_app.tsx or app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '../utils/trpc';
import superjson from 'superjson';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer: superjson,
      headers() {
        return {
          // Add auth headers if needed
        };
      },
    }),
  ],
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

## Client Usage

### Queries

```typescript
function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = trpc.user.getById.useQuery({ id: userId });

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}

// With options
const { data } = trpc.post.list.useQuery(
  { limit: 10, filter: { published: true } },
  {
    enabled: isLoggedIn,
    refetchInterval: 30000,
  }
);
```

### Infinite Queries

```typescript
function PostFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.post.list.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  return (
    <>
      {data?.pages.map((page) =>
        page.items.map((post) => <PostCard key={post.id} post={post} />)
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </>
  );
}
```

### Mutations

```typescript
function CreatePostForm() {
  const utils = trpc.useUtils();

  const createPost = trpc.post.create.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
      utils.post.list.invalidate();
    },
    onError: (error) => {
      if (error.data?.zodError) {
        // Handle validation errors
        console.log(error.data.zodError.fieldErrors);
      }
    },
  });

  const handleSubmit = (values: { title: string; content: string }) => {
    createPost.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={createPost.isPending}>
        {createPost.isPending ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  );
}
```

### Optimistic Updates

```typescript
const updatePost = trpc.post.update.useMutation({
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await utils.post.getById.cancel({ id: newData.id });

    // Snapshot previous value
    const previousPost = utils.post.getById.getData({ id: newData.id });

    // Optimistically update
    utils.post.getById.setData({ id: newData.id }, (old) => ({
      ...old!,
      ...newData,
    }));

    return { previousPost };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    utils.post.getById.setData(
      { id: newData.id },
      context?.previousPost
    );
  },
  onSettled: (data, error, variables) => {
    // Refetch after mutation
    utils.post.getById.invalidate({ id: variables.id });
  },
});
```

## Subscriptions (WebSocket)

### Server

```typescript
import { observable } from '@trpc/server/observable';

export const notificationRouter = router({
  onNew: protectedProcedure.subscription(({ ctx }) => {
    return observable<Notification>((emit) => {
      const onNotification = (notification: Notification) => {
        if (notification.userId === ctx.user.id) {
          emit.next(notification);
        }
      };

      eventEmitter.on('notification', onNotification);

      return () => {
        eventEmitter.off('notification', onNotification);
      };
    });
  }),
});
```

### Client

```typescript
trpc.notification.onNew.useSubscription(undefined, {
  onData: (notification) => {
    toast.info(notification.message);
  },
});
```

## Best Practices

- **Use Zod schemas** - Single source of truth for validation
- **Leverage inference** - Let TypeScript infer types from schemas
- **Batch requests** - Use `httpBatchLink` for multiple queries
- **Invalidate wisely** - Only invalidate what's necessary
- **Error boundaries** - Wrap components that use queries
- **Prefetch data** - Use `prefetch` for anticipated navigation
- **Keep routers focused** - One domain per router file

## References

- tRPC Documentation: https://trpc.io/docs
- tRPC + Next.js: https://trpc.io/docs/nextjs
- tRPC + React Query: https://trpc.io/docs/react-query
