# Node.js Patterns Reference

## Contents
- Async Patterns in Server Context
- Environment Variable Management
- Binary Data and Streaming
- Crypto and UUID Generation
- Server-Side Date Handling
- Anti-Patterns

---

## Async Patterns in Server Context

All server-side code in this project (Server Actions, API Routes, middleware) runs in Node.js. Use `async/await` exclusively — never callbacks.

### Server Action Pattern

```typescript
// app/(dashboard)/organizations/actions.ts
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createOrganization(formData: FormData) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: formData.get("name") as string })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/organizations");
  return data;
}
```

### Parallel Async Operations

```typescript
// Fetch multiple independent resources concurrently
async function loadOrgDashboard(orgId: string) {
  const supabase = await createServerClient();

  const [accounts, categories, recentTransactions] = await Promise.all([
    supabase.from("accounts").select("*").eq("organization_id", orgId),
    supabase.from("categories").select("*").eq("organization_id", orgId),
    supabase
      .from("transactions")
      .select("*, transaction_line_items(*)")
      .eq("account_id", orgId)
      .order("transaction_date", { ascending: false })
      .limit(10),
  ]);

  return { accounts, categories, recentTransactions };
}
```

### WARNING: Sequential Awaits for Independent Operations

**The Problem:**

```typescript
// BAD - Sequential when operations are independent
const accounts = await supabase.from("accounts").select("*");
const categories = await supabase.from("categories").select("*");
const transactions = await supabase.from("transactions").select("*");
```

**Why This Breaks:** Three sequential network round-trips instead of one parallel batch. For Supabase queries averaging 50ms each, this is 150ms vs ~50ms.

**The Fix:**

```typescript
// GOOD - Parallel with Promise.all
const [accounts, categories, transactions] = await Promise.all([
  supabase.from("accounts").select("*"),
  supabase.from("categories").select("*"),
  supabase.from("transactions").select("*"),
]);
```

---

## Environment Variable Management

### Access Pattern

```typescript
// GOOD - Validate once, use everywhere
// lib/env.ts
const requiredServerVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

type EnvKey = (typeof requiredServerVars)[number];

function getEnv(key: EnvKey): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}
```

### WARNING: Accessing `process.env` Without Validation

**The Problem:**

```typescript
// BAD - Silent undefined, runtime crash later
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// url is string | undefined — crashes at supabase.from() call, not here
```

**Why This Breaks:** The error surfaces deep in Supabase SDK internals instead of at the point where the env var is missing. Debugging this is painful.

**The Fix:** Use the **zod** skill to validate env vars at module load time. See `lib/env.ts` pattern above.

### WARNING: Leaking Server Secrets to Client

**The Problem:**

```typescript
// BAD - NEXT_PUBLIC_ prefix exposes to browser bundle
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Why This Breaks:** The `NEXT_PUBLIC_` prefix tells Next.js to inline the value into the client JavaScript bundle. Service role keys bypass RLS — exposing this gives full database access to anyone inspecting the page source.

**The Fix:** NEVER prefix server-only secrets with `NEXT_PUBLIC_`. Use `SUPABASE_SERVICE_ROLE_KEY` and access only in Server Actions, API Routes, or server components.

---

## Binary Data and Streaming

The Excel export API Route (`app/api/reports/export/route.ts`) produces binary data. See the **exceljs** skill for workbook generation details.

### Buffer Response Pattern

```typescript
// API Route returning binary file
export async function GET(request: NextRequest) {
  const workbook = new ExcelJS.Workbook();
  // ... build workbook ...

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

### Streaming Large Reports

For reports with 10,000+ transactions (per PRD performance requirement):

```typescript
// Use Node.js streams for memory-efficient Excel generation
import { PassThrough } from "node:stream";

export async function GET(request: NextRequest) {
  const stream = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream });

  // Write rows incrementally — doesn't hold entire workbook in memory
  const sheet = workbook.addWorksheet("Transactions");
  for await (const batch of fetchTransactionBatches(orgId)) {
    for (const txn of batch) {
      sheet.addRow(formatRow(txn)).commit();
    }
  }

  await workbook.commit();
  return new NextResponse(stream as unknown as ReadableStream);
}
```

---

## Crypto and UUID Generation

Use Node.js built-in `crypto` for server-side ID generation when not relying on Supabase `uuid_generate_v4()`:

```typescript
import { randomUUID } from "node:crypto";

// Generate correlation IDs for logging
const requestId = randomUUID();
```

---

## Server-Side Date Handling

Use `date-fns` (planned dependency) for date manipulation. NEVER use `new Date()` for date-only values without handling timezone.

```typescript
import { format, parseISO } from "date-fns";

// Transaction dates are DATE (no time component) in PostgreSQL
// Always parse as ISO string, format for display
const displayDate = format(parseISO("2025-01-15"), "MM/dd/yyyy");
```

---

## Build and Dev Workflow

Copy this checklist when troubleshooting build issues:
- [ ] Verify Node.js 18+ with `node --version`
- [ ] Clear `.next` cache: `rm -rf .next`
- [ ] Reinstall deps: `rm -rf node_modules && npm install`
- [ ] Run lint: `npm run lint`
- [ ] Run build: `npm run build`
- [ ] If build fails, fix issues and repeat build
- [ ] Only proceed when build passes cleanly
