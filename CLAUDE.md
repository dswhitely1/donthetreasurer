# Treasurer

A financial management web application for treasurers of 501(c)(3) nonprofit organizations. Enables managing bookkeeping across multiple organizations, tracking transactions across various accounts, implementing custom two-level categorization with split transactions, and generating Excel reports for board meetings and audits.

See @docs/PRD.md for the full product requirements document.

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 18+ | Server and build runtime |
| Framework | Next.js | 16.x | App Router with Server Actions and API Routes |
| Language | TypeScript | 5.x | Strict mode enabled |
| UI Library | React | 19.x | Component rendering |
| Styling | Tailwind CSS | 4.x | Utility-first CSS via `@tailwindcss/postcss` |
| Linting | ESLint | 9.x | Flat config with next/core-web-vitals + next/typescript |
| Fonts | Geist + Geist Mono | — | Via `next/font/google` |
| Database | Supabase PostgreSQL | — | Managed PostgreSQL with RLS (planned) |
| Auth | Supabase Auth | — | JWT-based authentication (planned) |
| UI Components | shadcn/ui | — | Component library (planned) |
| State | TanStack Query | — | Server state management (planned) |
| Forms | React Hook Form + Zod | — | Form handling and validation (planned) |
| Excel Export | ExcelJS | — | .xlsx report generation (planned) |

## Quick Start

```bash
# Prerequisites: Node.js 18+, npm

# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Lint
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

Current state (scaffolded, pre-implementation):

```
treasurer/
├── app/
│   ├── globals.css          # Tailwind v4 import + CSS custom properties
│   ├── layout.tsx           # Root layout with Geist fonts
│   ├── page.tsx             # Landing page (default template)
│   └── favicon.ico
├── public/                  # Static assets (SVGs)
├── docs/
│   └── PRD.md               # Product Requirements Document (v1.3)
├── eslint.config.mjs        # ESLint 9 flat config
├── next.config.ts           # Next.js configuration (currently empty)
├── postcss.config.mjs       # PostCSS with @tailwindcss/postcss
├── tsconfig.json            # TypeScript strict mode, @/* path alias
└── package.json
```

Planned structure per PRD (Section 11):

```
app/
├── (auth)/                  # Auth route group
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/             # Dashboard route group (protected)
│   ├── layout.tsx
│   ├── page.tsx             # Dashboard home
│   ├── organizations/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [orgId]/
│   │       ├── page.tsx
│   │       ├── accounts/page.tsx
│   │       ├── categories/page.tsx
│   │       ├── transactions/
│   │       │   ├── page.tsx
│   │       │   └── new/page.tsx
│   │       └── reports/page.tsx
│   └── settings/page.tsx
├── api/
│   └── reports/export/route.ts   # Excel export endpoint
├── layout.tsx
└── globals.css
components/
├── ui/                      # shadcn/ui primitives
├── forms/                   # Domain form components
├── tables/                  # Data table components
└── layout/                  # Header, sidebar, org-switcher
lib/
├── supabase/                # Supabase client (browser + server + middleware)
├── validations/             # Zod schemas
└── utils.ts
hooks/                       # React Query hooks
types/                       # TypeScript types (includes generated Supabase types)
supabase/
├── migrations/              # SQL migration files
└── config.toml
```

## Architecture Overview

Next.js App Router application with Supabase as the backend-as-a-service layer. Authentication is handled by Supabase Auth with JWT tokens. Data access is secured at the database level using PostgreSQL Row Level Security (RLS) policies, ensuring treasurers can only access their own organizations and related data.

The data model has a clear ownership chain: Treasurer -> Organizations -> Accounts -> Transactions -> Line Items, with Categories defined per-organization. Transactions support split categorization through line items, where the sum of line item amounts must equal the transaction total (enforced by a database trigger).

Server Actions handle data mutations. API Routes handle operations returning non-HTML responses (Excel export). Client-side state management uses TanStack Query for server state caching and React Context for UI state like the active organization.

### Domain Model

```
Treasurer (1) ──── manages ────> (Many) Organizations
Organization (1) ── contains ──> (Many) Accounts
Organization (1) ── defines ───> (Many) Categories (parent/child hierarchy)
Account (1) ─────── holds ─────> (Many) Transactions
Transaction (1) ─── contains ──> (Many) Line Items
Line Item (Many) ── references ─> (1) Category
```

### Key Domain Concepts

| Concept | Description |
|---------|-------------|
| Organization | A 501(c)(3) nonprofit entity with its own accounts, categories, and transactions |
| Account | A financial account (checking, savings, PayPal, cash, other) within an organization |
| Category | Two-level hierarchy (parent/subcategory), typed as income or expense |
| Transaction | Income or expense entry with date, amount, description, status, and split line items |
| Line Item | Category allocation within a transaction; amounts must sum to transaction total |
| Status | Uncleared → Cleared → Reconciled lifecycle; reconciled transactions are locked from editing |

## Development Guidelines

### File Naming
- Next.js route files: lowercase (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`)
- Component files: kebab-case (`transaction-form.tsx`, `org-switcher.tsx`)
- Hook files: kebab-case with `use-` prefix (`use-transactions.ts`, `use-organizations.ts`)
- Utility/lib files: kebab-case (`utils.ts`, `client.ts`, `server.ts`)
- Validation schemas: kebab-case matching entity (`transaction.ts` in `lib/validations/`)

