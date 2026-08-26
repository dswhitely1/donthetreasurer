# Untyped Categories and Net Budgeting — Design

> **Status:** Approved design, ready for implementation planning
> **Date:** August 26, 2026
> **Supersedes:** Sections 5.2, 5.3, 8, and 11 of [budget-prd.md](../../budget-prd.md)

---

## 1. Problem

`categories.category_type` forces every category to be either income or expense. Real nonprofit activities are frequently two-sided: a poinsettia fundraiser has both revenue and cost of goods; a uniform program has both parent payments and vendor invoices.

Because a category cannot hold both sides, treasurers create **two categories with the same name** — one income, one expense. The reporting layer then tries to put them back together by **matching the display string**, in two independent places:

| Location | What it does |
|----------|--------------|
| `lib/reports/budget-combined.ts` | Groups budget lines by `categoryName`, and emits a combined net row when the same name appears in both the income and expense maps. |
| `lib/reports/report-utils.ts:117-146` | Builds `netByCategory` by intersecting `incomeByCategory` and `expensesByCategory` on `parentName`. |

A string join is standing in for a relationship that the schema refuses to express. The consequences:

- Renaming one half of a pair silently splits the combined row in two.
- Two genuinely unrelated categories that happen to share a name are silently merged.
- `merge_categories` explicitly refuses to merge across types (`'Categories must be the same type (income/expense).'`) — it forbids exactly the merge the data needs.
- Every category dropdown filters by type, so the two halves can never be seen together during data entry.

The type does not belong on the category. Direction is a property of the money movement, and the schema already records it there: `transactions.transaction_type`.

---

## 2. Decisions

Settled during brainstorming:

1. **A category has no inherent type.** Money flows both ways through it. `category_type` is removed, not made nullable and not extended with a `both` value.
2. **Budget line items are net.** One signed amount per category meaning *expected net*. Not separate income and expense amounts.
3. **Category dropdowns stop filtering.** Every active category is selectable on every transaction. No soft hint, no advisory default direction.
4. **The migration auto-merges same-name pairs.** No manual cleanup step, no suggested-merge UI.
5. **Category summaries become one row per category** with In / Out / Net columns, replacing the Income and Expense sections.
6. **Transaction direction stays on the transaction.** `transactions.transaction_type` is unchanged; line items inherit their parent transaction's direction. A single transaction still cannot mix directions across its split lines.

Decision 6 is the scope boundary. Moving direction onto `transaction_line_items` would allow a deposit to carry both revenue and fee lines, but it breaks the "line items sum to the transaction total" invariant and ripples into reconciliation, running balances, and account balance math. Recording a fundraiser's revenue and its cost as two transactions is already the current practice and remains correct.

---

## 3. Data Model

### 3.1 `categories`

```sql
ALTER TABLE public.categories DROP COLUMN category_type;
```

Nothing replaces it. A category is an organization-scoped label with an optional parent.

To stop duplicate-name pairs from being recreated after the migration cleans them up, add a uniqueness guard over active categories. `UNIQUE` treats NULLs as distinct, which would let two top-level categories share a name, so `NULLS NOT DISTINCT` is required (PostgreSQL 15+, which Supabase provides):

```sql
CREATE UNIQUE INDEX idx_categories_unique_active_name
  ON public.categories (organization_id, parent_id, lower(trim(name)))
  NULLS NOT DISTINCT
  WHERE is_active;
```

Scoping the index to `WHERE is_active` lets a deactivated category retain its name without blocking a new one.

### 3.2 `budget_line_items`

`amount` becomes signed and means expected net for the category over the budget period.

```sql
ALTER TABLE public.budget_line_items DROP CONSTRAINT budget_line_items_amount_check;
ALTER TABLE public.budget_line_items ADD CONSTRAINT budget_line_items_amount_nonzero
  CHECK (amount <> 0);
```

A budgeted net of exactly zero is rejected — a line that plans nothing is noise, and a break-even fundraiser is better expressed by omitting the line or by budgeting the small net it actually expects. `DECIMAL(12,2)` already permits negatives.

`budget_line_items_unique_category` (one row per category per budget) is unchanged.

### 3.3 What stays

`transactions.transaction_type`, `transaction_line_items`, all balance and reconciliation logic, the seasons and students tables, and letter templates are untouched.

