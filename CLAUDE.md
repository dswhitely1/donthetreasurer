# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Treasurer is a financial management web app for treasurers of 501(c)(3) nonprofit organizations. It supports managing multiple organizations, tracking transactions across accounts, two-level categorization with split transactions, recurring transaction templates, bank reconciliation, receipt attachments, and generating Excel/PDF reports. See `docs/PRD.md` for the full product requirements.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (also runs TypeScript checking)
npm run lint         # ESLint (flat config, next/core-web-vitals + next/typescript)
npm test             # Run all tests (vitest run)
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
npx vitest run lib/balances.test.ts   # Run a single test file
```

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind CSS 4 · Supabase (PostgreSQL + Auth + RLS + Storage) · shadcn/ui · TanStack Query 5 · React Hook Form 7 · Zod 4 · ExcelJS 4 · jsPDF + jspdf-autotable · date-fns 4 · Vitest 4

## Architecture

### Data Flow Pattern

**Server Components** (default) fetch data directly via Supabase server client. **Server Actions** (`"use server"` files colocated with pages) handle all mutations with Zod validation, `revalidatePath()`, and `redirect()`. **API Routes** are only used for non-HTML responses (Excel/PDF export, signed storage URLs). **Client Components** use TanStack Query hooks for data fetching.

### Authentication & Authorization

- Supabase Auth with JWT tokens, managed via `@supabase/ssr`
- Three Supabase client factories: browser (`lib/supabase/client.ts`), server (`lib/supabase/server.ts`), middleware (`lib/supabase/middleware.ts`)
- Always use `getUser()` (validates JWT), never `getSession()` (reads from storage without validation)
- `middleware.ts` at project root calls `updateSession()` on every request — redirects unauthed users to `/login`, authed users away from auth pages
- Dashboard layout (`(dashboard)/layout.tsx`) checks auth and auto-creates treasurer profile on first login
- RLS policies enforce the ownership chain at the database level: Treasurer → Organizations → Accounts → Transactions → Line Items

### Route Groups

- `(auth)/` — Public pages: login, register
- `(dashboard)/` — Protected pages: everything else. Wrapped in `Providers` (React Query) and `DashboardShell` (header + sidebar + org switcher)

### Server Actions Pattern

Actions live in `actions.ts` files colocated with their route segment (e.g., `organizations/[orgId]/transactions/actions.ts`). Each action:
1. Validates input with Zod
2. Calls `createClient()` for server-side Supabase
3. Returns `{ error: string }` or `null` on success
4. Calls `revalidatePath()` then `redirect()` after mutations

### Report System

Reports use a special date filtering model:
- **Uncleared transactions** are always included regardless of date range
- **Cleared/reconciled transactions** are filtered by `cleared_at` timestamp against the date range
- Running balances and account starting/ending balances are computed only when not filtering by category
- Fiscal year presets (`lib/fiscal-year.ts`) provide configurable date ranges (current/previous FY, quarters, fiscal YTD) based on organization's `fiscal_year_start_month`
- Both Excel and PDF exports share the same `ReportData` pipeline (`fetchReportData` + `reportParamsSchema`)
- Excel export generates two worksheets: Transactions (grouped by account → status) and Summary (category breakdowns + account balances)
- PDF export generates a landscape PDF with the same structure using jsPDF + jspdf-autotable

### Bank Reconciliation

Multi-step workflow in `organizations/[orgId]/accounts/[accountId]/reconcile/`:
- User enters statement date and ending balance, system computes starting balance from last completed session
- Matching view shows uncleared/cleared transactions for the account; user toggles transactions to reconcile
- Quick transaction creation dialog allows adding missing transactions during reconciliation
- On completion, matched transactions are marked as reconciled (locked from editing)
- Sessions tracked in `reconciliation_sessions` table with status lifecycle: `in_progress` → `completed` | `cancelled`

### Recurring Templates

Templates for regularly scheduled transactions in `organizations/[orgId]/templates/`:
- Five recurrence rules: weekly, bi-weekly, monthly, quarterly, annually
- Templates can be paused/resumed and have optional end dates
- `next_occurrence_date` tracks when the next transaction should be generated
- Generating from a template creates a real transaction and advances `next_occurrence_date`
- Template line items mirror transaction line items (category + amount + memo)

### Receipt Attachments

File attachments on transactions using Supabase Storage:
- Supported types: JPEG, PNG, WebP, PDF (max 5MB)
- Files stored in a private bucket; access via signed URL endpoint (`/api/organizations/[orgId]/receipts/[receiptId]/url`)
- RLS enforced through the ownership chain (receipt → transaction → account → organization → treasurer)

### Key Modules

| Module | Purpose |
|--------|---------|
| `lib/supabase/` | Three client factories (browser, server, middleware) |
| `lib/validations/` | Zod schemas per entity (transaction, account, category, organization, report, reconciliation, receipt, recurring-template) |
| `lib/reports/` | Report data fetching, utilities, and types |
| `lib/excel/` | ExcelJS workbook generation |
| `lib/pdf/` | jsPDF + jspdf-autotable PDF report generation |
| `lib/fiscal-year.ts` | Fiscal year date range presets and label generation |
| `lib/recurrence.ts` | Recurring transaction date arithmetic (next occurrence calculation) |
| `lib/balances.ts` | Running balance and account balance computation |
| `lib/utils.ts` | `cn()`, `formatCurrency()`, `formatDate()`, `formatDateTime()` |
| `hooks/` | TanStack Query hooks per entity + centralized `query-keys.ts` |
| `components/ui/` | shadcn/ui primitives |
| `components/layout/` | Dashboard shell, header, sidebar, org switcher |
| `types/database.ts` | Auto-generated Supabase types (`npx supabase gen types typescript`) |

### Domain Model

```
Treasurer (1) → (Many) Organizations → (Many) Accounts → (Many) Transactions → (Many) Line Items
Organization (1) → (Many) Categories (parent/child, typed as income or expense)
Organization (1) → (Many) Recurring Templates → (Many) Template Line Items
Account (1) → (Many) Reconciliation Sessions
Transaction (1) → (Many) Receipts (file attachments)
Line Item (Many) → (1) Category
```

**Transaction status lifecycle:** Uncleared → Cleared → Reconciled (reconciled = locked from editing). The `cleared_at` timestamp is set when status changes from uncleared.

**Split transactions:** A single transaction has multiple line items, each with a category, amount, and optional memo. Line item amounts must sum to the transaction total (enforced via Zod validation).

**Processing fees:** Accounts can have fee configuration (`fee_percentage`, `fee_flat_amount`, `fee_category_id`). When creating income on a fee-configured account, the system auto-creates a companion expense transaction for the fee.

## Development Guidelines

### Naming Conventions

- **Files:** kebab-case (`transaction-form.tsx`, `use-transactions.ts`). Route files lowercase (`page.tsx`, `layout.tsx`, `route.ts`)
- **Code:** Components PascalCase, functions/variables camelCase, constants SCREAMING_SNAKE_CASE, booleans `is`/`has`/`should` prefix
- **Database enums:** lowercase snake_case strings (`'uncleared'`, `'income'`, `'checking'`)

### Import Order

1. React/Next.js  2. External packages  3. Internal absolute (`@/lib/`, `@/components/`, `@/hooks/`)  4. Relative  5. Type-only (`import type`)  6. Styles

### TypeScript

- Strict mode, `Readonly<>` for component props, `import type` for type-only imports
- Database types generated from Supabase, form types inferred from Zod (`z.infer<>`)
- `as const` arrays for domain enums, not TS `enum`
- Path alias: `@/*` maps to project root

### Styling

- Tailwind CSS v4 with `@import "tailwindcss"` syntax (not v3 `@tailwind` directives)
- CSS custom properties for theme values in `globals.css`
- Dark mode via `prefers-color-scheme` and `dark:` variant

### Next.js 16

- `params` and `searchParams` in page components are `Promise` types — always `await` them

## Database

PostgreSQL via Supabase. Ten tables: `treasurers`, `organizations`, `accounts`, `categories`, `transactions`, `transaction_line_items`, `reconciliation_sessions`, `recurring_templates`, `recurring_template_line_items`, `receipts`. Migrations in `supabase/migrations/`. Key constraints:

- Line item sum = transaction total (application-level Zod)
- Categories with transactions cannot be deleted (`ON DELETE RESTRICT`)
- `updated_at` auto-managed by triggers
- Accounts have optional fee config fields (`fee_percentage`, `fee_flat_amount`, `fee_category_id`)
- Receipts limited to 5MB per file (`file_size` CHECK constraint)
- `merge_categories` RPC handles atomic category merging with hard-delete and cross-hierarchy support

## Environment Variables

Create `.env.local`:

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Service role key for admin ops |

## Testing

Vitest 4 with jsdom, `@testing-library/react`, setup file at `test/setup.ts`. Tests are colocated with source files (`*.test.ts`). Coverage targets `lib/`, `hooks/`, `app/**/actions.ts`, `app/**/route.ts`, and `components/`.

## Skill Usage Guide

When working on tasks involving these technologies, invoke the corresponding skill:

| Skill | Invoke When |
|-------|-------------|
| nextjs | App Router pages, Server Actions, API Routes, middleware |
| react | Components, hooks, client-side state |
| typescript | Type safety, interfaces, type inference |
| tailwind | Styling with Tailwind CSS v4 |
| supabase | Database queries, auth, RLS policies, migrations |
| tanstack-query | Server state caching, query hooks |
| react-hook-form | Form state, validation integration |
| zod | Schema validation for forms and API inputs |
| exceljs | Excel report generation |
| frontend-design | UI design with shadcn/ui, layouts, dark mode |
| node | Node.js runtime, environment, build issues |