### Code Naming
- Components/classes: PascalCase (`TransactionForm`, `OrgSwitcher`)
- Functions/variables: camelCase (`handleSubmit`, `transactionData`)
- Constants: SCREAMING_SNAKE_CASE (`MAX_LINE_ITEMS`, `ACCOUNT_TYPES`)
- Boolean variables: `is`/`has`/`should` prefix (`isActive`, `hasLineItems`)
- React hooks: camelCase with `use` prefix (`useTransactions`, `useOrganizations`)
- Types/interfaces: PascalCase (`Transaction`, `Organization`, `LineItem`)
- Database enum values: lowercase snake_case strings (`'uncleared'`, `'income'`, `'checking'`)

### Import Order
1. React/Next.js imports
2. External packages (`@supabase/supabase-js`, `zod`, etc.)
3. Internal absolute imports (`@/lib/...`, `@/components/...`, `@/hooks/...`)
4. Relative imports
5. Type-only imports (using `import type`)
6. Style imports

### Path Aliases
- `@/*` maps to project root (configured in `tsconfig.json`)

### TypeScript
- Strict mode is enabled
- Use `type` keyword for type-only imports: `import type { Metadata } from "next"`
- Use `Readonly<>` for component props
- Module resolution: `bundler`

### Styling
- Tailwind CSS v4 uses `@import "tailwindcss"` syntax (not v3 `@tailwind` directives)
- CSS custom properties for theme values (defined in `globals.css`)
- Dark mode via `prefers-color-scheme` media query and Tailwind `dark:` variant
- Fonts exposed as CSS variables: `--font-geist-sans`, `--font-geist-mono`

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint (next/core-web-vitals + next/typescript) |

## Environment Variables

No `.env` files exist yet. Create `.env.local` with the variables below when setting up Supabase.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Supabase service role key for admin operations |

## Database

PostgreSQL via Supabase with Row Level Security. Six tables with the ownership chain enforced by RLS policies:

- `treasurers` — user profiles (extends Supabase `auth.users`)
- `organizations` — nonprofit entities managed by a treasurer
- `accounts` — financial accounts within an organization
- `categories` — two-level income/expense categorization per organization
- `transactions` — financial transactions with status lifecycle
- `transaction_line_items` — category allocations (split transactions)

Key constraints:
- Line item amounts must sum to transaction total (database trigger)
- Categories with transactions cannot be deleted (`ON DELETE RESTRICT`)
- `updated_at` auto-managed by database triggers on all tables

Database migrations live in `supabase/migrations/`. Types generated via `supabase gen types typescript`. See @docs/PRD.md Section 11 for the complete SQL schema.

## Testing

No testing framework is configured. When adding tests:
- Vitest or Jest for unit/integration tests
- Playwright or Cypress for E2E tests
- Co-locate test files with source (`*.test.ts` / `*.test.tsx`)

## Deployment

- **Hosting**: Vercel (recommended for Next.js)
- **Database**: Supabase (managed PostgreSQL)
- No CI/CD pipeline or Docker configuration exists yet

## Current State

This project is in its **initial scaffolding phase**. Only the default `create-next-app` template exists. The PRD in @docs/PRD.md is the source of truth for planned features, architecture, API design, and database schema. No application-specific code, database migrations, or Supabase configuration has been implemented yet.


## Skill Usage Guide

When working on tasks involving these technologies, invoke the corresponding skill:

| Skill | Invoke When |
|-------|-------------|
| zod | Validates schemas, forms, and API requests with Zod TypeScript-first validation |
| supabase | Manages Supabase PostgreSQL, authentication, RLS policies, and server/client SDKs |
| exceljs | Generates .xlsx Excel reports with formatting, worksheets, and data export |
| tanstack-query | Handles server state management, caching, and data synchronization with TanStack Query |
| typescript | Enforces strict TypeScript type safety, interfaces, and type inference patterns |
| tailwind | Styles applications using Tailwind CSS v4 with @import syntax and custom properties |
| react-hook-form | Manages form state, validation, and submission with React Hook Form integration |
| frontend-design | Designs UIs with Tailwind CSS v4, shadcn/ui components, and CSS custom properties |
| react | Manages React components, hooks, and client-side state with strict mode TypeScript |
| node | Configures Node.js 18+ runtime for server execution and build processes |
| nextjs | Builds App Router applications with Server Actions, API Routes, and Next.js-specific patterns |
