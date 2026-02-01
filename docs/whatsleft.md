# What's Left to Do

## What's Fully Implemented

All the core CRUD features are built and working:

- **Auth** - Login/register with Supabase Auth
- **Database** - All 6 tables, indexes, RLS policies, triggers (3 migration files)
- **Organizations** - Full CRUD, listing, detail page with navigation
- **Accounts** - Full CRUD, create/edit/detail pages
- **Categories** - Hierarchical CRUD with parent/child, type enforcement
- **Transactions** - Full CRUD with split line items, Zod validation
- **Transaction Table** - Sortable columns, filters (account/date/status/category), expandable rows, bulk actions (clear/reconcile/delete), status icons, running balance, split tooltip, export button
- **Reports** - Filter UI, in-browser preview with summary cards, category breakdowns, transaction detail table
- **Excel Export** - API route with Transactions + Summary sheets, proper formatting
- **Layout** - Header, sidebar, org switcher, dashboard shell
- **Infrastructure** - TanStack Query hooks, Zod schemas, Supabase clients (browser/server/middleware), dark mode, shadcn/ui

## What's Left

### Must-address items

1. **Dashboard page is bare** - Currently just shows org cards. PRD 7.1 calls for summary cards (total balance across accounts, uncleared/cleared/reconciled balances), a recent transactions list (last 10), and quick-action buttons (Add Transaction, View Reports, Manage Categories). This needs an active org context.

2. **Middleware → Proxy migration** - Build warns: `"middleware" file convention is deprecated. Please use "proxy" instead.` Next.js 16 renamed this.

3. **No `loading.tsx` / `error.tsx` files** - No route-segment loading or error boundaries exist anywhere. Users see nothing during server-side data fetches.

4. **No pagination** - The transaction list loads all records at once. PRD specifies `?page` and `?limit` query params (default 50 per page).

### Should-have items (from PRD)

5. **Settings page** - Listed in PRD route structure but doesn't exist. Could be minimal (profile name, logout).

6. **Account balance display** - PRD ACC-004: "System shall display current balance for each account" on the accounts list page. Currently shows account info but not computed balance.

7. **Category rename/merge** - PRD CAT-005 (Should Have).

### Nice-to-have / Polish

8. **Inline editing** on the transaction list (PRD 7.3 mentions it, but click-to-edit-page works fine).

9. **Testing** - Zero tests. CLAUDE.md mentions Vitest/Playwright but nothing is configured.

### Not needed for v1 (Could Have in PRD)

- Recurring transaction templates (TXN-011)
- Receipt attachments (TXN-012)
- Balance reconciliation reports (RPT-006)
- Year-to-date / fiscal year views (RPT-007)
