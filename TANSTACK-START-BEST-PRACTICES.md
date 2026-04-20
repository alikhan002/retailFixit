# TanStack Start Best Practices Guide

A comprehensive guide based on real-world implementation experience with TanStack Start, covering routing, server functions, database integration, and deployment patterns.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Environment Configuration](#environment-configuration)
3. [Routing Best Practices](#routing-best-practices)
4. [Server Functions](#server-functions)
5. [Database Integration](#database-integration)
6. [Error Handling](#error-handling)
7. [Performance Optimization](#performance-optimization)
8. [Security Considerations](#security-considerations)
9. [Testing Strategies](#testing-strategies)
10. [Deployment Guidelines](#deployment-guidelines)

## Project Structure

### Recommended Directory Layout

```
├── src/
│   ├── components/           # Reusable React components
│   ├── routes/              # File-based routing
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Home page
│   │   └── api/             # API routes
│   ├── db/                  # Database utilities (optional)
│   ├── lib/                 # Shared utilities
│   └── styles.css           # Global styles
├── drizzle/                 # Database layer (simplified structure)
│   ├── schema/              # Database schemas
│   │   ├── index.ts         # Schema exports
│   │   ├── users.ts         # User table schema
│   │   ├── posts.ts         # Posts table schema
│   │   └── relations.ts     # Table relations
│   ├── connection.ts        # Database connection
│   ├── queries.ts           # Centralized queries
│   ├── migrate.ts           # Migration runner
│   ├── seed.ts              # Database seeding
│   └── migrations/          # Generated migration files
├── drizzle.config.ts        # Drizzle configuration (root level)
├── public/                  # Static assets
└── docker-compose.yml       # Development services
```

### Key Principles

- **Simplified Structure**: Single package.json with unified dependency management
- **Separation of Concerns**: Keep database logic organized in dedicated drizzle/ directory
- **Co-location**: Place related components, styles, and tests together
- **Clear Boundaries**: Distinguish between client and server code
- **Type Safety**: Leverage TypeScript throughout the stack

## Environment Configuration

### Environment Variable Strategy

TanStack Start uses Vite's environment variable system with specific prefixing rules:

```bash
# ✅ Server-only (no prefix) - Never exposed to client
DATABASE_URL=postgresql://user:@localhost:5432/mydb
JWT_SECRET=super-secret-key
STRIPE_SECRET_KEY=sk_live_...

# ✅ Client-safe (VITE_ prefix) - Exposed to client bundle
VITE_APP_NAME=My TanStack Start App
VITE_API_URL=https://api.example.com
VITE_SENTRY_DSN=https://...
```

### Environment File Hierarchy

Create multiple environment files for different contexts:

```bash
# .env - Default values (commit to repo)
VITE_APP_NAME=My TanStack Start App
DATABASE_URL=postgresql://localhost:5432/myapp_dev

# .env.local - Local overrides (never commit)
DATABASE_URL=postgresql://user:@localhost:5432/myapp_local
JWT_SECRET=your-local-secret

# .env.production - Production overrides
VITE_API_URL=https://api.myapp.com
DATABASE_POOL_SIZE=20
```

### Environment Validation

Always validate environment variables at startup:

```typescript
// src/config/env.ts
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string(),
  VITE_API_URL: z.string().url(),
});

export const serverEnv = serverEnvSchema.parse(process.env);
export const clientEnv = clientEnvSchema.parse(import.meta.env);
```

## Routing Best Practices

### File-Based Routing Structure

TanStack Start uses file-based routing. Follow these conventions:

```
src/routes/
├── __root.tsx              # Root layout with Outlet
├── index.tsx               # Home page (/)
├── about.tsx               # About page (/about)
├── posts/
│   ├── index.tsx           # Posts list (/posts)
│   ├── new.tsx             # Create post (/posts/new)
│   └── $postId/
│       ├── index.tsx       # Post detail (/posts/:postId)
│       └── edit.tsx        # Edit post (/posts/:postId/edit)
└── api/
    └── posts.ts            # API endpoint (/api/posts)
```

### Root Layout Pattern

Always use a root layout with proper error boundaries:

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ({ error }) => (
    <div className="p-4">
      <h1>Something went wrong!</h1>
      <pre className="text-red-500">{error.message}</pre>
    </div>
  ),
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>My App</title>
      </head>
      <body>
        <div id="app">
          <Outlet />
        </div>
        <TanStackRouterDevtools position="bottom-right" />
      </body>
    </html>
  );
}
```

### Nested Route Layouts

Use parent routes for shared layouts:

```tsx
// src/routes/posts.tsx - Parent layout
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/posts")({
  component: PostsLayout,
});

function PostsLayout() {
  return (
    <div className="posts-layout">
      <nav>
        <Link to="/posts">All Posts</Link>
        <Link to="/posts/new">New Post</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

### Route Loaders and Data Fetching

Use route loaders for server-side data fetching:

```tsx
// src/routes/posts/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { getPosts } from "@/db/posts";

export const Route = createFileRoute("/posts/")({
  loader: async () => {
    const posts = await getPosts();
    return { posts };
  },
  component: PostsList,
});

function PostsList() {
  const { posts } = Route.useLoaderData();

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

## Server Functions

### Creating Type-Safe Server Functions

Use `createServerFn` for server-side operations:

```typescript
// src/db/posts.ts
import { createServerFn } from "@tanstack/start";
import { z } from "zod";
import { db } from "@/drizzle/connection";
import { posts } from "@/drizzle/schema";

const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export const createPost = createServerFn({ method: "POST" })
  .validator(createPostSchema)
  .handler(async ({ data }) => {
    const [newPost] = await db.insert(posts).values(data).returning();

    return newPost;
  });

export const getPosts = createServerFn({ method: "GET" }).handler(async () => {
  return await db.select().from(posts).orderBy(desc(posts.createdAt));
});
```

### HTTP Method Considerations

**Important**: TanStack Start has specific requirements for HTTP methods:

- Use `POST` for mutations (create, update, delete operations)
- Use `GET` for data fetching
- Avoid `PUT`, `PATCH`, `DELETE` methods as they may not work consistently

```typescript
// ✅ Correct - Use POST for updates
export const updatePost = createServerFn({ method: "POST" })
  .validator(updatePostSchema)
  .handler(async ({ data }) => {
    // Update logic
  });

// ❌ Avoid - PUT may not work
export const updatePost = createServerFn({ method: "PUT" });
```

### Server Function Error Handling

Implement proper error handling in server functions:

```typescript
export const deletePost = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    try {
      const [deletedPost] = await db
        .delete(posts)
        .where(eq(posts.id, data.id))
        .returning();

      if (!deletedPost) {
        throw new Error("Post not found");
      }

      return { success: true, id: data.id };
    } catch (error) {
      console.error("Delete post error:", error);
      throw new Error("Failed to delete post");
    }
  });
```

### Using Server Functions in Components

Use `useServerFn` hook for client-side server function calls:

```tsx
import { useServerFn } from "@tanstack/start";
import { createPost } from "@/db/posts";

function CreatePostForm() {
  const createPostFn = useServerFn(createPost);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const result = await createPostFn({
        title: formData.get("title") as string,
        content: formData.get("content") as string,
      });
      // Handle success
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  return <form action={handleSubmit}>{/* Form fields */}</form>;
}
```

## Database Integration

### Simplified Drizzle Integration

This guide uses a simplified approach for integrating Drizzle ORM with TanStack Start:

**Benefits:**

- Single package.json for all dependencies
- Unified build and development process
- Simpler deployment and CI/CD
- Direct imports without complex path resolution
- All database commands available from project root

**Configuration:**

- Root-level `drizzle.config.ts` for Drizzle Kit
- Database files organized in `drizzle/` directory
- Schema files in `drizzle/schema/` subdirectory
- Generated migrations in `drizzle/migrations/`

### Drizzle ORM Setup

Structure your database layer within your main project:

```typescript
// drizzle/connection.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  max: parseInt(process.env.DATABASE_POOL_SIZE || "10"),
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
});

export const db = drizzle(client, { schema });
```

### Drizzle Kit Configuration

Create a `drizzle.config.ts` in your project root:

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema/*.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

### Schema Design Best Practices

Use proper TypeScript types and constraints:

```typescript
// drizzle/schema/posts.ts
import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    authorId: integer("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for performance
    authorIdIdx: index("posts_author_id_idx").on(table.authorId),
    publishedAtIdx: index("posts_published_at_idx").on(table.publishedAt),
    createdAtIdx: index("posts_created_at_idx").on(table.createdAt),

    // Unique constraints
    slugIdx: uniqueIndex("posts_slug_idx").on(table.slug),
  })
);

// Generate Zod schemas from Drizzle schema
export const insertPostSchema = createInsertSchema(posts, {
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255, "Slug too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().max(500, "Excerpt too long").optional(),
});

export const selectPostSchema = createSelectSchema(posts);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```

### Query Organization

Centralize database queries in dedicated files:

```typescript
// drizzle/queries.ts
import { db } from "./connection";
import { users, posts, eq, desc, and, isNotNull, sql } from "./schema";

export async function getPublishedPosts() {
  return await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      author: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(isNotNull(posts.publishedAt))
    .orderBy(desc(posts.publishedAt));
}

export async function getPostById(id: number) {
  const [post] = await db
    .select({
      id: posts.id,
      title: posts.title,
      slug: posts.slug,
      content: posts.content,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      author: {
        id: users.id,
        name: users.name,
        avatar: users.avatar,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id))
    .limit(1);

  return post;
}

// Relational queries using Drizzle's query API
export async function getUsersWithPosts() {
  return await db.query.users.findMany({
    with: {
      posts: {
        where: (posts, { isNotNull }) => isNotNull(posts.publishedAt),
        orderBy: (posts, { desc }) => desc(posts.publishedAt),
        limit: 5,
      },
    },
    orderBy: (users, { desc }) => desc(users.createdAt),
  });
}
```

### Integration with Server Functions

Integrate Drizzle queries with TanStack Start server functions:

```typescript
// src/db/posts.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getPublishedPosts,
  createPost as createPostQuery,
} from "../../drizzle/queries";
import { insertPostSchema } from "../../drizzle/schema";

export const getPosts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const posts = await getPublishedPosts();
    return { success: true, posts };
  } catch (error) {
    console.error("Error fetching posts:", error);
    return { success: false, error: "Failed to fetch posts" };
  }
});

