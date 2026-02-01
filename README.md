# Treasurer

A financial management web application for treasurers of 501(c)(3) nonprofit organizations. Manage bookkeeping across multiple organizations, track transactions across various accounts, categorize with a two-level hierarchy supporting split transactions, and generate Excel reports for board meetings and audits.

## Features

- **Multi-organization support** — manage finances for multiple nonprofits from a single account
- **Account management** — checking, savings, PayPal, cash, and other account types with opening balances
- **Transaction entry** — income and expense tracking with date, vendor, description, check number, and status lifecycle (Uncleared → Cleared → Reconciled)
- **Split transactions** — allocate a single transaction across multiple categories with line items that must sum to the total
- **Two-level categories** — parent/subcategory hierarchy, typed as income or expense, defined per organization
- **Processing fees** — auto-generate companion fee transactions for income on accounts with fee configuration
- **Excel reports** — export `.xlsx` workbooks with transaction details grouped by account and status, plus a summary sheet with category breakdowns and account balances
- **Report filtering** — filter by date range (cleared date), account, category, and status with starting/ending balance computation
- **Dark mode** — automatic theme based on system preference

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | [TypeScript 5](https://www.typescriptlang.org) (strict mode) |
| UI | [React 19](https://react.dev), [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS 4](https://tailwindcss.com) |
| Database | [Supabase](https://supabase.com) (PostgreSQL with Row Level Security) |
| Auth | [Supabase Auth](https://supabase.com/auth) (JWT) |
| State | [TanStack Query 5](https://tanstack.com/query) |
| Forms | [React Hook Form 7](https://react-hook-form.com) + [Zod 4](https://zod.dev) |
| Excel | [ExcelJS 4](https://github.com/exceljs/exceljs) |
| Testing | [Vitest 4](https://vitest.dev) + [Testing Library](https://testing-library.com) |

## Getting Started

### Prerequisites

- Node.js 18+
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

4. Run database migrations against your Supabase project. Migration files are in `supabase/migrations/`.

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

## Architecture

Next.js App Router application with Supabase as the backend. Server Components fetch data directly. Server Actions handle mutations. API Routes serve non-HTML responses (Excel export). Data access is secured at the database level with PostgreSQL Row Level Security policies.

### Data Model

```
Treasurer (1) → (Many) Organizations → (Many) Accounts → (Many) Transactions → (Many) Line Items
Organization (1) → (Many) Categories (parent/child hierarchy, typed as income or expense)
```

### Project Structure

```
app/
  (auth)/              Auth pages (login, register)
  (dashboard)/         Protected pages (organizations, accounts,
                       categories, transactions, reports, settings)
  api/                 API routes (Excel export)
components/
  ui/                  shadcn/ui primitives
  layout/              Dashboard shell, header, sidebar, org switcher
  forms/               Domain form components
hooks/                 TanStack Query hooks + query key factory
lib/
  supabase/            Client factories (browser, server, middleware)
  validations/         Zod schemas per entity
  reports/             Report data fetching and computation
  excel/               ExcelJS workbook generation
types/                 Generated Supabase database types
supabase/
  migrations/          SQL migration files
```

## License

[MIT](LICENSE)