---

## 4. Migration

Single migration file, `supabase/migrations/20260826000001_untyped_categories.sql`. **Step order is load-bearing** — the signed conversion in step 1 reads `category_type`, which step 5 destroys.

### Step 1 — Convert budget amounts to signed, while type still exists

```sql
UPDATE public.budget_line_items AS bli
   SET amount = -bli.amount
  FROM public.categories AS c
 WHERE c.id = bli.category_id
   AND c.category_type = 'expense';
```

After this, budgeted income stays positive and budgeted expense becomes negative. Summing the two halves of a pair during the merge then produces the correct net automatically: `8200 + (-5100) = 3100`.

### Step 2 — Identify merge groups

Group active categories by `(organization_id, parent_id, lower(trim(name)))`, using `IS NOT DISTINCT FROM` semantics so top-level categories with a `NULL` parent group together. Any group with more than one member is a merge group. The **survivor** is the member with the earliest `created_at`, ties broken by `id` for determinism.

This handles the two-member income/expense pair, and also the rarer case of three or more same-name categories.

### Step 3 — Merge, children before parents

Merging a parent repoints its children onto the survivor, which can create *new* duplicate sibling names that themselves need merging. A single pass is therefore not enough.

Implement as a loop that merges every duplicate group it finds, then repeats until a pass finds none. Newly-created sibling duplicates are caught by the following pass. The loop terminates because each merge removes at least one category.

No leaf-first ordering is needed, and attempting one is actively wrong: restricting the pass to categories with no children means a parent — which by definition has children — would never be merged at all.

Cycles are not a concern. Two categories can only collide when they share a `parent_id`, which makes them siblings, and siblings can never be ancestors of one another.

For each non-survivor in a group, repoint to the survivor:

| Table | Action |
|-------|--------|
| `transaction_line_items` | `SET category_id = survivor` |
| `recurring_template_line_items` | `SET category_id = survivor` |
| `categories` (children) | `SET parent_id = survivor` |
| `accounts.fee_category_id` | `SET fee_category_id = survivor` |
| `budget_line_items` | Sum signed amounts into the survivor's row for the same budget, concatenate notes, delete the absorbed row; otherwise repoint |

`accounts.fee_category_id` is easy to miss and is the most dangerous omission in the whole migration. It is a category reference outside the line-item tables, and unlike every other category foreign key it is `ON DELETE SET NULL`, not `ON DELETE RESTRICT`. Skipping it therefore does **not** abort the migration — it silently blanks the fee configuration on any account whose fee category happened to be a non-survivor, and the next income transaction on that account quietly stops generating its companion fee expense. This must be repointed explicitly and asserted in step 4.

The survivor takes `is_active = TRUE` if **any** member of the group was active. Then hard-delete the non-survivors.

### Step 4 — Verify no dangling references

Before dropping the column, assert that no `transaction_line_items`, `recurring_template_line_items`, `budget_line_items`, or `accounts.fee_category_id` row points at a deleted category.

For the three line-item tables this assertion is belt-and-braces: `ON DELETE RESTRICT` will already have aborted the transaction if step 3 missed one, which is the desired behavior. For `accounts.fee_category_id` the assertion is the *only* protection, because its `ON DELETE SET NULL` fails silently. Assert explicitly that the count of accounts with a non-null `fee_category_id` is unchanged from before step 3, and `RAISE EXCEPTION` if it dropped.

### Step 5 — Drop the column and apply new constraints

Drop `category_type`, add the unique index from §3.1 and the `amount <> 0` constraint from §3.2.

**The merge can produce a zero net that violates the constraint being added.** A pair budgeted at 5,000 income and 5,000 expense sums to exactly 0, and the `amount <> 0` check would then abort the migration. Delete zero-amount budget line items after the merge and before adding the constraint — a line planning a net of zero carries no information.

A consequence worth accepting: a budget whose only line was such a pair ends up with no line items, while `budgetLineItemsArraySchema` requires at least one. That budget still displays correctly; the treasurer must add a line the next time they edit it. This is rare enough not to warrant special handling.

### Step 6 — Rewrite `merge_categories`

Remove the same-type guard entirely. Update the budget line item merge to sum signed amounts (the existing `target.amount + source.amount` is already correct once amounts are signed). Add `accounts.fee_category_id` repointing, which the current implementation omits — a pre-existing gap that the same-type guard was partly masking.

