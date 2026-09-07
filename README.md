# Treasurer

A financial management web application for treasurers of 501(c)(3) nonprofit organizations. Manage bookkeeping across multiple organizations, track transactions across various accounts, categorize with a two-level hierarchy supporting split transactions, reconcile against bank statements, and generate Excel and PDF reports for board meetings and audits.

## Features

### Core bookkeeping

- **Multi-organization support** — manage finances for multiple nonprofits from a single account
- **Account management** — checking, savings, PayPal, cash, and other account types with opening balances
- **Transaction entry** — income and expense tracking with date, vendor, description, check number, and status lifecycle (Uncleared → Cleared → Reconciled)
- **Split transactions** — allocate a single transaction across multiple categories with line items that must sum to the total
- **Two-level categories** — parent/subcategory hierarchy defined per organization, with merging that reassigns history atomically
- **Processing fees** — auto-generate companion fee transactions for income on accounts with fee configuration
- **Recurring templates** — weekly, bi-weekly, monthly, quarterly, or annual schedules that can be paused, resumed, and generated from
- **Bank reconciliation** — multi-step sessions that compute a starting balance from the last completed session, match transactions against a statement, and lock reconciled entries from editing
- **Receipt attachments** — JPEG, PNG, WebP, or PDF up to 5MB per transaction, stored in a private bucket and served through signed URLs

### Reporting

- **Excel export** — `.xlsx` workbooks with transaction details grouped by account and status, plus a summary sheet of category breakdowns and account balances
- **PDF export** — the same report pipeline rendered as a landscape PDF
- **Report filtering** — by date range, account, category, and status, with starting and ending balance computation
- **Fiscal year presets** — current and previous fiscal year, quarters, and fiscal year to date, derived from each organization's fiscal year start month
- **Budgets** — per-category budget line items compared against actuals in both the Excel and PDF reports

### Program tracking (optional per organization)

- **Seasons and students** — enrollments with per-student fee overrides and payment history
- **Letter templates** — a reusable library with a validated placeholder vocabulary, scoped by letter type
- **Balance letters** — one printable PDF page per family who still owes season fees
- **Sponsors and sponsorship levels** — configurable levels with default amounts that prefill and stay editable
- **Sponsorship deposit queue** — log each check, cash, or PayPal sponsorship as it arrives, then turn a selection into one deposit transaction with a split line per sponsor, matching how the deposit posts on the bank statement
- **Acknowledgment letters** — 501(c)(3) receipts for sponsors, batched by sponsorship year

### Interface

- **Dark mode** — automatic theme based on system preference

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | [TypeScript 5](https://www.typescriptlang.org) (strict mode) |
| UI | [React 19](https://react.dev), [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS 4](https://tailwindcss.com) |
| Database | [Supabase](https://supabase.com) (PostgreSQL with Row Level Security) |
| Auth | [Supabase Auth](https://supabase.com/auth) (JWT) |
| Storage | [Supabase Storage](https://supabase.com/docs/guides/storage) (private bucket, signed URLs) |
| Forms | React `useActionState` + Server Actions, validated with [Zod 4](https://zod.dev) |
| State | [TanStack Query 5](https://tanstack.com/query) |
| Excel | [ExcelJS 4](https://github.com/exceljs/exceljs) |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) |
| Dates | [date-fns 4](https://date-fns.org) |
| Testing | [Vitest 4](https://vitest.dev) + [Testing Library](https://testing-library.com) |

Forms are plain HTML `<form>` elements bound to Server Actions through `useActionState`. There is no client-side form library.

## Getting Started

### Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/treasurer.git
   cd treasurer
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file with your Supabase credentials:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. Apply the database migrations in `supabase/migrations/`, in filename order, with `npx supabase db push`.

   New migrations must use `gen_random_uuid()` rather than `uuid_generate_v4()`. The `uuid-ossp` extension lives in the `extensions` schema, which the Supabase SQL Editor has on its `search_path` but `db push` does not.

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build with TypeScript checking |
| `npm run lint` | Run ESLint |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

Run a single test file with `npx vitest run lib/balances.test.ts`.

## Architecture

Next.js App Router application with Supabase as the backend. Server Components fetch data directly. Server Actions handle mutations, validated with Zod. API Routes serve only non-HTML responses — Excel and PDF exports, letter PDFs, and signed storage URLs. Data access is secured at the database level with PostgreSQL Row Level Security policies enforcing the ownership chain from treasurer down to line item.

Optional subsystems are gated per organization by feature flags (`seasons_enabled`, `sponsors_enabled`), re-checked server-side in every page and action rather than only hidden from navigation.

### Data Model

```
Treasurer (1) → (Many) Organizations → (Many) Accounts → (Many) Transactions → (Many) Line Items
Organization (1) → (Many) Categories (parent/child hierarchy)
Organization (1) → (Many) Recurring Templates → (Many) Template Line Items
Organization (1) → (Many) Budgets → (Many) Budget Line Items
Organization (1) → (Many) Letter Templates (typed: season balance or sponsor acknowledgment)
Account (1) → (Many) Reconciliation Sessions
Transaction (1) → (Many) Receipts
Line Item (Many) → (1) Category

Seasons (optional):
Organization (1) → (Many) Seasons, (Many) Students
Season + Student → Season Enrollment → (Many) Season Payments

Sponsors (optional):
Organization (1) → (Many) Sponsors, (Many) Sponsor Levels
Sponsor (1) → (Many) Sponsorships → (0..1) Transaction   [the deposit; null means queued]
```

Twenty tables in total. A sponsorship row is both the sponsorship and the single payment that created it; it sits in the deposit queue exactly while its `transaction_id` is null.

### Project Structure

```
app/
  (auth)/              Auth pages (login, register)
  (dashboard)/         Protected pages — organizations, accounts, categories,
                       transactions, templates, budgets, reports, reconciliation,
                       seasons, students, letter templates, sponsors, settings
  api/                 Excel/PDF exports, letter PDFs, signed receipt URLs
components/
  ui/                  shadcn/ui primitives
  layout/              Dashboard shell, header, sidebar, org switcher
hooks/                 TanStack Query hooks + query key factory
lib/
  supabase/            Client factories (browser, server, middleware)
  validations/         Zod schemas per entity
  reports/             Report data fetching and computation
  excel/               ExcelJS workbook generation
  pdf/                 jsPDF report and letter generation
  letters/             Placeholder vocabulary and template rendering
  seasons/             Season report computation
  sponsors/            Sponsorship term arithmetic and feature guard
  transactions/        Shared transaction helpers (processing-fee companion)
  categories/          Category tree and merge helpers
types/                 Generated Supabase database types
supabase/
  migrations/          SQL migration files
```

## License

[MIT](LICENSE)
