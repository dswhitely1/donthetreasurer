# Six Feature Requests — Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Overview

Six feature requests for the Treasurer app addressing report accuracy, reconciliation flexibility, and UI usability.

---

## Feature 1: Report Dates in User's Local Timezone

### Problem

`getNextDay()` in `lib/reports/report-utils.ts` parses dates with `T00:00:00Z` (UTC), while `formatDate()` in `lib/utils.ts` parses with `T00:00:00` (local). This inconsistency can cause off-by-one date errors for users west of UTC. Report date parameters are conceptual calendar dates (YYYY-MM-DD), not UTC timestamps.

### Solution

Normalize `getNextDay()` to use local date math instead of UTC. Replace:

```typescript
const d = new Date(dateStr + "T00:00:00Z");
d.setUTCDate(d.getUTCDate() + 1);
return d.toISOString().split("T")[0];
```

Use `date-fns` (already in the tech stack) to avoid any timezone pitfalls:

```typescript
import { addDays, format } from "date-fns";

export function getNextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), 1), "yyyy-MM-dd");
}
```

The Postgres DATE comparisons in `fetchReportData` are already timezone-neutral (comparing YYYY-MM-DD strings), so no query changes needed.

### Files Changed

- `lib/reports/report-utils.ts` — Fix `getNextDay()` to use `date-fns` local date math
- `lib/reports/report-utils.test.ts` — Update/add tests

---

## Feature 2: Edit Cleared Date on Reconciled Transactions

### Problem

Reconciled transactions are fully locked from editing. When a user reconciles transactions without checking bank statements, the `cleared_at` dates default to `new Date().toISOString()` instead of actual statement dates. There is no way to correct this without un-reconciling.

### Solution

Add a dedicated `updateClearedDate()` server action that only works on reconciled transactions, following the precedent set by `reassignLineItemCategories()` which already allows category changes on reconciled transactions.

### Implementation

- **Server action** `updateClearedDate()` in `app/(dashboard)/organizations/[orgId]/transactions/actions.ts`:
  - Validates transaction exists and is reconciled
  - Accepts a new `cleared_at` date
  - Updates only the `cleared_at` field
  - Calls `revalidatePath()`

- **UI**: Add an editable cleared date cell in the transaction table for reconciled transactions, or a small edit button next to the cleared date that opens a date picker popover.

### Validation Schema

```typescript
z.object({
  transaction_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  cleared_at: z.string().date(), // YYYY-MM-DD format, converted to ISO timestamp in action
})
```

**Note:** The existing inline edit path (`inlineUpdateTransaction`) is intentionally left unchanged — its reconciled guard protects all other fields. The new `updateClearedDate()` action is a separate, narrowly-scoped path. The action converts the YYYY-MM-DD input to a full ISO timestamp (appending `T00:00:00.000Z`) before saving, matching the existing `cleared_at` storage format.

### Files Changed

- `app/(dashboard)/organizations/[orgId]/transactions/actions.ts` — New `updateClearedDate()` action
- `app/(dashboard)/organizations/[orgId]/transactions/transaction-table.tsx` — Editable cleared date for reconciled rows
- `lib/validations/transaction.ts` — New schema for cleared date update

---

## Feature 3: Reconcile Months With No Transactions

### Problem

The "Finish Reconciliation" button requires `checkedIds.size > 0`. If an account's starting balance equals the statement ending balance and no transactions occurred, the user cannot complete the reconciliation session. This is a valid accounting scenario.

### Solution

Allow finishing a reconciliation session with zero transactions when the difference is zero (balanced).

### Implementation

- **Validation schema** `finishReconciliationSchema` in `lib/validations/reconciliation.ts`: Change `transaction_ids` from `.min(1, ...)` to allow empty string (`.default("")` or `.optional()`).

- **Server action** `finishReconciliation()`: When `transactionIds` is empty after splitting, verify server-side that `session.starting_balance === session.statement_ending_balance` before allowing completion. Do NOT trust a client-sent balance flag — recompute from the session record. When balanced with zero transactions, complete the session with `transaction_count: 0`.

- **UI** `reconcile-matching-view.tsx`: Enable the "Finish Reconciliation" button when `isBalanced` is true, regardless of `checkedIds.size`. Update the button disabled condition from `!isBalanced || checkedIds.size === 0` to `!isBalanced`. Add a confirmation dialog when finishing with no transactions selected: "No transactions were selected. Are you sure the account balance is correct?"

### Files Changed

- `lib/validations/reconciliation.ts` — Allow empty `transaction_ids`
- `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/actions.ts` — Server-side balance verification for zero-transaction completion
- `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/[sessionId]/reconcile-matching-view.tsx` — Update button disabled condition + confirmation dialog

---

## Feature 4: Choose Date Type for Reports

### Problem

