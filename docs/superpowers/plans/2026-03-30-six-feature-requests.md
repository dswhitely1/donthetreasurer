# Six Feature Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 feature requests covering report timezone fix, editable cleared dates on reconciled transactions, zero-transaction reconciliation, report date mode selection, root category label fix, and collapsible sidebar.

**Architecture:** Each feature is independent and committed separately. Features 1-5 are backend/logic changes with minimal UI. Feature 6 is a pure UI change. Feature 4 depends on Feature 1 (both touch date logic in reports).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Supabase, shadcn/ui, TanStack Query 5, Zod 4, ExcelJS, jsPDF, date-fns 4, Vitest 4, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-30-six-feature-requests-design.md`

---

### Task 1: Fix "(root)" Category Label in Reports

**Files:**
- Modify: `lib/reports/report-utils.ts:40-73`
- Modify: `lib/reports/report-utils.test.ts:100-161`
- Modify: `lib/excel/generate-report.ts:516-531`
- Modify: `lib/pdf/generate-report.ts:476-497`

- [ ] **Step 1: Update existing root category test to expect new behavior**

In `lib/reports/report-utils.test.ts`, replace the test at lines 147-156 ("handles root category (no parent)"):

```typescript
  it("collapses root category (no parent) to flat row with no children", () => {
    const result = buildCategorySummaries(
      { c4: 500 },
      nameMap,
      parentMap
    );
    expect(result).toHaveLength(1);
    expect(result[0].parentName).toBe("Grants");
    expect(result[0].children).toHaveLength(0);
    expect(result[0].subtotal).toBe(500);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: FAIL — `children` has length 1, not 0

- [ ] **Step 3: Update buildCategorySummaries to collapse single-root groups**

In `lib/reports/report-utils.ts`, replace lines 64-72 (the return statement in `buildCategorySummaries`):

```typescript
  return Object.entries(parentGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([parentName, group]) => {
      const children = Object.entries(group.children)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, total]) => ({ name, total }));
      const subtotal = children.reduce((sum, c) => sum + c.total, 0);

      // Collapse: if the only child is "(root)", show as flat parent row
      if (children.length === 1 && children[0].name === "(root)") {
        return { parentName, children: [], subtotal };
      }

      return { parentName, children, subtotal };
    });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Update Excel generator to handle collapsed groups**

In `lib/excel/generate-report.ts`, find the income category loop (around line 520-531). Change both income and expense category rendering blocks. The pattern is the same for both — replace the inner loop:

For income (around lines 520-531):
```typescript
    for (const group of summary.incomeByCategory) {
      // Collapsed root: single flat row
      if (group.children.length === 0) {
        writeAmountRow(rightRow, 4, group.parentName, group.subtotal, { color: "FF16A34A" });
        rightRow++;
        continue;
      }
      writeLabelRow(rightRow, 4, group.parentName, { bold: true });
      rightRow++;
      for (const child of group.children) {
        writeAmountRow(rightRow, 4, child.name, child.total, { indent: true, color: "FF16A34A" });
        rightRow++;
      }
      if (group.children.length > 1) {
        writeAmountRow(rightRow, 4, "Subtotal:", group.subtotal, { indent: true, italic: true, color: "FF16A34A" });
        rightRow++;
      }
    }
```

For expenses (around lines 539-550):
```typescript
    for (const group of summary.expensesByCategory) {
      // Collapsed root: single flat row
      if (group.children.length === 0) {
        writeAmountRow(rightRow, 4, group.parentName, group.subtotal, { color: "FFDC2626" });
        rightRow++;
        continue;
      }
      writeLabelRow(rightRow, 4, group.parentName, { bold: true });
      rightRow++;
      for (const child of group.children) {
        writeAmountRow(rightRow, 4, child.name, child.total, { indent: true, color: "FFDC2626" });
        rightRow++;
      }
      if (group.children.length > 1) {
        writeAmountRow(rightRow, 4, "Subtotal:", group.subtotal, { indent: true, italic: true, color: "FFDC2626" });
        rightRow++;
      }
    }
```

- [ ] **Step 7: Update PDF generator to handle collapsed groups**

In `lib/pdf/generate-report.ts`, apply the same pattern. For income (around lines 478-496):

```typescript
    for (const group of summary.incomeByCategory) {
      // Collapsed root: single flat row
      if (group.children.length === 0) {
        incomeRows.push([
          group.parentName,
          { content: formatCurrency(group.subtotal), styles: { textColor: GREEN } },
        ]);
        continue;
      }
      incomeRows.push([
        { content: group.parentName, styles: { fontStyle: "bold" } },
        "",
      ]);
      for (const child of group.children) {
        incomeRows.push([
          `  ${child.name}`,
          { content: formatCurrency(child.total), styles: { textColor: GREEN } },
        ]);
      }
      if (group.children.length > 1) {
        incomeRows.push([
          { content: "  Subtotal:", styles: { fontStyle: "italic" } },
          { content: formatCurrency(group.subtotal), styles: { fontStyle: "italic", textColor: GREEN } },
        ]);
      }
    }
```

For expenses (around lines 504-521):
```typescript
    for (const group of summary.expensesByCategory) {
      // Collapsed root: single flat row
      if (group.children.length === 0) {
        expenseRows.push([
          group.parentName,
          { content: formatCurrency(group.subtotal), styles: { textColor: RED } },
        ]);
        continue;
      }
      expenseRows.push([
        { content: group.parentName, styles: { fontStyle: "bold" } },
        "",
      ]);
      for (const child of group.children) {
        expenseRows.push([
          `  ${child.name}`,
          { content: formatCurrency(child.total), styles: { textColor: RED } },
        ]);
      }
      if (group.children.length > 1) {
        expenseRows.push([
          { content: "  Subtotal:", styles: { fontStyle: "italic" } },
          { content: formatCurrency(group.subtotal), styles: { fontStyle: "italic", textColor: RED } },
        ]);
      }
    }
```

- [ ] **Step 8: Run all tests and verify build**

Run: `npx vitest run lib/reports/report-utils.test.ts && npm run build`
Expected: ALL PASS, build succeeds

- [ ] **Step 9: Commit**

```bash
git add lib/reports/report-utils.ts lib/reports/report-utils.test.ts lib/excel/generate-report.ts lib/pdf/generate-report.ts
git commit -m "fix: collapse root category to flat row when no subcategories exist

Categories without subcategories now display as a single row with the
total next to the parent name, instead of showing a '(root)' child."
```

---

### Task 2: Fix Report Dates Timezone (getNextDay)

**Files:**
- Modify: `lib/reports/report-utils.ts:1-7`
- Modify: `lib/reports/report-utils.test.ts:13-41`

- [ ] **Step 1: Add timezone edge case test**

In `lib/reports/report-utils.test.ts`, add inside the `getNextDay` describe block (after line 41):

```typescript
  it("does not shift dates near timezone boundaries", () => {
    // These dates could shift if parsed as UTC and displayed as local
    expect(getNextDay("2025-03-09")).toBe("2025-03-10"); // US DST spring forward
    expect(getNextDay("2025-11-02")).toBe("2025-11-03"); // US DST fall back
  });
```

- [ ] **Step 2: Run test to verify current implementation passes (baseline)**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: PASS (current UTC implementation happens to work for these specific dates, but the fix prevents edge cases in other timezones)

- [ ] **Step 3: Replace getNextDay with date-fns implementation**

In `lib/reports/report-utils.ts`, replace lines 1-7:

```typescript
import { addDays, format } from "date-fns";

import type { ReportTransaction, ReportCategorySummary, ReportSummary } from "./types";

export function getNextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), 1), "yyyy-MM-dd");
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run build to check no import issues**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add lib/reports/report-utils.ts lib/reports/report-utils.test.ts
git commit -m "fix: use local date math in getNextDay to prevent timezone shifts

