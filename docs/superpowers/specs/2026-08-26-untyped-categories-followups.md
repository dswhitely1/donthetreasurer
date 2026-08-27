# Untyped Categories — Deferred Follow-ups

> Findings raised during the untyped-categories branch, consciously deferred rather than fixed there.
> Triaged by the final whole-branch review. Everything under "Must fix before merge" was fixed on that branch and is listed here only for the record.

## Apply-time checklist (do this first)

The migration `supabase/migrations/20260826000001_untyped_categories.sql` was authored and reviewed but **never executed**. It is irreversible: merged categories cannot be split back apart.

1. **Snapshot the database.**
2. Apply the file **whole and exactly once**, inside a transaction you control, and inspect before committing:
   - `SELECT count(*) FROM budget_line_items WHERE amount < 0` — non-zero, roughly your former expense-line count.
   - `SELECT count(*) FROM categories` — dropped by exactly the number of duplicate-name pairs you expect.
   - `SELECT count(*) FROM accounts WHERE fee_category_id IS NOT NULL` — unchanged. The migration asserts this itself; confirm the number matches memory.
   - No budget you care about lost a line to the `WHERE amount = 0` sweep. **This is the quietest risk:** a fundraiser whose income and expense halves exactly cancel loses its budget line entirely, with no record anywhere.
3. **Regenerate types:** `npx supabase gen types typescript --linked > types/database.ts`, then re-run `npx tsc --noEmit`. This is the first moment the type layer becomes a real gate again. If the regenerated file differs from the hand edit beyond the three removed `category_type` lines, something did not land as written.
4. First clicks worth making, in order — none of this has ever run in a browser:
   - Create a category with a duplicate name (exercises the new `23505` → friendly-message path, new code on four write paths).
   - Create a budget line with a negative net (exercises the dropped `CHECK (amount > 0)` and the new `amount <> 0`).
   - Open a report containing a two-sided category.
   - Export Excel and PDF for one budget and lay them beside the detail page.
   - Merge two formerly different-typed categories.

## Should fix soon

| Item | Where | Why |
|---|---|---|
| Export routes don't scope `budget_id` to the path org | `app/api/organizations/[orgId]/reports/export/route.ts:76`, `export-pdf/route.ts:77` | RLS prevents cross-treasurer leaks, but a treasurer with two orgs can emit a workbook headed *Org A* whose budget sheet is entirely *Org B*. The detail page guards correctly; these don't. Cleanest fix: give `fetchBudgetReportData` an `orgId` parameter, now that it is the single source for all three budget renderings. |
| `duplicateBudget` skips the overlap guard | `app/(dashboard)/organizations/[orgId]/budgets/actions.ts` | Copies line items verbatim without `findCategoryOverlapError`. If the category tree changed since the source budget was authored — a re-parent, or the migration's child-repointing — duplication can produce a budget whose `netTotals.actual` double-counts. Silent when it happens. |
| `(root)` sentinel leaks into all three renderers | `lib/reports/report-utils.ts:58,83` | The collapse only fires when `(root)` is the *sole* child. A parent with both its own line items and subcategories with line items produces a literal child row named `(root)`, which sorts first. Pre-existing, but the new table puts it in a board-facing report, and post-migration category shapes make it more reachable — the migration repoints children and line items onto survivors independently. |
| Budget detail table styling | `app/(dashboard)/organizations/[orgId]/budgets/[budgetId]/page.tsx` | One batch: `tabular-nums` dropped (the cards directly above have it, so digits visibly fail to line up), no `px-3` cell padding inside the bordered container, `border-b` without `last:border-b-0`, no empty state for a budget with zero line items. |
| Cross-renderer cosmetic divergence | Excel/PDF/page | Excel's category header lacks the `HEADER_FILL` every other section header has; Excel's unbudgeted rows get no favorable fill while PDF and the page colour theirs; the page's Unbudgeted table has 2 columns where both exports have 5; the page has no Total row where both exports do. |
| `is_active` NULL normalization | migration | `categories.is_active` is nullable. A NULL row escapes both the survivor-activation `EXISTS` and the partial index `WHERE is_active`. Theoretical — the app always writes a boolean — but the migration was the only place this was ever cheap. |
| 23505 negative test doesn't pin the index name | `categories/actions.test.ts` | Uses code `42501`, which rules out an unconditional-true helper but not one matching *any* `23505`. `isDuplicateActiveName` is load-bearing on four write paths. Add a negative with `23505` on a different constraint. |

## Fine to leave

- `budget-form.tsx` duplicate-category `disabled` guard is dead code (`usedCategoryIds.has(id) && !lineItems.some(...)` is a contradiction). Pre-existing; the server-side check still catches it.
- Per-line `variance` unrounded while `netTotals.variance` is rounded (`lib/reports/fetch-budget-data.ts:92` vs `:228`). Rendered output is consistent; only a raw Excel `=SUM()` under the variance column can differ in the 13th decimal.
- `roundToCents(-5.68e-14)` returns `-0`, so a budgeted line whose actual nets to exactly zero renders `-$0.00`. Not a regression, and `favorable`/colour is now correct.
- Migration step-6 header comment says "with four changes"; the RPC body now carries six deltas. Documentation only.
- `cancelled_budget_line_items` and the five sibling RPC counts are inert — `actions.ts` discards `data`, so a treasurer gets no indication two budget lines were destroyed by a merge.
- Five identity aliases (`const filteredCategories = categories`) whose names still say "filtered".
- Dead select fields: `budgets/page.tsx:54` requests `id, category_id`; org overview requests `category_id`; only `amount` and length are read.
- Budget list recomputes the net rather than reusing `fetchBudgetReportData`. Verified equal; a comment marks the second site.
- `budgets/[budgetId]/page.tsx` fetches the budget row twice — unavoidable, the ownership guard must precede the fetch.
- `netBudgeted >= 0` paints an exact `$0.00` green rather than an em dash. Consistent across all three renderers, so changing it here alone would create new drift.
- Two tautological `not.toContain("INCOME"/"EXPENSES")` assertions; `capturedTables()` without a defensive copy; `key={group.parentName}`; `updateLineItem`'s loose generic setter; `resolveName` O(n); two passes over `transactions`.

## Open question for the owner

`netTotals` sums budgeted lines only, so the budget detail card excludes unbudgeted activity. All three renderers agree, and both exports place the Unbudgeted block below the Total row.

The card was relabelled **"Actual Net (Budgeted Lines)"** and the export total rows **"Total (Budgeted Lines)"**, because the unqualified label read as the period's true net while the Unbudgeted section sat directly beneath it presenting money the card omitted. An unbudgeted grand total was rejected as inviting double-adding.

This is product wording. To change it, the strings are at `budgets/[budgetId]/page.tsx:137`, `lib/excel/generate-report.ts:626`, `lib/pdf/generate-report.ts:585`, plus their test assertions.

## Information deliberately removed

The budget list page and the dashboard Budget Snapshot previously showed **budgeted income** and **budgeted expenses** as separate figures, derived from `category_type`. Under the net model a single signed line item cannot be classified as either, so both collapsed to one signed "Net Budgeted".

This is a real reduction in what those two screens show. It follows from the net-only budgeting decision; recovering it would require reintroducing a per-line direction concept the model deliberately removed.
