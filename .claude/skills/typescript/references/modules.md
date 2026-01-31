# TypeScript Modules Reference

## Contents
- Module Resolution in This Project
- Import Order Convention
- Path Alias Usage
- Module Boundaries by Layer
- WARNING: Circular Dependencies
- WARNING: Barrel File Performance
- Server vs Client Module Separation
- Re-Exporting Patterns

## Module Resolution in This Project

The tsconfig.json uses `"moduleResolution": "bundler"` with `"module": "esnext"`. This is the correct setting for Next.js — it supports `package.json` `exports` fields and does not require file extensions in imports.

```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./*"] }
  }
}
```

## Import Order Convention

Enforced by convention per CLAUDE.md. Follow this exact order with blank lines between groups:

```typescript
// 1. React/Next.js imports
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// 2. External packages
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// 3. Internal absolute imports (via @/* alias)
import { createClient } from "@/lib/supabase/client";
import { TransactionForm } from "@/components/forms/transaction-form";
import { useTransactions } from "@/hooks/use-transactions";

// 4. Relative imports
import { columns } from "./columns";

// 5. Type-only imports
import type { Transaction, TransactionStatus } from "@/types";
import type { Database } from "@/types/database";

// 6. Style imports (rare — most styling is Tailwind classes)
import "./styles.css";
```

## Path Alias Usage

The `@/*` alias maps to the project root. Use it for all non-relative imports.

```typescript
// GOOD — absolute path via alias
import { cn } from "@/lib/utils";
import type { Organization } from "@/types";

// BAD — fragile relative paths that break when files move
import { cn } from "../../../lib/utils";
import type { Organization } from "../../types";
```

Use relative imports only for files in the same directory or immediate subdirectories:

```typescript
// OK — same directory
import { columns } from "./columns";
import { StatusBadge } from "./status-badge";
```

## Module Boundaries by Layer

Each directory serves a specific role. Do not import across boundaries in the wrong direction.

```
types/          → Pure types, no runtime code. Imported by everything.
lib/            → Utilities, Supabase clients, validation schemas. No React.
hooks/          → React hooks. Import from lib/ and types/.
components/ui/  → Primitive UI components (shadcn). No domain logic.
components/     → Domain components. Import from hooks/, lib/, types/, ui/.
app/            → Route handlers and pages. Import from everything above.
```

**Dependency direction (allowed imports):**

```
app/ → components/ → hooks/ → lib/ → types/
                         ↘      ↗
                          lib/
```

```typescript
// GOOD — component imports from hooks and types
import { useTransactions } from "@/hooks/use-transactions";
import type { Transaction } from "@/types";

// BAD — hook imports from a component (wrong direction)
import { TransactionForm } from "@/components/forms/transaction-form";
```

## WARNING: Circular Dependencies

**The Problem:**

```typescript
// lib/supabase/server.ts
import { validateTransaction } from "@/lib/validations/transaction";

// lib/validations/transaction.ts
import { createClient } from "@/lib/supabase/server"; // CIRCULAR
```

**Why This Breaks:**
1. Module evaluation order becomes undefined — one module gets `undefined` imports
2. Next.js bundler may silently produce broken builds
3. Debugging is extremely difficult — errors appear unrelated to the actual cause

**The Fix:**

Extract shared logic into a third module, or restructure so dependencies flow one way:

```typescript
// lib/validations/transaction.ts — pure validation, no Supabase import
import { z } from "zod";
export const transactionSchema = z.object({ /* ... */ });

// lib/actions/transaction.ts — orchestrates both
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validations/transaction";
```

## WARNING: Barrel File Performance

**The Problem:**

```typescript
// components/index.ts — re-exports everything
export { TransactionForm } from "./forms/transaction-form";
export { TransactionTable } from "./tables/transactions-table";
export { Header } from "./layout/header";
export { Sidebar } from "./layout/sidebar";
// ... 50 more exports
```

```typescript
// Importing one component pulls in the entire barrel
import { StatusBadge } from "@/components";
```

**Why This Breaks:**
1. Next.js cannot tree-shake barrel files in all cases, especially with Server Components
2. Server-only code can leak into client bundles through barrel re-exports
3. Build times increase as every barrel consumer processes every export

**The Fix:**

Import directly from the source file:

```typescript
// GOOD — direct import, only loads what's needed
import { StatusBadge } from "@/components/ui/status-badge";
import { TransactionForm } from "@/components/forms/transaction-form";
```

Barrel files are acceptable only in `types/index.ts` where there is no runtime code.

## Server vs Client Module Separation

Next.js App Router requires strict separation. A module is server-only or client-only based on its usage context.

```typescript
// lib/supabase/server.ts — server-only, uses cookies
import "server-only"; // Add this import to enforce boundary

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
```

```typescript
// lib/supabase/client.ts — client-only, runs in browser
"use client"; // Not needed on lib files, but the consumers will be client components

import { createBrowserClient } from "@supabase/ssr";
```

See the **nextjs** skill for detailed Server/Client Component patterns.

**Rule:** Never import from `lib/supabase/server.ts` in a file marked `"use client"`. The build will fail.

## Re-Exporting Patterns

Use the types barrel for convenient domain type access:

```typescript
// types/index.ts — acceptable barrel for pure types
export type { Database } from "./database";

export type TransactionStatus = "uncleared" | "cleared" | "reconciled";
export type TransactionType = "income" | "expense";
export type AccountType = "checking" | "savings" | "paypal" | "cash" | "other";

// Re-export generated table types with friendly names
import type { Database } from "./database";
type Tables = Database["public"]["Tables"];

export type Transaction = Tables["transactions"]["Row"];
export type TransactionInsert = Tables["transactions"]["Insert"];
export type Organization = Tables["organizations"]["Row"];
export type Account = Tables["accounts"]["Row"];
export type Category = Tables["categories"]["Row"];
export type LineItem = Tables["transaction_line_items"]["Row"];
```

This is the ONE place where a barrel file is fine — no runtime code, only type re-exports.