Replaces UTC-based date arithmetic with date-fns local date math.
Report dates are conceptual calendar dates, not UTC timestamps."
```

---

### Task 3: Allow Reconciliation With Zero Transactions

**Files:**
- Modify: `lib/validations/reconciliation.ts:17-21`
- Modify: `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/actions.ts:106-215`
- Modify: `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/[sessionId]/reconcile-matching-view.tsx:115-121,224`

- [ ] **Step 1: Update Zod schema to allow empty transaction_ids**

In `lib/validations/reconciliation.ts`, replace line 20:

```typescript
  transaction_ids: z.string().default(""),
```

- [ ] **Step 2: Update finishReconciliation to verify balance server-side**

In `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/actions.ts`, replace lines 152-171 (the session verification and transaction_ids splitting):

```typescript
  // Verify session exists and is in_progress
  const { data: session } = await supabase
    .from("reconciliation_sessions")
    .select("id, status, starting_balance, statement_ending_balance")
    .eq("id", parsed.data.session_id)
    .eq("account_id", parsed.data.account_id)
    .single();

  if (!session) {
    return { error: "Reconciliation session not found." };
  }

  if (session.status !== "in_progress") {
    return { error: "This reconciliation session is no longer in progress." };
  }

  const transactionIds = parsed.data.transaction_ids.split(",").filter(Boolean);

  // Allow zero transactions only when starting balance matches statement ending balance
  if (transactionIds.length === 0) {
    const startBal = Number(session.starting_balance);
    const endBal = Number(session.statement_ending_balance);
    if (Math.abs(startBal - endBal) >= 0.01) {
      return { error: "No transactions selected and balance does not match." };
    }
  }