export const createPost = createServerFn({ method: "POST" })
  .inputValidator(
    insertPostSchema.omit({ id: true, createdAt: true, updatedAt: true })
  )
  .handler(async ({ data }) => {
    try {
      const post = await createPostQuery(data);
      return { success: true, post };
    } catch (error) {
      console.error("Error creating post:", error);
      return { success: false, error: "Failed to create post" };
    }
  });
```

### Migration Management

Use proper migration workflows with unified scripts:

```bash
# Generate migrations from schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# For development only - push schema directly
pnpm db:push

# Seed the database with sample data
pnpm db:seed

# Open Drizzle Studio for database management
pnpm db:studio
```

Add these scripts to your main package.json:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio --port 4983",
    "db:drop": "drizzle-kit drop",
    "db:seed": "tsx drizzle/seed.ts"
  }
}
```

## Error Handling

### Global Error Boundaries

Implement error boundaries at multiple levels:

```tsx
// src/components/ErrorBoundary.tsx
import { ErrorComponent } from "@tanstack/react-router";

export function GlobalErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}
```

### Server Function Error Handling

Handle errors gracefully in server functions:

```typescript
export const getPost = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    try {
      const post = await getPostById(data.id);

      if (!post) {
        throw new Error("Post not found", { cause: { status: 404 } });
      }

      return post;
    } catch (error) {
      console.error("Get post error:", error);

      if (error instanceof Error && error.cause?.status === 404) {
        throw error;
      }

      throw new Error("Failed to fetch post");
    }
  });
```

