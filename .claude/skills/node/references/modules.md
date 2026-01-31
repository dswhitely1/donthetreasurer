# Node.js Modules Reference

## Contents
- ESM Configuration
- Import Conventions
- Package Management (npm)
- Node Built-in Modules
- Dependency Management
- Anti-Patterns

---

## ESM Configuration

This project uses ESNext modules exclusively. Configured via:

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

All `.ts`, `.tsx` files use `import`/`export`. Config files use `.mjs` extension for ESM:

```
eslint.config.mjs     # ESM config
postcss.config.mjs    # ESM config
next.config.ts        # TypeScript (compiled by Next.js)
```

NEVER use `require()` or `module.exports` in this project.

---

## Import Conventions

### Import Order (enforced by project convention)

```typescript
// 1. React/Next.js
import { NextRequest, NextResponse } from "next/server";

// 2. External packages
import { z } from "zod";
import ExcelJS from "exceljs";

// 3. Internal absolute imports (using @/* alias)
import { createServerClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validations/transaction";

// 4. Relative imports
import { formatCurrency } from "./utils";

// 5. Type-only imports
import type { Transaction, LineItem } from "@/types";
import type { Database } from "@/types/database";

// 6. Style imports (rare in server-side code)
```

### Path Alias

The `@/*` alias maps to project root. ALWAYS use it for cross-directory imports:

```typescript
// GOOD
import { env } from "@/lib/env";

// BAD — fragile relative paths
import { env } from "../../../lib/env";
```

Configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## Package Management (npm)

This project uses **npm** (not pnpm or yarn). The lockfile is `package-lock.json`.

### Key Commands

```bash
# Install all dependencies
npm install

# Add a production dependency
npm install @supabase/supabase-js

# Add a dev dependency
npm install -D vitest

# Remove a dependency
npm uninstall <package>

# Check outdated packages
npm outdated

# Audit for vulnerabilities
npm audit
```

### WARNING: Mixing Package Managers

**The Problem:**

```bash
# BAD — creates yarn.lock alongside package-lock.json
yarn add some-package

# BAD — creates pnpm-lock.yaml
pnpm install
```

**Why This Breaks:** Multiple lockfiles cause version inconsistencies. Vercel deployment uses the detected lockfile — if both `package-lock.json` and `pnpm-lock.yaml` exist, the wrong one may be used, causing production mismatches.

**The Fix:** Stick to `npm` commands exclusively. Delete stray lockfiles if they appear.

---

## Node Built-in Modules

Use the `node:` protocol prefix for all built-in module imports.

### Modules Used in This Project

| Module | Use Case | Example |
|--------|----------|---------|
| `node:crypto` | UUID generation, hashing | `randomUUID()` |
| `node:stream` | Excel streaming export | `PassThrough`, `Readable.toWeb()` |
| `node:buffer` | Binary data for file responses | `Buffer.from()` |
| `node:url` | URL parsing (rarely needed — use `URL` global) | `new URL(str)` |
| `node:path` | File path manipulation (build scripts only) | `path.join()` |

```typescript
// Correct: explicit node: protocol
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

// Incorrect: ambiguous
import { randomUUID } from "crypto";
```

### Modules to AVOID in Server Components

These are NOT available in the Edge Runtime (if ever used):

```typescript
// AVOID in middleware or edge functions
import fs from "node:fs";       // No filesystem in Edge
import child_process from "node:child_process"; // No process spawning
```

Middleware runs in Edge Runtime by default in Next.js. If you need Node.js APIs in middleware, configure it explicitly. See the **nextjs** skill for middleware patterns.

---

## Dependency Management

### Current Dependencies

```json
{
  "dependencies": {
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### Planned Dependencies (from CLAUDE.md)

Install these as implementation progresses:

```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Forms and validation (see zod and react-hook-form skills)
npm install react-hook-form zod @hookform/resolvers

# Server state (see tanstack-query skill)
npm install @tanstack/react-query

# Date handling
npm install date-fns

# Excel export (see exceljs skill)
npm install exceljs

# UI utilities (see tailwind and frontend-design skills)
npm install class-variance-authority clsx tailwind-merge lucide-react
```

### WARNING: Missing `server-only` Package

**Detected:** No `server-only` package in dependencies.
**Impact:** Server-only code (containing secrets, database admin clients) can accidentally be imported into client components without any build error.

**Recommended Solution:**

```bash
npm install server-only
```

**Why This Matters:** Without `server-only`, importing `lib/supabase/server.ts` (which uses `SUPABASE_SERVICE_ROLE_KEY`) from a client component silently bundles the secret into the client JavaScript. The `server-only` package makes this a build-time error.

```typescript
// lib/supabase/server.ts
import "server-only"; // Build error if imported from "use client" file

export function createAdminClient() {
  // Safe: this code can never reach the browser
}
```

---

## Dependency Install Workflow

Copy this checklist when adding new dependencies:

- [ ] Run `npm install <package>` (production) or `npm install -D <package>` (dev)
- [ ] Verify `package-lock.json` was updated (not a different lockfile)
- [ ] Check the package exports types (`@types/<package>` needed?)
- [ ] Run `npm run build` to verify no type or build errors
- [ ] If build fails, check import syntax and TypeScript compatibility
- [ ] Only proceed when build passes cleanly