```

- [ ] **Step 3: Update the UI button disabled condition**

In `reconcile-matching-view.tsx`, replace line 224:

```typescript
          disabled={!isBalanced || finishMutation.isPending}
```

- [ ] **Step 4: Add confirmation dialog for zero-transaction finish**

In `reconcile-matching-view.tsx`, add state for confirmation (after line 59):

```typescript
  const [showZeroConfirm, setShowZeroConfirm] = useState(false);
```

Replace the `handleFinish` function (lines 115-121):

```typescript
  const handleFinish = () => {
    if (checkedIds.size === 0) {
      setShowZeroConfirm(true);
      return;
    }
    finishMutation.mutate({
      sessionId: session.id,
      accountId: session.accountId,
      transactionIds: Array.from(checkedIds),
    });
  };

  const handleConfirmZeroFinish = () => {
    setShowZeroConfirm(false);
    finishMutation.mutate({
      sessionId: session.id,
      accountId: session.accountId,
      transactionIds: [],
    });
  };
```

Add the confirmation UI after the cancel confirm block (after line 263), before the closing `</div>` of the actions bar:

```tsx
        {showZeroConfirm && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-50 px-3 py-1.5 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              No transactions selected. Complete with zero transactions?
            </span>
            <Button
              size="sm"
              onClick={handleConfirmZeroFinish}
              disabled={finishMutation.isPending}
            >
              {finishMutation.isPending ? "Finishing..." : "Yes, Complete"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowZeroConfirm(false)}
            >
              No
            </Button>
          </div>
        )}
```

- [ ] **Step 5: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add lib/validations/reconciliation.ts \
  "app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/actions.ts" \
  "app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/[sessionId]/reconcile-matching-view.tsx"
git commit -m "feat: allow reconciliation with zero transactions when balanced

Months where no transactions occurred can now be reconciled if starting
balance matches statement ending balance. Server-side validation ensures
balance match. Includes confirmation dialog for zero-transaction finish."
```

---

### Task 4: Edit Cleared Date on Reconciled Transactions

