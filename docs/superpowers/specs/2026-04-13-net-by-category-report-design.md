# Net by Category Report Section

## Overview

Add a "Net by Category" section to the report summary that merges parent categories appearing in both income and expense into a unified view showing income totals, expense totals, and net amounts. This surfaces the full financial picture for categories that have activity on both sides (e.g., band gigs that generate income but also incur expenses).

## Rules

1. A parent category qualifies for the merged section if it has activity in **both** income and expense during the report period.
2. Qualified parent categories (and all their children) are **removed** from the existing `incomeByCategory` and `expensesByCategory` arrays — no duplication.
3. Categories with only income activity remain in Income by Category. Categories with only expense activity remain in Expenses by Category.
4. No zero-padding — the merged section never shows $0 rows. If both sides happen to sum to $0 but both had transactions, the category still appears.
5. The section only renders when there is at least one merged category.

## Data Model Changes

### New type: `MergedCategorySummary`

Location: `lib/reports/types.ts`

```typescript
interface MergedCategorySummary {
  parentName: string;
  incomeChildren: { name: string; total: number }[];
  expenseChildren: { name: string; total: number }[];
  totalIncome: number;
  totalExpenses: number;
  net: number; // totalIncome - totalExpenses
}
```

### Modified type: `ReportSummary`

Add one new field:

```typescript
interface ReportSummary {
  // ... existing fields unchanged ...
  incomeByCategory: ReportCategorySummary[];      // now excludes merged parents
  expensesByCategory: ReportCategorySummary[];     // now excludes merged parents
  netByCategory: MergedCategorySummary[];          // NEW
}
```

### Logic in `computeSummary()`

1. Build `incomeByCategory` and `expensesByCategory` as today (no changes to existing logic).
2. Collect the set of `parentName` values that appear in both arrays.
3. For each matched parent name, create a `MergedCategorySummary` with the income children from the income side and expense children from the expense side.
4. Filter matched parents out of `incomeByCategory` and `expensesByCategory`.
5. Sort `netByCategory` alphabetically by `parentName`.

## UI Rendering

New full-width Card section on the reports page, placed **below** the existing Income/Expenses two-column grid and **above** the transaction details table.

### Layout per merged parent

```
Net by Category
─────────────────────────────────────
Band Gigs
  Income:
    Wedding Gigs              $500.00  (green)
    Corporate Events          $300.00  (green)
    Subtotal                  $800.00  (green, italic)
  Expenses:
    Equipment Rental          $200.00  (red)
    Travel                    $150.00  (red)
    Subtotal                  $350.00  (red, italic)
  Net:                        $450.00  (dynamic color)
─────────────────────────────────────
Combined Net Total:           $XXX.XX  (dynamic color)
```

- "Income" and "Expenses" sub-headers under each parent.
- Children indented under their sub-header.
- Subtotals shown only if multiple children (italic, indented).
- Net row per parent: green if positive, red if negative.
- Combined Net Total at the bottom summing all merged parents.
- Section only renders if `netByCategory.length > 0`.

## Excel Export

New worksheet tab called **"Net by Category"**, added after the existing "Summary" sheet.

### Layout (3 columns: A=Label, B=spacer, C=Amount)

```
NET BY CATEGORY                          (header row, slate-800 fill, white bold)

Band Gigs                                (bold parent)
Income:
  Wedding Gigs                  $500.00  (green)
  Corporate Events              $300.00  (green)
  Subtotal                      $800.00  (green, italic)
Expenses:
  Equipment Rental              $200.00  (red)
  Travel                        $150.00  (red)
  Subtotal                      $350.00  (red, italic)
Net                             $450.00  (bold, dynamic color)

Combined Net Total              $XXX.XX  (bold, dynamic color)
```

- Same color constants and currency formatting as existing Summary sheet.
- Same header styling (#FF1E293B fill, white bold font).
- Sheet only created if `netByCategory.length > 0`.

## PDF Export

New section placed after the Income/Expenses by Category sections on the summary page (or new page if space is tight).

### Table format (4 columns: Category, Income, Expense, Net)

```
NET BY CATEGORY

| Category           | Income        | Expense       | Net           |
|--------------------|---------------|---------------|---------------|
| Band Gigs          |               |               |               |
|   Wedding Gigs     | $500.00 (grn) | --            |               |
|   Corporate Events | $300.00 (grn) | --            |               |
|   Equipment Rental | --            | $200.00 (red) |               |
|   Travel           | --            | $150.00 (red) |               |
|   Subtotal         | $800.00 (grn) | $350.00 (red) | $450.00 (dyn) |
|                    |               |               |               |
| Combined Net Total |               |               | $XXX.XX (dyn) |
```

- Uses `autoTable` like existing PDF sections.
- Children from income side show amount in Income column, dash in Expense.
- Children from expense side show amount in Expense column, dash in Income.
- Subtotal row per parent with appropriate colors.
- Combined Net Total row at the bottom.
- Same color constants (GREEN, RED) as existing PDF.
- Only rendered if `netByCategory.length > 0`.

## Files to Modify

| File | Change |
|------|--------|
| `lib/reports/types.ts` | Add `MergedCategorySummary`, add `netByCategory` to `ReportSummary` |
| `lib/reports/report-utils.ts` | Update `computeSummary()` to detect merged parents, build `netByCategory`, filter existing arrays |
| `app/(dashboard)/organizations/[orgId]/reports/page.tsx` | Add "Net by Category" card section |
| `lib/excel/generate-report.ts` | Add `buildNetByCategorySheet()` function, call it from `generateReport()` |
| `lib/pdf/generate-report.ts` | Add net-by-category section rendering |

## Testing

- Unit tests for the merge logic in `computeSummary()`:
  - Categories with only income stay in income
  - Categories with only expense stay in expense
  - Categories with both get merged and removed from income/expense
  - Empty case (no merged categories) produces empty array
  - Parent name matching is exact (case-sensitive)
