# Node.js Types Reference

## Contents
- @types/node Configuration
- Built-in Node.js Types
- Process and Environment Types
- Buffer and Stream Types
- Web API Types in Node.js
- Anti-Patterns

---

## @types/node Configuration

This project uses `@types/node ^20` (devDependency). The `tsconfig.json` includes `"lib": ["dom", "dom.iterable", "esnext"]` which provides browser APIs alongside Node.js types. See the **typescript** skill for full tsconfig details.

```json
// tsconfig.json (relevant sections)
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

Node.js global types (`Buffer`, `process`, `__dirname`) are available in server-side files. In client components (`"use client"`), avoid Node.js-specific APIs — they don't exist in the browser.

---

## Built-in Node.js Types

### Common Types Used in This Project

```typescript
// Buffer — binary data for Excel export
import type { Buffer } from "node:buffer";

// URL and URLSearchParams — already global in Node 18+
const url = new URL(request.url);

// Process types
const nodeVersion: string = process.version;
const env: NodeJS.ProcessEnv = process.env;
```

### Node Protocol Imports

ALWAYS use the `node:` protocol prefix for built-in modules. It makes intent explicit and avoids confusion with npm packages of the same name.

```typescript
// GOOD
import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { Buffer } from "node:buffer";

// BAD — ambiguous, could be npm package
import { randomUUID } from "crypto";
```

---

## Process and Environment Types

### Typing Environment Variables

`process.env` values are `string | undefined`. The **zod** skill covers runtime validation. For TypeScript, extend the type:

```typescript
// types/env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    NODE_ENV: "development" | "production" | "test";
  }
}
```

This eliminates `string | undefined` widening on known env vars. But this is a **lie** if the var is actually missing at runtime — pair with runtime validation in `lib/env.ts`.

### WARNING: Trusting ProcessEnv Type Augmentation Alone

**The Problem:**

```typescript
// BAD - Type says string, but could be undefined at runtime
declare namespace NodeJS {
  interface ProcessEnv {
    MY_SECRET: string; // TypeScript trusts this
  }
}
// No runtime check — crashes when MY_SECRET is missing
const secret = process.env.MY_SECRET; // TypeScript says: string
```

**Why This Breaks:** Type augmentation only affects compile time. If the env var is missing at runtime, you get `undefined` despite TypeScript saying `string`. The app crashes at the point of use, not at startup.

**The Fix:** Combine type augmentation with runtime validation:

```typescript
// lib/env.ts — validates at import time
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

---

## Buffer and Stream Types

### Buffer for Binary Responses

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ExcelJS writeBuffer returns Buffer (Node.js)
async function exportReport(): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();
  // ... populate workbook ...

  // writeBuffer() returns ExcelJS.Buffer which extends ArrayBuffer
  const buffer = await workbook.xlsx.writeBuffer();

  // NextResponse accepts Buffer, ArrayBuffer, or ReadableStream
  return new NextResponse(buffer as Buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
```

### Readable Stream Types

```typescript
import { Readable, PassThrough } from "node:stream";

// Convert Node.js ReadableStream to Web ReadableStream for NextResponse
function nodeToWebStream(nodeStream: Readable): ReadableStream {
  return Readable.toWeb(nodeStream) as ReadableStream;
}
```

---

## Web API Types in Node.js

Next.js API Routes use Web Standard APIs (`Request`, `Response`, `Headers`). These are global in Node 18+ and typed via `lib: ["dom"]` in tsconfig.

```typescript
// These are Web API types, NOT Node.js-specific
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // request.nextUrl — Next.js extension of URL
  // request.headers — standard Headers API
  // request.cookies — Next.js extension
  const authHeader = request.headers.get("authorization");

  return NextResponse.json({ data: [] });
}
```

### WARNING: Mixing Node.js and Web API Response Types

**The Problem:**

```typescript
// BAD - Using Node.js http.ServerResponse in App Router
import type { ServerResponse } from "node:http";

export async function GET(req: NextRequest, res: ServerResponse) {
  res.writeHead(200); // This doesn't work in App Router
}
```

**Why This Breaks:** App Router API Routes use Web Standard `Request`/`Response`. The `res` parameter from Pages Router (`http.ServerResponse`) doesn't exist. This is a compile error or runtime crash.

**The Fix:** Always return a `NextResponse` or `Response` from App Router route handlers. See the **nextjs** skill for API Route patterns.

---

## Type-Only Imports

ALWAYS use `import type` for types that don't exist at runtime:

```typescript
// GOOD — stripped at compile time, no runtime import
import type { NextConfig } from "next";
import type { Buffer } from "node:buffer";

// BAD — imports the module at runtime just for a type
import { NextConfig } from "next";
```

This is enforced by `"verbatimModuleSyntax"` if enabled, and is a convention in this project. See the **typescript** skill for import conventions.