**Files:**
- Modify: `lib/validations/transaction.ts` — Add `updateClearedDateSchema`
- Modify: `app/(dashboard)/organizations/[orgId]/transactions/actions.ts` — Add `updateClearedDate()` action
- Modify: `app/(dashboard)/organizations/[orgId]/transactions/transaction-table.tsx:813-830` — Enable cleared_at editing for reconciled rows
- Modify: `hooks/use-transactions.ts` — Add `useUpdateClearedDate()` mutation hook

- [ ] **Step 1: Add validation schema**

In `lib/validations/transaction.ts`, add after line 93 (after `inlineUpdateTransactionSchema`):

```typescript
export const updateClearedDateSchema = z.object({
  transaction_id: z.string().uuid("Invalid transaction ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
  cleared_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Cleared date must be YYYY-MM-DD format."),
});

export type UpdateClearedDateInput = z.infer<typeof updateClearedDateSchema>;
```

- [ ] **Step 2: Add server action**

In `app/(dashboard)/organizations/[orgId]/transactions/actions.ts`, add the `updateClearedDate` action at the end of the file. First add the import of the new schema near the top where other schemas are imported:

```typescript
import {
  // ...existing imports...
  updateClearedDateSchema,
} from "@/lib/validations/transaction";
```

Then add the action:

```typescript
export async function updateClearedDate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    transaction_id: formData.get("transaction_id") as string,
    organization_id: formData.get("organization_id") as string,
    cleared_at: formData.get("cleared_at") as string,
  };

  const parsed = updateClearedDateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Fetch existing transaction
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, status, account_id")
    .eq("id", parsed.data.transaction_id)
    .single();

  if (!existing) {
    return { error: "Transaction not found." };
  }

  // Only allow on reconciled transactions
  if (existing.status !== "reconciled") {
    return { error: "Only reconciled transactions can have their cleared date edited this way." };
  }

  // Verify account belongs to the org
  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id")
    .eq("id", existing.account_id)
    .single();

  if (!account || account.organization_id !== parsed.data.organization_id) {
    return { error: "Transaction does not belong to this organization." };
  }

  // Convert YYYY-MM-DD to ISO timestamp
  const clearedAtTimestamp = parsed.data.cleared_at + "T00:00:00.000Z";

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ cleared_at: clearedAtTimestamp })
    .eq("id", parsed.data.transaction_id);

  if (updateError) {
    return { error: "Failed to update cleared date. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}
```

- [ ] **Step 3: Enable cleared_at editing for reconciled transactions in the table**

In `app/(dashboard)/organizations/[orgId]/transactions/transaction-table.tsx`, find the cleared_at InlineEditCell (around line 814-830). Change the `isEditable` prop from:

```typescript
          isEditable={!isReconciled && txn.status !== "uncleared"}
```

to:

```typescript
          isEditable={txn.status !== "uncleared"}
```

This allows editing cleared_at for both cleared AND reconciled transactions.

- [ ] **Step 4: Add useUpdateClearedDate mutation hook**

In `hooks/use-transactions.ts`, add a new mutation hook (import `updateClearedDate` from the actions file and add the mutation):

```typescript
import { updateClearedDate } from "@/app/(dashboard)/organizations/[orgId]/transactions/actions";

export function useUpdateClearedDate(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      clearedAt,
    }: {
      transactionId: string;
      clearedAt: string;
    }) => {
      const formData = new FormData();
      formData.set("transaction_id", transactionId);
      formData.set("organization_id", orgId);
      formData.set("cleared_at", clearedAt);

      const result = await updateClearedDate(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}
```

- [ ] **Step 5: Route reconciled cleared_at saves through the new mutation**

In `transaction-table.tsx`, the existing `handleSave` function (line 245) uses `inlineUpdateMutation.mutateAsync`. This blocks reconciled edits. Add a second mutation and branch:

1. Import and instantiate the hook near the other mutation hooks:
```typescript
const updateClearedDateMutation = useUpdateClearedDate(orgId);
```