## Performance Optimization

### Code Splitting

Leverage dynamic imports for route-based code splitting:

```tsx
// src/routes/posts/$postId/edit.tsx
import { lazy } from "react";

const PostEditor = lazy(() => import("@/components/PostEditor"));

export const Route = createFileRoute("/posts/$postId/edit")({
  component: () => (
    <Suspense fallback={<div>Loading editor...</div>}>
      <PostEditor />
    </Suspense>
  ),
});
```

### Database Query Optimization

Use proper indexing and query optimization:

```typescript
// drizzle/schema/posts.ts
import { index, uniqueIndex } from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    // ... columns
  },
  (table) => ({
    // Indexes for performance
    authorIdIdx: index("posts_author_id_idx").on(table.authorId),
    publishedAtIdx: index("posts_published_at_idx").on(table.publishedAt),
    createdAtIdx: index("posts_created_at_idx").on(table.createdAt),

    // Unique constraints
    slugIdx: uniqueIndex("posts_slug_idx").on(table.slug),
  })
);

// Use indexes effectively in queries
export async function getRecentPostsByAuthor(
  authorId: number,
  limit: number = 10
) {
  return await db
    .select()
    .from(posts)
    .where(eq(posts.authorId, authorId)) // Uses posts_author_id_idx
    .orderBy(desc(posts.createdAt)) // Uses posts_created_at_idx
    .limit(limit);
}
```

### Caching Strategies

Implement appropriate caching for server functions:

```typescript
// Simple in-memory cache for development
const cache = new Map();

export const getCachedPosts = createServerFn({ method: "GET" }).handler(
  async () => {
    const cacheKey = "posts";

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const posts = await getPosts();
    cache.set(cacheKey, posts);

    // Clear cache after 5 minutes
    setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000);

    return posts;
  }
);
```

