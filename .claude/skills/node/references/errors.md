# Node.js Error Handling Reference

## Contents
- Error Handling in Server Actions
- Error Handling in API Routes
- Environment and Startup Errors
- Supabase Error Patterns
- Process-Level Error Handling
- Anti-Patterns

---

## Error Handling in Server Actions

Server Actions throw errors that Next.js catches and surfaces via the nearest `error.tsx` boundary. See the **nextjs** skill for error boundary setup.

### Typed Error Responses

```typescript
"use server";

import { createServerClient } from "@/lib/supabase/server";

type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export async function createOrganization(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string }>> {
  const supabase = await createServerClient();
  const name = formData.get("name") as string;

  if (!name?.trim()) {
    return { data: null, error: "Organization name is required" };
  }

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
```

### WARNING: Throwing Raw Errors from Server Actions

**The Problem:**

```typescript
// BAD - Exposes internal details to client
export async function deleteOrg(id: string) {
  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) throw error; // Supabase error object exposed to browser
}
```

**Why This Breaks:**
1. Supabase errors may contain table names, column names, constraint details
2. Error serialization across server/client boundary is unpredictable
3. Stack traces from server appear in client console

**The Fix:** Return discriminated union results, map internal errors to user-facing messages:

```typescript
// GOOD
export async function deleteOrg(id: string): Promise<ActionResult<void>> {
  const { error } = await supabase.from("organizations").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return { data: null, error: "Cannot delete organization with existing accounts" };
    }
    console.error("deleteOrg failed:", error);
    return { data: null, error: "Failed to delete organization" };
  }

  return { data: undefined, error: null };
}
```

---

## Error Handling in API Routes

API Routes return HTTP responses. NEVER let exceptions propagate unhandled.

```typescript
// app/api/reports/export/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      );
    }

    const buffer = await generateReport(startDate, endDate);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (err) {
    console.error("Export failed:", err);
    return NextResponse.json(
      { error: "Report generation failed" },
      { status: 500 }
    );
  }
}
```

---

## Environment and Startup Errors

Fail fast when required configuration is missing. Validate at module load time, not at first use.

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

// Throws ZodError at import time if any var is missing
export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
```

### WARNING: Lazy Environment Validation

**The Problem:**

```typescript
// BAD - Fails on first API call, not at startup
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing URL"); // First user request fails
}
```

**Why This Breaks:** The app starts and appears healthy. The error surfaces only when a user hits this endpoint, making it look like a runtime bug instead of a deployment configuration issue.

**The Fix:** Validate all env vars at module load time (see pattern above). The build or server startup fails immediately with a clear error message.

---

## Supabase Error Patterns

Supabase client returns `{ data, error }` instead of throwing. NEVER ignore the error field.

### Common Error Codes

| PostgreSQL Code | Supabase Context | User Message |
|----------------|-----------------|--------------|
| `23505` | Unique constraint violation | "This name already exists" |
| `23503` | Foreign key violation | "Cannot delete: related records exist" |
| `42501` | RLS policy violation | "You don't have access to this resource" |
| `PGRST116` | Row not found (`.single()`) | "Record not found" |

```typescript
// Map Supabase errors to user-friendly messages
function mapSupabaseError(error: { code: string; message: string }): string {
  switch (error.code) {
    case "23505":
      return "A record with this name already exists";
    case "23503":
      return "Cannot delete: this record is referenced elsewhere";
    case "42501":
      return "You don't have permission for this action";
    case "PGRST116":
      return "Record not found";
    default:
      console.error("Unhandled Supabase error:", error);
      return "An unexpected error occurred";
  }
}
```

### WARNING: Ignoring Supabase Error Field

**The Problem:**

```typescript
// BAD - Ignores error, uses potentially null data
const { data } = await supabase.from("transactions").select("*");
return data.map(formatTransaction); // Crashes if data is null
```

**Why This Breaks:** When RLS blocks the query or the table doesn't exist, `data` is `null` and `error` contains the details. Calling `.map()` on `null` throws a generic `TypeError` with no useful context.

**The Fix:**

```typescript
// GOOD - Always check error first
const { data, error } = await supabase.from("transactions").select("*");
if (error) {
  console.error("Failed to load transactions:", error);
  return { data: null, error: mapSupabaseError(error) };
}
return { data: data.map(formatTransaction), error: null };
```

---

## Process-Level Error Handling

### Unhandled Rejection Logging

Next.js handles most process-level errors. For custom server-side utilities, ensure promises don't silently fail:

```typescript
// GOOD - Always await or .catch() promises
async function batchUpdateStatuses(ids: string[], status: string) {
  const results = await Promise.allSettled(
    ids.map((id) =>
      supabase
        .from("transactions")
        .update({ status })
        .eq("id", id)
    )
  );

  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );

  if (failures.length > 0) {
    console.error(`${failures.length} status updates failed:`, failures);
  }

  return {
    succeeded: results.filter((r) => r.status === "fulfilled").length,
    failed: failures.length,
  };
}
```

### WARNING: Unhandled Promise in Event-Style Code

**The Problem:**

```typescript
// BAD - Fire-and-forget async call
export async function POST(request: NextRequest) {
  const data = await request.json();
  await saveTransaction(data);

  // Fire-and-forget — if this rejects, nobody catches it
  sendNotification(data.organizationId);

  return NextResponse.json({ success: true });
}
```

**Why This Breaks:** Unhandled promise rejections crash the Node.js process in strict mode. Even without strict mode, the error is logged but never surfaced to the caller. In production, this causes intermittent failures.

**The Fix:** Either await with error handling or explicitly catch and log:

```typescript
// GOOD - Catch and log fire-and-forget operations
sendNotification(data.organizationId).catch((err) => {
  console.error("Notification failed:", err);
});
```

---

## Debugging Checklist

Copy this checklist when debugging server-side Node.js errors:
- [ ] Check terminal output (Next.js dev server logs server errors there)
- [ ] Verify `.env.local` exists with all required variables
- [ ] Check Supabase dashboard for RLS policy errors (Auth > Logs)
- [ ] Run `npm run build` to surface TypeScript errors
- [ ] Check `node --version` is 18+
- [ ] Clear `.next` cache: `rm -rf .next`
- [ ] If error persists, add `console.error` at the failure point and reproduce