2. Replace the `handleSave` callback (lines 245-254):
```typescript
  const handleSave = useCallback(
    async (transactionId: string, field: string, value: string) => {
      // Route reconciled cleared_at edits through dedicated action
      const txn = transactions.find((t) => t.id === transactionId);
      if (txn?.status === "reconciled" && field === "cleared_at") {
        await updateClearedDateMutation.mutateAsync({
          transactionId,
          clearedAt: value,
        });
        return;
      }
      await inlineUpdateMutation.mutateAsync({
        id: transactionId,
        field,
        value,
      });
    },
    [inlineUpdateMutation, updateClearedDateMutation, transactions]
  );
```

- [ ] **Step 5: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add lib/validations/transaction.ts \
  "app/(dashboard)/organizations/[orgId]/transactions/actions.ts" \
  "app/(dashboard)/organizations/[orgId]/transactions/transaction-table.tsx"
git commit -m "feat: allow editing cleared date on reconciled transactions

Adds a dedicated updateClearedDate server action that only operates on
reconciled transactions. The inline edit cell for cleared_at is now
enabled for reconciled rows, routing through the new action."
```

---

### Task 5: Add Date Mode Selection for Reports

**Files:**
- Modify: `lib/validations/report.ts:1-25`
- Modify: `lib/reports/fetch-report-data.ts:79-157,172-197,253-268`
- Modify: `app/(dashboard)/organizations/[orgId]/reports/report-filters.tsx`
- Modify: `app/(dashboard)/organizations/[orgId]/reports/page.tsx:37-44,118-125`
- Modify: `app/api/organizations/[orgId]/reports/export/route.ts:28-36`
- Modify: `app/api/organizations/[orgId]/reports/export-pdf/route.ts`
- Modify: `lib/excel/generate-report.ts` (report header)
- Modify: `lib/pdf/generate-report.ts` (report header)
- Modify: `lib/reports/types.ts` (add dateBasis to ReportData)

- [ ] **Step 1: Add date_mode to report validation schema**

In `lib/validations/report.ts`, add `date_mode` field after line 22 (before the closing `})`):

```typescript
  date_mode: z
    .enum(["transaction_date", "cleared_date"])
    .default("cleared_date"),
```

- [ ] **Step 2: Add dateBasis to ReportData type**

In `lib/reports/types.ts`, add to the `ReportData` interface:

```typescript
  dateBasis: "transaction_date" | "cleared_date";
```

- [ ] **Step 3: Refactor fetchReportData to branch on date_mode**

In `lib/reports/fetch-report-data.ts`, the query building section (lines 79-157) needs to branch. Replace lines 105-153 (from `// Determine which statuses...` through `txnQuery = txnQuery.or(...)`) — do NOT duplicate the `params.account_id` check which is already on lines 101-103:

```typescript
  const endDateExclusive = getNextDay(params.end_date);
  const dateMode = params.date_mode ?? "cleared_date";

  if (dateMode === "transaction_date") {
    // Simple: filter all transactions by transaction_date within range
    txnQuery = txnQuery
      .gte("transaction_date", params.start_date)
      .lt("transaction_date", endDateExclusive);

    // Apply status filter if specified
    const requestedStatuses = params.status;
    if (requestedStatuses) {
      if (requestedStatuses.length === 1) {
        txnQuery = txnQuery.eq("status", requestedStatuses[0]);
      } else {
        txnQuery = txnQuery.in("status", requestedStatuses);
      }
    }
  } else {
    // cleared_date mode: existing complex OR logic
    const requestedStatuses = params.status;
    const includeUncleared =
      !requestedStatuses || requestedStatuses.includes("uncleared");
    const clearedStatuses = requestedStatuses
      ? requestedStatuses.filter((s) => s !== "uncleared")
      : ["cleared", "reconciled"];

    const orParts: string[] = [];

    if (includeUncleared) {
      orParts.push(
        `and(status.eq.uncleared,transaction_date.lt.${endDateExclusive})`
      );
    }

    if (clearedStatuses.length > 0) {
      const statusPart =
        clearedStatuses.length === 1
          ? `status.eq.${clearedStatuses[0]}`
          : `status.in.(${clearedStatuses.join(",")})`;
      orParts.push(
        `and(${statusPart},cleared_at.gte.${params.start_date},cleared_at.lt.${endDateExclusive})`
      );
    }

    if (requestedStatuses) {
      const allStatusPart =
        requestedStatuses.length === 1
          ? `status.eq.${requestedStatuses[0]}`
          : `status.in.(${requestedStatuses.join(",")})`;
      orParts.push(
        `and(${allStatusPart},transaction_date.gte.${params.start_date},transaction_date.lt.${endDateExclusive})`
      );
    } else {
      orParts.push(
        `and(transaction_date.gte.${params.start_date},transaction_date.lt.${endDateExclusive})`
      );
    }

    if (orParts.length > 0) {
      txnQuery = txnQuery.or(orParts.join(","));
    }
  }
```