The RPC's return shape gains `reassigned_fee_accounts`.

### Rollback

The migration is not cleanly reversible: merged categories cannot be split back apart, because the information about which line item came from which half of the pair is destroyed. **Take a database snapshot before applying.** This should be stated in the implementation plan as a manual pre-step, not automated.

---

## 5. Actuals and Variance

### 5.1 Actuals

For a category `C` over a budget's date range, the actual net is:

```
actual(C) = Σ line item amounts on income transactions for C and its descendants
          − Σ line item amounts on expense transactions for C and its descendants
```

The direction comes from the parent transaction's `transaction_type`. `fetch-budget-data.ts` currently sums `transaction_line_items.amount` without ever reading `transaction_type`, so the query must start selecting it.

Descendant rollup is unchanged in spirit: a budget line on a parent category absorbs its children's activity. The existing `childrenByParent` map covers one level; it should be made properly recursive, since the schema permits deeper nesting even if current data does not.

Status filtering is unchanged — all statuses are included, matching current behavior and PRD `BVA-002`.

### 5.2 Variance

```
variance      = actual − budgeted
favorable     = actual >= budgeted
percentOfPlan = budgeted ≠ 0 ? (actual / budgeted) × 100 : null
```

Net semantics make all three uniform, which is the main payoff of decision 2. The income/expense inversion in the current code disappears:

| Case | Budgeted | Actual | Variance | Favorable | % of plan |
|------|---------:|-------:|---------:|-----------|----------:|
| Dues under-collected | 12,400 | 8,200 | −4,200 | no | 66% |
| Repairs under-spent | −1,000 | −430 | +570 | yes | 43% |
| Fundraiser beat plan | 3,100 | 3,400 | +300 | yes | 110% |
| Fundraiser lost money | 3,100 | −200 | −3,300 | no | −6% → display as 0% |

`actual / budgeted` reads naturally as "percent of plan consumed" for both signs, because both numerator and denominator carry the same sign in the normal case. When the signs diverge — the last row, an activity that was supposed to net positive but lost money — the ratio goes negative. **The progress bar clamps to 0 and renders in the unfavorable color; the dollar figures are always shown unclamped.** Dollars are the primary signal; the percentage is decoration.

This resolves the open issue flagged during brainstorming. There is no need to divide by `abs(budgeted)`, which would have produced a misleading positive percentage in exactly the case that most needs attention.

### 5.3 Unbudgeted actuals

Unchanged in purpose: categories with activity in the period that have no budget line. The current implementation filters on `actual > 0`, which under net semantics would **hide any unbudgeted category that net-lost money** — the most important kind to surface. Change the filter to `actual !== 0`.

---

## 6. Report Shape

### 6.1 Types

`ReportSummary` loses `incomeByCategory`, `expensesByCategory`, and `netByCategory`, and gains a single list:

```typescript
export interface CategoryNetSummary {
  parentName: string;
  children: { name: string; in: number; out: number; net: number }[];
  totalIn: number;
  totalOut: number;
  net: number;
}

export interface ReportSummary {
  totalIncome: number;
  totalExpenses: number;
  netChange: number;
  balanceByStatus: { uncleared: number; cleared: number; reconciled: number };
  categoryTotals: CategoryNetSummary[];
}
```

`MergedCategorySummary` and `ReportCategorySummary` are deleted. `totalIncome`, `totalExpenses`, and `netChange` remain — they are computed from `transaction_type` directly and never depended on `category_type`.

### 6.2 Rendered layout

```
Category            In        Out       Net
---------------------------------------------
Dues            12,400.00       0.00  12,400.00
Poinsettias      8,200.00   5,100.00   3,100.00
Uniforms             0.00   4,650.00  -4,650.00
Instrument Rep.      0.00     430.00    -430.00
---------------------------------------------
Total           20,600.00  10,180.00  10,420.00
```

Parent categories render as group headers with their children indented beneath, preserving the existing hierarchy treatment. A parent's row totals its own direct activity plus its children's.

Applies identically to the on-screen report page, the Excel Summary worksheet, and the PDF summary page. The Transactions worksheet and the transaction table are unaffected — they key off `transaction_type`, not category type.