## Security Considerations

### Environment Variable Security

Never expose sensitive data to the client:

```typescript
// ✅ Server-only configuration
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  providers: {
    auth0: {
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET, // Server-only
    },
  },
};

// ✅ Client-safe configuration
export function AuthProvider({ children }) {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      // No client secret here
    >
      {children}
    </Auth0Provider>
  );
}
```

### Input Validation

Always validate inputs with Zod:

```typescript
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export const createUser = createServerFn({ method: "POST" })
  .validator(createUserSchema)
  .handler(async ({ data }) => {
    // data is now type-safe and validated
    const hashedPassword = await bcrypt.hash(data.password, 12);
    // ... create user
  });
```

### SQL Injection Prevention

Use Drizzle's query builder to prevent SQL injection:

```typescript
// ✅ Safe - Uses parameterized queries
export async function getUserPosts(userId: number) {
  return await db.select().from(posts).where(eq(posts.authorId, userId));
}

// ❌ Never do this - SQL injection risk
export async function getUserPostsUnsafe(userId: string) {
  return await db.execute(sql`SELECT * FROM posts WHERE author_id = ${userId}`);
}
```

## Testing Strategies

### Unit Testing Server Functions

Test server functions in isolation:

```typescript
// tests/server-functions/posts.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createPost, getPosts } from "@/db/posts";

describe("Post Server Functions", () => {
  beforeEach(async () => {
    // Setup test database
  });

  it("should create a post", async () => {
    const postData = {
      title: "Test Post",
      content: "Test content",
      authorId: 1,
    };

    const result = await createPost.handler({ data: postData });

    expect(result).toMatchObject({
      title: "Test Post",
      content: "Test content",
    });
  });
});
```

### Integration Testing

Test complete user flows:

```typescript
// tests/integration/posts.test.ts
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createMemoryRouter } from "@tanstack/react-router";

describe("Posts Integration", () => {
  it("should create and display a new post", async () => {
    // Render app with test router
    // Fill form
    // Submit
    // Verify post appears in list
  });
});
```

## Deployment Guidelines

### Docker Configuration

Use multi-stage builds for production:

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000
CMD ["pnpm", "start"]
```

### Environment-Specific Configurations

Use different configurations per environment:

```yaml
# docker-compose.prod.yml
version: "3.8"
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
    ports:
      - "3000:3000"
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Health Checks

Implement health check endpoints:

```typescript
// src/routes/api/health.ts
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/drizzle/connection";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Check database connection
          await db.execute(sql`SELECT 1`);

          return new Response(
            JSON.stringify({
              status: "healthy",
              timestamp: new Date().toISOString(),
              database: "connected",
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              status: "unhealthy",
              error: error.message,
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
```

## Common Pitfalls and Solutions

### 1. HTTP Method Issues

**Problem**: Using PUT/DELETE methods that don't work consistently.

**Solution**: Use POST for all mutations:

```typescript
// ✅ Use POST for all mutations
export const updatePost = createServerFn({ method: "POST" });
export const deletePost = createServerFn({ method: "POST" });
```

### 2. Environment Variable Exposure

**Problem**: Accidentally exposing secrets to the client.

**Solution**: Use proper prefixing and validation:

```typescript
// ✅ Server-only
const secret = process.env.JWT_SECRET;

// ✅ Client-safe
const apiUrl = import.meta.env.VITE_API_URL;
```

### 3. Route Nesting Conflicts

**Problem**: Conflicting route definitions causing rendering issues.

**Solution**: Use proper parent-child relationships:

```tsx
// Parent route: src/routes/posts.tsx
export const Route = createFileRoute("/posts")({
  component: () => <Outlet />, // Important: Use Outlet
});

// Child route: src/routes/posts/index.tsx
export const Route = createFileRoute("/posts/")({
  component: PostsList,
});
```

### 4. Database Connection Issues

**Problem**: Connection failures due to incorrect configuration.

**Solution**: Use proper environment variable loading:

```typescript
// Ensure .env.local takes precedence
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}
```

## Conclusion

TanStack Start provides a powerful foundation for full-stack React applications. Following these best practices will help you build maintainable, performant, and secure applications. Key takeaways:

- Use proper environment variable management with validation
- Structure your project with clear separation of concerns
- Leverage TypeScript and Zod for type safety throughout
- Use POST methods for all server function mutations
- Implement proper error handling at all levels
- Follow security best practices for sensitive data
- Test your application thoroughly
- Use proper deployment strategies with health checks

Remember to stay updated with the TanStack Start documentation as the framework continues to evolve.