- [ ] **Step 4: Update running balance computation for transaction_date mode**

In `lib/reports/fetch-report-data.ts`, the running balance section (around lines 172-197) uses `cleared_at` for pre-period. Add date_mode branching:

```typescript
  let runningBalanceMap: Map<string, number> | null = null;
  if (params.account_id && !params.category_id) {
    const account = transactions[0]?.accounts;
    const openingBalance = account?.opening_balance ?? 0;

    let prePeriodNet = 0;
    if (dateMode === "transaction_date") {
      // Pre-period: all transactions with transaction_date before start
      const { data: prePeriodForRunning } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("account_id", params.account_id)
        .lt("transaction_date", params.start_date);

      for (const txn of prePeriodForRunning ?? []) {
        prePeriodNet += txn.transaction_type === "income" ? txn.amount : -txn.amount;
      }
    } else {
      // cleared_date mode: existing logic
      const { data: prePeriodForRunning } = await supabase
        .from("transactions")
        .select("amount, transaction_type")
        .eq("account_id", params.account_id)
        .in("status", ["cleared", "reconciled"])
        .lt("cleared_at", params.start_date);

      for (const txn of prePeriodForRunning ?? []) {
        prePeriodNet += txn.transaction_type === "income" ? txn.amount : -txn.amount;
      }
    }

    const startingBalance = openingBalance + prePeriodNet;
    runningBalanceMap = computeRunningBalances(startingBalance, transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      transaction_type: t.transaction_type,
    })));
  }
```

- [ ] **Step 5: Update account balance computation for transaction_date mode**

In `lib/reports/fetch-report-data.ts`, the account balance section (around lines 253-268) also needs branching. Replace the pre-period query:

```typescript
    if (accountIds.size > 0) {
      let prePeriodTxns;
      if (dateMode === "transaction_date") {
        const { data } = await supabase
          .from("transactions")
          .select("account_id, amount, transaction_type")
          .in("account_id", Array.from(accountIds))
          .lt("transaction_date", params.start_date);
        prePeriodTxns = data;
      } else {
        const { data } = await supabase
          .from("transactions")
          .select("account_id, amount, transaction_type")
          .in("account_id", Array.from(accountIds))
          .in("status", ["cleared", "reconciled"])
          .lt("cleared_at", params.start_date);
        prePeriodTxns = data;
      }

      // ...rest of balance computation unchanged (uses prePeriodTxns)...
```

- [ ] **Step 6: Include dateBasis in returned ReportData**

In `lib/reports/fetch-report-data.ts`, in the return statement (around line 297), add:

```typescript
    dateBasis: dateMode,
```

- [ ] **Step 7: Add date_mode to report filters UI**

In `app/(dashboard)/organizations/[orgId]/reports/report-filters.tsx`, add a new filter control. After the current date label state:

```typescript
  const currentDateMode = searchParams.get("date_mode") ?? "cleared_date";
```

Update the date labels to be dynamic (find the "Cleared From" and "Cleared To" labels around lines 192/204):