### 6.3 Budget vs. Actuals view

One table instead of separate Income and Expense sections:

| Column | Value |
|--------|-------|
| Category | `Parent → Child` label |
| Budgeted | Signed net |
| Actual | Signed net |
| Variance | `actual − budgeted` |
| % of plan | Per §5.2, or `—` |
| Progress | Bar, clamped to 0 |

Summary cards collapse from six to three: **Budgeted Net**, **Actual Net**, **Variance**. The separate budgeted-income / budgeted-expense cards no longer have a meaning, since a single line item is not classifiable as one or the other.

---

## 7. Code Removed

The change is subtractive. What goes away:

| File | Disposition |
|------|-------------|
| `lib/reports/budget-combined.ts` | Deleted |
| `lib/reports/budget-combined.test.ts` | Deleted |
| `report-utils.ts` `netByCategory` merge (lines 117-146) | Deleted |
| `CATEGORY_TYPES` / `CATEGORY_TYPE_LABELS` in `lib/validations/category.ts` | Deleted |
| `category_type` from create/update category Zod schemas | Deleted |
| Same-type guard in `merge_categories` | Deleted |
| Type filtering in every category dropdown | Deleted |

Roughly 47 files reference `category_type`. The large majority are mechanical: drop a `.filter()` on a dropdown, drop a column from a `select()`, drop a field from a form. The substantive work is concentrated in the migration, `fetch-budget-data.ts`, `report-utils.ts`, the Excel and PDF generators, and the budget detail page.

### Noted, not fixed

`report-utils.ts` `findCategoryId` reverse-maps a display label back to a category ID by string comparison, and returns `"unknown"` on miss. It is the same class of defect as the name-matching join. It is not on the path of this change and is left alone — worth a follow-up issue.

---

## 8. Testing

Existing tests that encode the old model must be rewritten, not deleted, so the behavior change is visible in the diff.

**Migration** — the highest-risk piece, and the only one that touches live data. Test against a seeded database:

- An income/expense pair with identical names merges into one category; both sides' transaction line items survive and point at the survivor.
- Budget lines for the pair sum to the correct signed net (`8200 + (-5100) = 3100`).
- A parent pair whose children also form pairs merges correctly children-first.
- An account whose `fee_category_id` pointed at a non-survivor is repointed rather than failing the FK.
- Categories with the same name under *different* parents are left alone.
- An inactive member merged with an active one yields an active survivor.

**Computation** — `fetch-budget-data.ts`: the four-row variance table in §5.2 becomes direct test cases, including the sign-divergence row. Recursive descendant rollup at two levels deep. Unbudgeted actuals with a negative net appear rather than being filtered out.

**Reporting** — `report-utils.ts` builds `categoryTotals` with correct in/out/net splits for a two-sided category. Excel and PDF snapshot tests updated for the new summary layout.

Per the repo baseline, four `tsc` errors, three lint problems, and a broken `test:coverage` predate this work. Verify against that baseline rather than assuming a clean tree.

---

## 9. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Budget line on a parent *and* on one of its children | Still rejected — the PRD rule against budgeting the same money twice is unaffected by untyping. |
| Category nets exactly zero over the period | Renders as a real `0.00` row, not omitted. Distinguishable from "no activity" only by the In and Out columns, which is why they are shown. |
| Budgeted net of zero | Rejected by the `amount <> 0` constraint. |
| Category with activity in only one direction | Renders with `0.00` in the unused column. The common case, and it reads fine. |
| Deleting a category referenced by a budget line | Still blocked by `ON DELETE RESTRICT`. |
| Duplicate name created after migration | Blocked by the new partial unique index. |
| Fee category on an account | No longer constrained to be an expense category; the accounts form drops that validation. |

---

## 10. Out of Scope

- Mixed-direction line items within a single transaction (decision 6).
- Any change to seasons, students, enrollments, or letter templates.
- Budget scoping to seasons or fiscal years, and per-month or per-student budget granularity — both raised during brainstorming and explicitly set aside.
- Fixing `findCategoryId`.

---

## 11. Follow-up

After approval, the next step is the `writing-plans` skill to produce a step-by-step implementation plan. The migration should be its own reviewable increment, applied and verified against a snapshot before any application code depends on the dropped column.
