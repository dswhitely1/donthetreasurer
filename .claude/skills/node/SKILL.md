---
name: node
description: |
  Configures Node.js 18+ runtime for server execution and build processes.
  Use when: working with environment variables, Node.js built-in modules (Buffer, Stream, crypto), async patterns in Server Actions, npm dependency management, or debugging build and runtime errors.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Node.js Skill

Node.js 18+ runtime for Next.js server execution and build. Environment variables validated at startup. Built-in modules (Buffer, Stream) used for Excel export. Async patterns in Server Actions and API Routes. ESM module system with `"moduleResolution": "bundler"`.

## Quick Start

### Environment Variable Access

```typescript
// lib/env.ts
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const env = {
  SUPABASE_URL: getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};
```

### Buffer for Excel Export

```typescript
// In API Route
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
// ... build workbook
const buffer = await workbook.xlsx.writeBuffer();

return new NextResponse(buffer, {
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
});
```

### Async Error Handling in Server Actions

```typescript
"use server";

export async function createTransaction(data: unknown) {
  try {
    const supabase = await createClient();
    const { data: txn, error } = await supabase.from("transactions").insert(data).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: txn };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| Runtime | Node.js 18+ (required for Next.js 16) |
| Module system | ESM with `"moduleResolution": "bundler"` |
| Env vars | `NEXT_PUBLIC_*` for client, plain names for server-only |
| Async | `async/await` throughout, `Promise.all` for parallel ops |
| Buffer | `writeBuffer()` for Excel binary data |
| `server-only` | Import guard to prevent server code in client bundles |

## See Also

- [patterns](references/patterns.md) — Async patterns, env vars, streaming, binary data
- [types](references/types.md) — @types/node config, Buffer/Stream types, ProcessEnv typing
- [modules](references/modules.md) — ESM config, import order, npm management
- [errors](references/errors.md) — Server Action errors, API Route errors, Supabase error mapping

## Related Skills

- See the **nextjs** skill for Server Actions and API Routes
- See the **typescript** skill for strict mode and type safety
- See the **supabase** skill for server client setup
- See the **exceljs** skill for Excel report generation
- See the **zod** skill for input validation at server boundaries

## Documentation Resources

> Fetch latest Node.js documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "node.js"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/nodejs_api`

**Recommended Queries:**
- "Node.js Buffer binary data handling"
- "Node.js environment variables best practices"
- "Node.js async await error handling"
- "Node.js ESM module system"