```typescript
        <Label className="text-xs text-muted-foreground">
          {currentDateMode === "transaction_date" ? "From" : "Cleared From"} <span className="text-destructive">*</span>
        </Label>
```

```typescript
        <Label className="text-xs text-muted-foreground">
          {currentDateMode === "transaction_date" ? "To" : "Cleared To"} <span className="text-destructive">*</span>
        </Label>
```

Add a Date Basis select in `filterControls`, before the Date Preset control:

```tsx
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Date Basis</Label>
        <Select
          value={currentDateMode}
          onValueChange={(v) => updateParam("date_mode", v === "cleared_date" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cleared_date">Cleared Date</SelectItem>
            <SelectItem value="transaction_date">Transaction Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
```

- [ ] **Step 8: Pass date_mode through reports page server component**

In `app/(dashboard)/organizations/[orgId]/reports/page.tsx`, update the searchParams destructuring (around line 37-44) to include `date_mode`:

```typescript
  const {
    account_id,
    status,
    category_id,
    start_date,
    end_date,
    budget_id,
    date_mode,
  } = await searchParams;
```

And pass it through to `reportParamsSchema.safeParse()` (around line 118-125):

```typescript
    const parsed = reportParamsSchema.safeParse({
      start_date,
      end_date,
      account_id: account_id || undefined,
      category_id: category_id || undefined,
      status: status || undefined,
      budget_id: budget_id || undefined,
      date_mode: date_mode || undefined,
    });
```

- [ ] **Step 9: Pass date_mode through export routes**

In `app/api/organizations/[orgId]/reports/export/route.ts`, add to `rawParams` (after line 35):

```typescript
    date_mode: url.searchParams.get("date_mode") ?? undefined,
```

In `app/api/organizations/[orgId]/reports/export-pdf/route.ts`, add the same.

In `report-filters.tsx`, update `buildExportParams()` to include date_mode:

```typescript
    if (currentDateMode !== "cleared_date") {
      params.set("date_mode", currentDateMode);
    }
```

- [ ] **Step 10: Add date basis to Excel and PDF report headers**

In `lib/excel/generate-report.ts`, in `buildSummarySheet`, find where the header info rows are written (around the "Period:" row). Add a new row after it:

```typescript
  const dateBasisLabel = data.dateBasis === "transaction_date" ? "Transaction Date" : "Cleared Date";
  writeLabelRow(leftRow, 1, `Date Basis: ${dateBasisLabel}`);
  leftRow++;
```

In `lib/pdf/generate-report.ts`, in the header section where period info is drawn, add similarly:

```typescript
  const dateBasisLabel = data.dateBasis === "transaction_date" ? "Transaction Date" : "Cleared Date";
  doc.text(`Date Basis: ${dateBasisLabel}`, MARGIN, headerY);
  headerY += 6;
```

- [ ] **Step 11: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 12: Commit**

```bash
git add lib/validations/report.ts lib/reports/fetch-report-data.ts lib/reports/types.ts \
  "app/(dashboard)/organizations/[orgId]/reports/report-filters.tsx" \
  "app/(dashboard)/organizations/[orgId]/reports/page.tsx" \
  "app/api/organizations/[orgId]/reports/export/route.ts" \
  "app/api/organizations/[orgId]/reports/export-pdf/route.ts" \
  lib/excel/generate-report.ts lib/pdf/generate-report.ts
git commit -m "feat: add date mode selection for reports (transaction vs cleared date)

Users can now choose whether to filter reports by transaction date or
cleared date. Default remains cleared_date to preserve existing behavior.
Balance computations and export headers reflect the selected mode."
```

---