The current report filtering uses a complex OR condition mixing `cleared_at` and `transaction_date`. Users want to explicitly choose which date drives the report.

### Solution

Add a `date_mode` parameter with two options:

- **`"transaction_date"`** — Filter all transactions by `transaction_date` within the date range. Simple, shows when the transaction occurred regardless of clearing status.
- **`"cleared_date"`** — Current behavior: cleared/reconciled filtered by `cleared_at`, uncleared filtered by `transaction_date` on or before end date. Useful for cash-basis accounting.

Default: `"cleared_date"` (preserves current behavior — existing bookmarked URLs and saved reports behave the same).

### Implementation

- **Validation**: Add `date_mode` to `reportParamsSchema` as `z.enum(["transaction_date", "cleared_date"]).default("cleared_date")`

- **Data fetching**: Branch the query filter logic in `fetchReportData()`:
  - `transaction_date` mode: Simple `.gte("transaction_date", startDate).lt("transaction_date", endDateExclusive)` with optional status filter. **Balance computation** also uses `transaction_date` — starting balance = sum of all transactions with `transaction_date < startDate`, ending balance = starting + period net.
  - `cleared_date` mode: Current complex OR logic (preserved as-is), including current balance computation using `cleared_at`.

- **UI**: Add a select/toggle to report filters labeled "Date basis" with options "Transaction Date" and "Cleared Date"

- **Export routes**: Pass `date_mode` through to `fetchReportData()` from both Excel and PDF export endpoints. Include the active date mode in the report header (e.g., "Date basis: Transaction Date") so exported reports are unambiguous.

### Dependency

Feature 1 (timezone fix) must be completed first — Feature 4 uses `getNextDay()` in its query logic.

### Files Changed

- `lib/validations/report.ts` — Add `date_mode` field
- `lib/reports/fetch-report-data.ts` — Branch query logic
- Report filter UI component — Add date mode selector
- `app/api/organizations/[orgId]/reports/export/route.ts` — Pass through param
- `app/api/organizations/[orgId]/reports/export-pdf/route.ts` — Pass through param

---

## Feature 5: Fix "(root)" Category Label in Reports

### Problem

When a parent category has no subcategories, `buildCategorySummaries()` creates a child entry labeled `"(root)"`. This looks confusing in reports. The total should display next to the parent category name directly.

### Current Behavior

```
Supplies (bold)
  (root)  $100.00
```

### Desired Behavior

```
Supplies  $100.00
```

If the category has actual subcategories, keep the current grouped display with subtotals.

### Solution

Fix at the data layer in `buildCategorySummaries()`: when a parent category has exactly one child labeled `"(root)"`, collapse it so the parent's `children` array is empty and the `subtotal` represents the flat total. This fixes all consumers (Excel, PDF, and any future formats) in one place. The Excel and PDF generators then render groups with empty children as a single flat row.

### Files Changed

- `lib/reports/report-utils.ts` — Collapse single-root groups in `buildCategorySummaries()`
- `lib/excel/generate-report.ts` — Render collapsed groups as flat rows
- `lib/pdf/generate-report.ts` — Render collapsed groups as flat rows
- `lib/reports/report-utils.test.ts` — Test the root collapse behavior

---

## Feature 6: Collapsible Dashboard Sidebar

### Problem

The fixed 16rem (264px) sidebar reduces usable width for content-heavy pages like the transactions table, which has many columns. On laptops this forces horizontal scrolling.

### Solution

Add a collapse toggle that shrinks the sidebar to an icon-only rail (~64px / w-16). Persist the collapsed state in `localStorage`.

### Implementation

- **Sidebar state**: `useState` initialized with default (expanded), synced to `localStorage` via `useEffect` on mount to avoid SSR hydration mismatch. Default: expanded.

- **Collapsed sidebar**: Icons only, no text labels. Navigation items show tooltips on hover via shadcn Tooltip. Organization name hidden. Collapse toggle button at the sidebar bottom (chevron-left to collapse, chevron-right to expand). All interactive elements remain keyboard-accessible with visible focus indicators.

- **Main content**: Adjusts automatically since it uses `flex-1`.

- **Animation**: CSS transition on sidebar width (`transition-all duration-200`).

- **Mobile**: No change — mobile already uses overlay sidebar.

### Files Changed

- `components/layout/sidebar.tsx` — Collapse state, icon-only mode, toggle button, tooltips
- `components/layout/dashboard-shell.tsx` — Pass collapsed state, adjust layout if needed

---

## Implementation Order

1. Feature 5 — Root category label fix (smallest, display-only)
2. Feature 1 — Timezone fix (small, correctness)
3. Feature 3 — Empty reconciliation (small logic fix)
4. Feature 2 — Edit cleared date (new action + UI)
5. Feature 4 — Date mode for reports (medium, multi-layer)
6. Feature 6 — Collapsible sidebar (medium, UI)
