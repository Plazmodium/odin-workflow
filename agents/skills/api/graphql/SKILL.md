---
name: graphql
description: GraphQL API design and implementation expertise. Covers schema design, resolvers, queries, mutations, subscriptions, and client integration with Apollo or urql.
category: api
compatible_with:
  - nodejs-express
  - nodejs-fastify
  - nextjs-dev
  - react-patterns
---

# GraphQL API Design

## Instructions

1. **Assess the API need**: Flexible queries, real-time data, or complex relationships.
2. **Follow GraphQL conventions**:
   - Schema-first or code-first approach
   - Proper type definitions
   - N+1 query prevention with DataLoader
   - Input validation
3. **Provide complete examples**: Include schema, resolvers, and client queries.
4. **Guide on best practices**: Pagination, error handling, authentication.

## Schema Design

### Basic Types

```graphql
type User {
  id: ID!
  email: String!
  name: String!
  avatar: String
  role: Role!
  posts: [Post!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  published: Boolean!
  author: User!
  comments: [Comment!]!
  tags: [Tag!]!
  createdAt: DateTime!
}

enum Role {
  USER
  ADMIN
  MODERATOR
}

scalar DateTime
```

### Input Types

```graphql
input CreateUserInput {
  email: String!
  name: String!
  password: String!
  role: Role = USER
}

input UpdateUserInput {
  email: String
  name: String
  avatar: String
}

input PostFilters {
  published: Boolean
  authorId: ID
  tags: [String!]
  search: String
}
```

### Queries and Mutations

```graphql
type Query {
  # Single resource
  user(id: ID!): User
  post(id: ID!): Post

  # Collections with pagination
  users(
    first: Int
    after: String
    filter: UserFilter
  ): UserConnection!

  posts(
    first: Int
    after: String
    filter: PostFilters
    orderBy: PostOrderBy
  ): PostConnection!

  # Current user
  me: User
}

type Mutation {
  # User mutations
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!

  # Auth mutations
  login(email: String!, password: String!): AuthPayload!
  logout: Boolean!

  # Post mutations
  createPost(input: CreatePostInput!): Post!
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  publishPost(id: ID!): Post!
  deletePost(id: ID!): Boolean!
}

type Subscription {
  postCreated: Post!
  commentAdded(postId: ID!): Comment!
}
```

### Relay-style Pagination

```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  cursor: String!
  node: User!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### Payload Types (for mutations)

```graphql
type CreateUserPayload {
  user: User
  errors: [Error!]
}

type Error {
  field: String
  message: String!
  code: String!
}
```

## Resolvers

### Basic Resolvers (Node.js)

```typescript
import { Resolvers } from './generated/graphql';

const resolvers: Resolvers = {
  Query: {
    user: async (_, { id }, { dataSources }) => {
      return dataSources.users.findById(id);
    },

    users: async (_, { first = 20, after, filter }, { dataSources }) => {
      return dataSources.users.findMany({ first, after, filter });
    },

    me: async (_, __, { currentUser }) => {
      return currentUser;
    },
  },

  Mutation: {
    createUser: async (_, { input }, { dataSources }) => {
      try {
        const user = await dataSources.users.create(input);
        return { user, errors: null };
      } catch (error) {
        return {
          user: null,
          errors: [{ message: error.message, code: 'CREATE_FAILED' }]
        };
      }
    },

    updateUser: async (_, { id, input }, { dataSources, currentUser }) => {
      if (currentUser.id !== id && currentUser.role !== 'ADMIN') {
        throw new ForbiddenError('Not authorized');
      }
      return dataSources.users.update(id, input);
    },
  },

  // Field resolvers
  User: {
    posts: async (user, _, { dataSources }) => {
      return dataSources.posts.findByAuthorId(user.id);
    },
  },

  Post: {
    author: async (post, _, { dataSources }) => {
      return dataSources.users.findById(post.authorId);
    },
  },
};
```

### DataLoader (N+1 Prevention)

```typescript
import DataLoader from 'dataloader';

// Create loaders
const createLoaders = (db) => ({
  userLoader: new DataLoader(async (ids: string[]) => {
    const users = await db.users.findMany({
      where: { id: { in: ids } }
    });
    // Return in same order as requested ids
    return ids.map(id => users.find(u => u.id === id));
  }),

  postsByAuthorLoader: new DataLoader(async (authorIds: string[]) => {
    const posts = await db.posts.findMany({
      where: { authorId: { in: authorIds } }
    });
    // Group by author
    return authorIds.map(authorId =>
      posts.filter(p => p.authorId === authorId)
    );
  }),
});