### Task 6: Collapsible Dashboard Sidebar

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/layout/dashboard-shell.tsx`

- [ ] **Step 1: Add collapse state to DashboardShell**

In `components/layout/dashboard-shell.tsx`, add state and persistence:

```typescript
import { useState, useCallback, useEffect } from "react";
```

Inside `DashboardShell`, after the `sidebarOpen` state (line 16):

```typescript
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync collapsed state with localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      if (stored === "true") {
        setSidebarCollapsed(true);
      }
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, []);
```

Pass `collapsed` and `onToggleCollapse` to `Sidebar`:

```tsx
          <Sidebar
            orgId={currentOrgId}
            orgName={currentOrg?.name ?? ""}
            seasonsEnabled={currentOrg?.seasons_enabled ?? false}
            isOpen={sidebarOpen}
            onClose={handleCloseSidebar}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
```

- [ ] **Step 2: Update Sidebar props and add collapse functionality**

In `components/layout/sidebar.tsx`, update the interface and imports:

```typescript
import {
  LayoutDashboard,
  Landmark,
  Tags,
  ArrowLeftRight,
  Repeat,
  PiggyBank,
  FileBarChart,
  Calendar,
  Users,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

Update `SidebarProps`:

```typescript
interface SidebarProps {
  orgId: string;
  orgName: string;
  seasonsEnabled: boolean;
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```

Update `SidebarContent` to accept `collapsed`:

```typescript
function SidebarContent({
  orgId,
  orgName,
  seasonsEnabled,
  collapsed,
}: Readonly<{ orgId: string; orgName: string; seasonsEnabled: boolean; collapsed: boolean }>) {
```

Replace the nav items rendering inside `SidebarContent` to support collapsed mode:

```tsx
    <div className="flex h-full flex-col">
      {!collapsed && (
        <div className="border-b border-sidebar-border px-4 py-3">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {orgName}
          </p>
        </div>
      )}
      <nav className={cn("flex-1 space-y-1 py-3", collapsed ? "px-1" : "px-2")}>
        {allItems.map((item) => {
          const fullHref = basePath + item.href;
          const isActive = item.exact
            ? pathname === fullHref
            : pathname.startsWith(fullHref) && item.href !== "";

          const link = (
            <Link
              key={item.label}
              href={fullHref}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed
                  ? "justify-center px-2 py-2"
                  : "gap-3 px-3 py-3 lg:py-2",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.label} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>
    </div>
```

Update the `Sidebar` component itself:

```tsx
export function Sidebar({ orgId, orgName, seasonsEnabled, isOpen, onClose, collapsed, onToggleCollapse }: Readonly<SidebarProps>) {
```

Replace the desktop sidebar `<aside>`:

```tsx
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:shrink-0 lg:flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <SidebarContent orgId={orgId} orgName={orgName} seasonsEnabled={seasonsEnabled} collapsed={collapsed} />
        <div className={cn("border-t border-sidebar-border p-2", collapsed && "flex justify-center")}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </Button>
        </div>
      </aside>
```

The mobile sidebar remains unchanged (always expanded).

- [ ] **Step 3: Verify Tooltip component is installed**

Check if `components/ui/tooltip.tsx` exists. If not, install it:

Run: `ls components/ui/tooltip.tsx 2>/dev/null || npx shadcn@latest add tooltip`

- [ ] **Step 4: Wrap app with TooltipProvider**

The shadcn Tooltip requires a `TooltipProvider` ancestor. Check if there's already one in `providers.tsx` or the layout. If not, add it to the dashboard layout or providers file.

In `components/providers.tsx` (the file that wraps the dashboard with `QueryClientProvider`), wrap children with:

```tsx
import { TooltipProvider } from "@/components/ui/tooltip";

// Inside the Providers component:
<QueryClientProvider client={queryClient}>
  <TooltipProvider>
    {children}
  </TooltipProvider>
</QueryClientProvider>
```

- [ ] **Step 5: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add components/layout/sidebar.tsx components/layout/dashboard-shell.tsx \
  components/ui/tooltip.tsx components/providers.tsx
git commit -m "feat: add collapsible sidebar with icon-only rail mode

Desktop sidebar can be collapsed to a narrow icon rail (56px) with
tooltips. State persists in localStorage. Mobile overlay unchanged.
Collapse toggle at sidebar bottom with keyboard accessibility."
```