// Use in resolvers
const resolvers = {
  Post: {
    author: (post, _, { loaders }) => {
      return loaders.userLoader.load(post.authorId);
    },
  },
  User: {
    posts: (user, _, { loaders }) => {
      return loaders.postsByAuthorLoader.load(user.id);
    },
  },
};
```

## Server Setup

### Apollo Server

```typescript
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
  ],
});

await server.start();

app.use(
  '/graphql',
  cors(),
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const currentUser = token ? await verifyToken(token) : null;

      return {
        currentUser,
        dataSources: createDataSources(db),
        loaders: createLoaders(db),
      };
    },
  })
);
```

## Client Queries

### Apollo Client

```typescript
import { gql, useQuery, useMutation } from '@apollo/client';

// Query
const GET_USERS = gql`
  query GetUsers($first: Int, $after: String) {
    users(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          email
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function UserList() {
  const { data, loading, error, fetchMore } = useQuery(GET_USERS, {
    variables: { first: 20 },
  });

  if (loading) return <Loading />;
  if (error) return <Error error={error} />;

  return (
    <>
      {data.users.edges.map(({ node }) => (
        <UserCard key={node.id} user={node} />
      ))}
      {data.users.pageInfo.hasNextPage && (
        <button onClick={() => fetchMore({
          variables: { after: data.users.pageInfo.endCursor }
        })}>
          Load More
        </button>
      )}
    </>
  );
}

// Mutation
const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      user {
        id
        name
        email
      }
      errors {
        field
        message
      }
    }
  }
`;

function CreateUserForm() {
  const [createUser, { loading }] = useMutation(CREATE_USER, {
    update(cache, { data }) {
      if (data.createUser.user) {
        cache.modify({
          fields: {
            users(existing = { edges: [] }) {
              const newEdge = {
                __typename: 'UserEdge',
                cursor: data.createUser.user.id,
                node: data.createUser.user,
              };
              return {
                ...existing,
                edges: [newEdge, ...existing.edges],
              };
            },
          },
        });
      }
    },
  });

  const handleSubmit = async (values) => {
    const { data } = await createUser({ variables: { input: values } });
    if (data.createUser.errors) {
      // Handle errors
    }
  };
}
```

### Fragments

```graphql
fragment UserFields on User {
  id
  name
  email
  avatar
}

fragment PostWithAuthor on Post {
  id
  title
  content
  author {
    ...UserFields
  }
}

query GetPost($id: ID!) {
  post(id: $id) {
    ...PostWithAuthor
    comments {
      id
      content
      author {
        ...UserFields
      }
    }
  }
}
```

## Subscriptions

### Server

```typescript
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

const httpServer = createServer(app);
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

useServer(
  {
    schema,
    context: async (ctx) => {
      const token = ctx.connectionParams?.authToken;
      return { currentUser: await verifyToken(token) };
    },
  },
  wsServer
);

// Resolver
const resolvers = {
  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterator(['POST_CREATED']),
    },
    commentAdded: {
      subscribe: (_, { postId }) => {
        return pubsub.asyncIterator([`COMMENT_ADDED_${postId}`]);
      },
    },
  },
  Mutation: {
    createPost: async (_, { input }, { dataSources, pubsub }) => {
      const post = await dataSources.posts.create(input);
      pubsub.publish('POST_CREATED', { postCreated: post });
      return post;
    },
  },
};
```

### Client

```typescript
const POST_SUBSCRIPTION = gql`
  subscription OnPostCreated {
    postCreated {
      id
      title
      author {
        name
      }
    }
  }
`;

function PostFeed() {
  const { data, subscribeToMore } = useQuery(GET_POSTS);

  useEffect(() => {
    return subscribeToMore({
      document: POST_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        const newPost = subscriptionData.data.postCreated;
        return {
          ...prev,
          posts: {
            ...prev.posts,
            edges: [
              { node: newPost, cursor: newPost.id },
              ...prev.posts.edges,
            ],
          },
        };
      },
    });
  }, [subscribeToMore]);
}
```

## Best Practices

- **Use DataLoader** - Prevent N+1 queries
- **Implement pagination** - Relay cursor-based for large datasets
- **Validate inputs** - Use custom scalars or directives
- **Handle errors gracefully** - Return errors in payload, not exceptions
- **Depth limiting** - Prevent deeply nested queries
- **Query complexity** - Limit expensive queries
- **Persisted queries** - For production security
- **Schema stitching/federation** - For microservices

## References

- GraphQL Specification: https://spec.graphql.org/
- Apollo Documentation: https://www.apollographql.com/docs/
- GraphQL Best Practices: https://graphql.org/learn/best-practices/
