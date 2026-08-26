# Untyped Categories and Net Budgeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `categories.category_type` so a two-sided activity is a single category, and make budget line items signed nets.

**Architecture:** Direction is derived from `transactions.transaction_type` instead of the category. The two places that reconstruct two-sided categories by string-matching display names are deleted. The rollout uses **expand-contract**: new fields are added alongside old ones, consumers migrate one at a time, then the old fields are removed — so every task leaves the test suite green.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript 5 strict · Supabase (PostgreSQL 15+) · Zod 4 · ExcelJS 4 · jsPDF + jspdf-autotable · Vitest 4

**Spec:** [`docs/superpowers/specs/2026-08-26-untyped-categories-design.md`](../specs/2026-08-26-untyped-categories-design.md)

## Global Constraints

- **This branch is a single release. Do not merge partway.** Tasks 1–12 leave the database untouched while code is prepared for signed budget amounts; the data is only converted in Task 13. Merging before Task 13 ships code that misreads every expense budget line as a positive net.
- **Baseline is not clean.** Before this work: `npx vitest run` = 577 passed / 33 files; `npx tsc --noEmit` = **4 errors** (3 in `app/(dashboard)/organizations/[orgId]/categories/actions.test.ts`, 1 in `lib/excel/generate-report.test.ts`); `npm run lint` = **3 problems** (2 errors, 1 warning, all in `components/layout/dashboard-shell.tsx`). Never claim "clean" — compare against these numbers.
- **`npm run lint` only.** `npx next lint` is removed in Next 16 and fails with "Invalid project directory".
- Variance is `actual − budgeted`; favorable is `actual >= budgeted`; percent of plan is `(actual / budgeted) × 100` when `budgeted !== 0`, else `null`.
- Progress bars clamp to `[0, ...]`. Dollar figures are **never** clamped.
- Category display label format is `Parent → Child` using `→`, matching `resolveCategoryLabel`.
- Files are kebab-case; components PascalCase; `import type` for type-only imports.

---

### Task 1: Net category summary builder

Pure function, no consumers yet. Purely additive — nothing else changes.

**Files:**
- Modify: `lib/reports/types.ts`
- Modify: `lib/reports/report-utils.ts`
- Test: `lib/reports/report-utils.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `CategoryNetSummary` type; `buildCategoryNetSummaries(inByCatId: Record<string, number>, outByCatId: Record<string, number>, categoryNameMap: Record<string, string>, categoryParentMap: Record<string, string | null>): CategoryNetSummary[]`

- [ ] **Step 1: Add the type**

Append to `lib/reports/types.ts`. Do **not** remove `ReportCategorySummary` or `MergedCategorySummary` yet — Task 6 does that.

```typescript
export interface CategoryNetSummaryChild {
  name: string;
  in: number;
  out: number;
  net: number;
}

export interface CategoryNetSummary {
  parentName: string;
  children: CategoryNetSummaryChild[];
  totalIn: number;
  totalOut: number;
  net: number;
}
```

- [ ] **Step 2: Write the failing test**

Add to `lib/reports/report-utils.test.ts`. Add `buildCategoryNetSummaries` and `CategoryNetSummary` to the existing imports at the top of the file.

```typescript
describe("buildCategoryNetSummaries", () => {
  const nameMap = {
    dues: "Dues",
    poin: "Poinsettias",
    unif: "Uniforms",
    pfund: "Fundraising",
    pchild: "Poinsettia Sale",
  };
  const parentMap: Record<string, string | null> = {
    dues: null,
    poin: null,
    unif: null,
    pfund: null,
    pchild: "pfund",
  };

  it("produces one row per category with in, out and net", () => {
    const result = buildCategoryNetSummaries(
      { dues: 12400, poin: 8200 },
      { poin: 5100, unif: 4650 },
      nameMap,
      parentMap
    );

    expect(result).toEqual([
      { parentName: "Dues", children: [], totalIn: 12400, totalOut: 0, net: 12400 },
      { parentName: "Poinsettias", children: [], totalIn: 8200, totalOut: 5100, net: 3100 },
      { parentName: "Uniforms", children: [], totalIn: 0, totalOut: 4650, net: -4650 },
    ]);
  });

  it("keeps a two-sided category as a single row", () => {
    const result = buildCategoryNetSummaries(
      { poin: 8200 },
      { poin: 5100 },
      nameMap,
      parentMap
    );

    expect(result).toHaveLength(1);
    expect(result[0].net).toBe(3100);
  });

  it("nests children under their parent and subtotals them", () => {
    const result = buildCategoryNetSummaries(
      { pchild: 8200 },
      { pchild: 5100 },
      nameMap,
      parentMap
    );

    expect(result).toEqual([
      {
        parentName: "Fundraising",
        children: [{ name: "Poinsettia Sale", in: 8200, out: 5100, net: 3100 }],
        totalIn: 8200,
        totalOut: 5100,
        net: 3100,
      },
    ]);
  });

  it("sorts parents alphabetically", () => {
    const result = buildCategoryNetSummaries(
      { unif: 1, dues: 1 },
      {},
      nameMap,
      parentMap
    );

    expect(result.map((g) => g.parentName)).toEqual(["Dues", "Uniforms"]);
  });

  it("returns an empty array when there is no activity", () => {
    expect(buildCategoryNetSummaries({}, {}, nameMap, parentMap)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: FAIL — `buildCategoryNetSummaries is not a function`.

- [ ] **Step 4: Implement the builder**

Add to `lib/reports/report-utils.ts`, below the existing `buildCategorySummaries`. Add `CategoryNetSummary` and `CategoryNetSummaryChild` to the `import type` line at the top.

The `"(root)"` sentinel and the collapse-to-flat-row behavior mirror `buildCategorySummaries` exactly, so both report shapes group identically.

```typescript
export function buildCategoryNetSummaries(
  inByCatId: Record<string, number>,
  outByCatId: Record<string, number>,
  categoryNameMap: Record<string, string>,
  categoryParentMap: Record<string, string | null>
): CategoryNetSummary[] {
  const parentGroups: Record<
    string,
    Record<string, { in: number; out: number }>
  > = {};

  function slot(catId: string): { in: number; out: number } {
    const parentId = categoryParentMap[catId];
    const hasParent = Boolean(parentId && categoryNameMap[parentId]);
    const parentName = hasParent
      ? categoryNameMap[parentId as string]
      : categoryNameMap[catId] ?? "Other";
    const childName = hasParent ? categoryNameMap[catId] ?? "Unknown" : "(root)";

    parentGroups[parentName] ??= {};
    parentGroups[parentName][childName] ??= { in: 0, out: 0 };
    return parentGroups[parentName][childName];
  }

  for (const [catId, amount] of Object.entries(inByCatId)) {
    slot(catId).in += amount;
  }
  for (const [catId, amount] of Object.entries(outByCatId)) {
    slot(catId).out += amount;
  }

  return Object.entries(parentGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([parentName, childMap]) => {
      const children: CategoryNetSummaryChild[] = Object.entries(childMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, v]) => ({ name, in: v.in, out: v.out, net: v.in - v.out }));

      const totalIn = children.reduce((s, c) => s + c.in, 0);
      const totalOut = children.reduce((s, c) => s + c.out, 0);

      const collapsed =
        children.length === 1 && children[0].name === "(root)" ? [] : children;

      return { parentName, children: collapsed, totalIn, totalOut, net: totalIn - totalOut };
    });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add lib/reports/types.ts lib/reports/report-utils.ts lib/reports/report-utils.test.ts
git commit -m "feat(reports): add buildCategoryNetSummaries"
```

---

### Task 2: computeSummary emits categoryTotals (expand)

`ReportSummary` gains `categoryTotals` while keeping the three old fields. Nothing downstream changes yet.

**Files:**
- Modify: `lib/reports/types.ts`
- Modify: `lib/reports/report-utils.ts:82-157` (`computeSummary`)
- Test: `lib/reports/report-utils.test.ts`

**Interfaces:**
- Consumes: `buildCategoryNetSummaries` from Task 1
- Produces: `ReportSummary.categoryTotals: CategoryNetSummary[]`

- [ ] **Step 1: Add the field to the type**

In `lib/reports/types.ts`, add to `ReportSummary` alongside the existing fields:

```typescript
  categoryTotals: CategoryNetSummary[];
```

- [ ] **Step 2: Write the failing test**

Add to `lib/reports/report-utils.test.ts`. Follow the existing `computeSummary` tests in that file for how to build a `ReportTransaction` fixture — reuse their helper if one exists rather than writing a new one.

```typescript
it("computeSummary emits categoryTotals with a two-sided category as one row", () => {
  const nameMap = { poin: "Poinsettias" };
  const parentMap: Record<string, string | null> = { poin: null };

  const summary = computeSummary(
    [
      makeTxn({ transactionType: "income", amount: 8200, lineItems: [{ categoryLabel: "Poinsettias", amount: 8200, memo: null }] }),
      makeTxn({ transactionType: "expense", amount: 5100, lineItems: [{ categoryLabel: "Poinsettias", amount: 5100, memo: null }] }),
    ],
    nameMap,
    parentMap
  );

  expect(summary.categoryTotals).toEqual([
    { parentName: "Poinsettias", children: [], totalIn: 8200, totalOut: 5100, net: 3100 },
  ]);
  expect(summary.totalIncome).toBe(8200);
  expect(summary.totalExpenses).toBe(5100);
  expect(summary.netChange).toBe(3100);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: FAIL — `categoryTotals` is `undefined`.

- [ ] **Step 4: Populate the field**

In `computeSummary`, the loop already builds `incomeByCatId` and `expenseByCatId`. Add one line before the `return`, and add `categoryTotals` to the returned object:

```typescript
  const categoryTotals = buildCategoryNetSummaries(
    incomeByCatId,
    expenseByCatId,
    categoryNameMap,
    categoryParentMap
  );
```

Leave the `netByCategory` block and the `filteredIncome` / `filteredExpenses` computation exactly as they are.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: 578+ passed, 0 failed. Existing `computeSummary` tests still pass because no old field changed.

- [ ] **Step 6: Commit**

```bash
git add lib/reports/types.ts lib/reports/report-utils.ts lib/reports/report-utils.test.ts
git commit -m "feat(reports): populate categoryTotals on ReportSummary"
```

---

### Task 3: Excel summary sheet renders categoryTotals

**Files:**
- Modify: `lib/excel/generate-report.ts:518-600` (the income, expense, and net sections of the Summary sheet)
- Test: `lib/excel/generate-report.test.ts`

**Interfaces:**
- Consumes: `ReportSummary.categoryTotals`
- Produces: a Summary worksheet whose category block is a single four-column table

- [ ] **Step 1: Write the failing test**

Add to `lib/excel/generate-report.test.ts`, following the existing worksheet-assertion style in that file (read a cell via `sheet.getCell(row, col).value`).

```typescript
it("renders a single In/Out/Net category table", async () => {
  const data = makeReportData({
    summary: {
      totalIncome: 8200,
      totalExpenses: 5100,
      netChange: 3100,
      balanceByStatus: { uncleared: 0, cleared: 3100, reconciled: 0 },
      incomeByCategory: [],
      expensesByCategory: [],
      netByCategory: [],
      categoryTotals: [
        { parentName: "Poinsettias", children: [], totalIn: 8200, totalOut: 5100, net: 3100 },
      ],
    },
  });

  const sheet = await summarySheetOf(data);
  const headerRow = findRowByFirstCell(sheet, "Category");

  expect(sheet.getCell(headerRow, 2).value).toBe("In");
  expect(sheet.getCell(headerRow, 3).value).toBe("Out");
  expect(sheet.getCell(headerRow, 4).value).toBe("Net");
  expect(sheet.getCell(headerRow + 1, 1).value).toBe("Poinsettias");
  expect(sheet.getCell(headerRow + 1, 2).value).toBe(8200);
  expect(sheet.getCell(headerRow + 1, 3).value).toBe(5100);
  expect(sheet.getCell(headerRow + 1, 4).value).toBe(3100);
});

it("no longer emits INCOME or EXPENSES section headers", async () => {
  const sheet = await summarySheetOf(makeReportData({ /* as above */ }));
  const firstCells: unknown[] = [];
  sheet.eachRow((row) => firstCells.push(row.getCell(1).value));

  expect(firstCells).not.toContain("INCOME");
  expect(firstCells).not.toContain("EXPENSES");
});
```

If `makeReportData`, `summarySheetOf`, or `findRowByFirstCell` do not already exist in the test file, write them as local helpers at the top of the describe block — `summarySheetOf` should call the module's workbook builder and return `workbook.getWorksheet("Summary")`, and `findRowByFirstCell` should scan rows for a first-cell match and return its row number.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/excel/generate-report.test.ts`
Expected: FAIL — the sheet still contains `INCOME`.

- [ ] **Step 3: Replace the three sections with one**

Delete the three blocks at `lib/excel/generate-report.ts:518-600` (`if (summary.incomeByCategory.length > 0)`, `if (summary.expensesByCategory.length > 0)`, `if (summary.netByCategory.length > 0)`) and write one block in their place. Match the surrounding code's conventions for `currencyFmt`, bold styling, and row cursor advancement — read 40 lines above line 518 first.

```typescript
if (summary.categoryTotals.length > 0) {
  const header = sheet.addRow(["Category", "In", "Out", "Net"]);
  header.font = { bold: true };

  for (const group of summary.categoryTotals) {
    const row = sheet.addRow([
      group.parentName,
      group.totalIn,
      group.totalOut,
      group.net,
    ]);
    if (group.children.length > 0) row.font = { bold: true };

    for (const child of group.children) {
      sheet.addRow([`    ${child.name}`, child.in, child.out, child.net]);
    }
  }

  const totalRow = sheet.addRow([
    "Total",
    summary.totalIncome,
    summary.totalExpenses,
    summary.netChange,
  ]);
  totalRow.font = { bold: true };

  for (let r = header.number + 1; r <= totalRow.number; r++) {
    for (let c = 2; c <= 4; c++) {
      sheet.getCell(r, c).numFmt = currencyFmt;
    }
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/excel/generate-report.test.ts`
Expected: PASS. Update any pre-existing assertions in that file that referenced the removed INCOME/EXPENSES rows — rewrite them against the new layout rather than deleting them.

- [ ] **Step 5: Commit**

```bash
git add lib/excel/generate-report.ts lib/excel/generate-report.test.ts
git commit -m "feat(excel): render category summary as In/Out/Net"
```

---

### Task 4: PDF summary renders categoryTotals

**Files:**
- Modify: `lib/pdf/generate-report.ts:481-600` (income, expense, and net summary sections)
- Test: `lib/pdf/generate-report.test.ts`

**Interfaces:**
- Consumes: `ReportSummary.categoryTotals`
- Produces: a summary page with one four-column autotable

- [ ] **Step 1: Write the failing test**

Follow the existing assertion style in `lib/pdf/generate-report.test.ts` — that file already mocks or inspects `jspdf-autotable` calls. Assert on the captured table config.

```typescript
it("builds one category table with In/Out/Net columns", () => {
  generatePdfReport(makeReportData({
    summary: {
      totalIncome: 8200,
      totalExpenses: 5100,
      netChange: 3100,
      balanceByStatus: { uncleared: 0, cleared: 3100, reconciled: 0 },
      incomeByCategory: [],
      expensesByCategory: [],
      netByCategory: [],
      categoryTotals: [
        { parentName: "Poinsettias", children: [], totalIn: 8200, totalOut: 5100, net: 3100 },
      ],
    },
  }));

  const categoryTable = capturedTables().find(
    (t) => t.head?.[0]?.[0] === "Category"
  );

  expect(categoryTable).toBeDefined();
  expect(categoryTable!.head[0]).toEqual(["Category", "In", "Out", "Net"]);
  expect(categoryTable!.body).toContainEqual([
    "Poinsettias",
    "$8,200.00",
    "$5,100.00",
    "$3,100.00",
  ]);
});
```

`capturedTables()` should read the recorded `autoTable` invocations; if the test file already has such a helper, reuse it rather than adding a second one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/pdf/generate-report.test.ts`
Expected: FAIL — no table with a `Category` header exists.

- [ ] **Step 3: Replace the three sections with one**

Delete the blocks at `lib/pdf/generate-report.ts:481-600` guarded by `summary.incomeByCategory`, `summary.expensesByCategory`, and `summary.netByCategory`. Replace with a single autotable. Read 40 lines above line 481 first to match the file's existing `formatCurrency`, `MARGIN`, and running-`y` conventions.

```typescript
if (summary.categoryTotals.length > 0) {
  const body: string[][] = [];

  for (const group of summary.categoryTotals) {
    body.push([
      group.parentName,
      formatCurrency(group.totalIn),
      formatCurrency(group.totalOut),
      formatCurrency(group.net),
    ]);
    for (const child of group.children) {
      body.push([
        `    ${child.name}`,
        formatCurrency(child.in),
        formatCurrency(child.out),
        formatCurrency(child.net),
      ]);
    }
  }

  body.push([
    "Total",
    formatCurrency(summary.totalIncome),
    formatCurrency(summary.totalExpenses),
    formatCurrency(summary.netChange),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Category", "In", "Out", "Net"]],
    body,
    theme: "grid",
    styles: { fontSize: 9 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/pdf/generate-report.test.ts`
Expected: PASS. Rewrite any pre-existing assertions about the removed sections.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/generate-report.ts lib/pdf/generate-report.test.ts
git commit -m "feat(pdf): render category summary as In/Out/Net"
```

---

### Task 5: Reports page renders categoryTotals

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/reports/page.tsx`

**Interfaces:**
- Consumes: `ReportSummary.categoryTotals`
- Produces: no exported interface — UI only

- [ ] **Step 1: Locate the current sections**

Run: `grep -n "incomeByCategory\|expensesByCategory\|netByCategory" "app/(dashboard)/organizations/[orgId]/reports/page.tsx"`

Read the full JSX block around each hit before editing so the replacement matches the page's existing card, table, and `formatCurrency` conventions.

- [ ] **Step 2: Replace with a single table**

Delete the three category sections and render one table. Wrap it in whatever `Card` / `CardHeader` / `CardContent` shell the page already uses for the removed sections, and reuse the page's existing `formatCurrency` import.

```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b text-muted-foreground">
      <th className="py-2 text-left font-medium">Category</th>
      <th className="py-2 text-right font-medium">In</th>
      <th className="py-2 text-right font-medium">Out</th>
      <th className="py-2 text-right font-medium">Net</th>
    </tr>
  </thead>
  <tbody>
    {summary.categoryTotals.map((group) => (
      <Fragment key={group.parentName}>
        <tr className="border-b">
          <td className={group.children.length > 0 ? "py-2 font-medium" : "py-2"}>
            {group.parentName}
          </td>
          <td className="py-2 text-right">{formatCurrency(group.totalIn)}</td>
          <td className="py-2 text-right">{formatCurrency(group.totalOut)}</td>
          <td className={`py-2 text-right ${group.net < 0 ? "text-destructive" : ""}`}>
            {formatCurrency(group.net)}
          </td>
        </tr>
        {group.children.map((child) => (
          <tr key={`${group.parentName}-${child.name}`} className="border-b">
            <td className="py-2 pl-6 text-muted-foreground">{child.name}</td>
            <td className="py-2 text-right">{formatCurrency(child.in)}</td>
            <td className="py-2 text-right">{formatCurrency(child.out)}</td>
            <td className={`py-2 text-right ${child.net < 0 ? "text-destructive" : ""}`}>
              {formatCurrency(child.net)}
            </td>
          </tr>
        ))}
      </Fragment>
    ))}
    <tr className="font-medium">
      <td className="py-2">Total</td>
      <td className="py-2 text-right">{formatCurrency(summary.totalIncome)}</td>
      <td className="py-2 text-right">{formatCurrency(summary.totalExpenses)}</td>
      <td className={`py-2 text-right ${summary.netChange < 0 ? "text-destructive" : ""}`}>
        {formatCurrency(summary.netChange)}
      </td>
    </tr>
  </tbody>
</table>
```

Add `Fragment` to the `react` import. Children are indented with `pl-6`, not with leading spaces in the string — the Excel and PDF exports pad with spaces because those formats carry no styling, but HTML should not. If the page's existing destructive class differs from `text-destructive`, use the page's.

- [ ] **Step 3: Verify the page compiles**

Run: `npx tsc --noEmit`
Expected: the 4 baseline errors, unchanged. No new errors.

- [ ] **Step 4: Verify the page renders**

Run: `npm run dev`, open an organization's Reports page, generate a report for a period with activity, and confirm the category table shows In/Out/Net with a two-sided category on a single row.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/reports/page.tsx"
git commit -m "feat(reports): render category summary as In/Out/Net"
```

---

### Task 6: Contract — delete the old summary shape

Every consumer now reads `categoryTotals`. Remove the old fields and the name-matching merge.

**Files:**
- Modify: `lib/reports/types.ts`
- Modify: `lib/reports/report-utils.ts`
- Modify: `lib/reports/report-utils.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `ReportSummary` with exactly `totalIncome`, `totalExpenses`, `netChange`, `balanceByStatus`, `categoryTotals`

- [ ] **Step 1: Delete the merge block**

In `lib/reports/report-utils.ts` `computeSummary`, delete everything from the `// Detect parent names present in both income and expense` comment through the `filteredExpenses` assignment — this is the `netByCategory` string-matching join, spec §1. Return only the five surviving fields.

- [ ] **Step 2: Delete the dead builder**

Delete `buildCategorySummaries` and its tests. It has no remaining callers — confirm with `grep -rn "buildCategorySummaries" --include="*.ts" --include="*.tsx" . | grep -v node_modules` before deleting.

- [ ] **Step 3: Delete the dead types**

Remove `ReportCategorySummary`, `MergedCategorySummary`, and the three fields from `ReportSummary` in `lib/reports/types.ts`.

- [ ] **Step 4: Fix the fallout**

Run: `npx tsc --noEmit`

Every error is a test fixture still setting `incomeByCategory` / `expensesByCategory` / `netByCategory`. Remove those three keys from each fixture. Expected files: `lib/excel/generate-report.test.ts`, `lib/pdf/generate-report.test.ts`, `app/api/organizations/[orgId]/reports/export/route.test.ts`, `lib/reports/report-utils.test.ts`.

Expected when done: the 4 baseline errors, unchanged.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all files passing, count at or above 577.

- [ ] **Step 6: Commit**

```bash
git add lib/reports/ lib/excel/generate-report.test.ts lib/pdf/generate-report.test.ts "app/api/organizations/[orgId]/reports/export/route.test.ts"
git commit -m "refactor(reports): remove income/expense summary split and name-matching merge"
```

---

### Task 7: Budget net actuals (expand)

Add `netLines` to `BudgetReportData` alongside the existing fields. Actuals become signed, derived from `transaction_type`, with recursive descendant rollup.

**Files:**
- Modify: `lib/reports/fetch-budget-data.ts`
- Create: `lib/reports/fetch-budget-data.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:

```typescript
export interface BudgetNetLine {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  variance: number;
  favorable: boolean;
  percentOfPlan: number | null;
}
```

`BudgetReportData` gains `netLines: BudgetNetLine[]` and `unbudgetedNet: BudgetNetLine[]`, plus `netTotals: { budgeted: number; actual: number; variance: number }`.

- [ ] **Step 1: Extract the pure computation**

The current file mixes Supabase queries with arithmetic, which makes it untestable. Extract two exported pure functions so the arithmetic can be tested without a database:

```typescript
export function collectDescendantIds(
  categoryId: string,
  childrenByParent: Map<string, string[]>
): string[] {
  const out: string[] = [];
  const stack = [...(childrenByParent.get(categoryId) ?? [])];
  const seen = new Set<string>([categoryId]);

  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  return out;
}

export function buildNetLine(
  categoryId: string,
  categoryName: string,
  budgeted: number,
  netByCategory: Map<string, number>,
  childrenByParent: Map<string, string[]>
): BudgetNetLine {
  let actual = netByCategory.get(categoryId) ?? 0;
  for (const id of collectDescendantIds(categoryId, childrenByParent)) {
    actual += netByCategory.get(id) ?? 0;
  }

  return {
    categoryId,
    categoryName,
    budgeted,
    actual,
    variance: actual - budgeted,
    favorable: actual >= budgeted,
    percentOfPlan: budgeted !== 0 ? (actual / budgeted) * 100 : null,
  };
}
```

The `seen` set makes `collectDescendantIds` terminate even if bad data produces a parent cycle.

- [ ] **Step 2: Write the failing tests**

Create `lib/reports/fetch-budget-data.test.ts`. The four cases are spec §5.2's table verbatim.

```typescript
import { describe, expect, it } from "vitest";

import { buildNetLine, collectDescendantIds } from "./fetch-budget-data";

describe("collectDescendantIds", () => {
  it("collects grandchildren, not just direct children", () => {
    const children = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
    ]);
    expect(collectDescendantIds("a", children).sort()).toEqual(["b", "c"]);
  });

  it("terminates on a parent cycle", () => {
    const children = new Map([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    expect(collectDescendantIds("a", children)).toEqual(["b"]);
  });

  it("returns an empty array for a leaf", () => {
    expect(collectDescendantIds("a", new Map())).toEqual([]);
  });
});

describe("buildNetLine", () => {
  const noChildren = new Map<string, string[]>();

  it("under-collected income is unfavorable", () => {
    const line = buildNetLine("c", "Dues", 12400, new Map([["c", 8200]]), noChildren);
    expect(line.variance).toBe(-4200);
    expect(line.favorable).toBe(false);
    expect(line.percentOfPlan).toBeCloseTo(66.13, 2);
  });

  it("under-spent expense is favorable", () => {
    const line = buildNetLine("c", "Repairs", -1000, new Map([["c", -430]]), noChildren);
    expect(line.variance).toBe(570);
    expect(line.favorable).toBe(true);
    expect(line.percentOfPlan).toBeCloseTo(43, 2);
  });

  it("beating a net plan is favorable", () => {
    const line = buildNetLine("c", "Poinsettias", 3100, new Map([["c", 3400]]), noChildren);
    expect(line.variance).toBe(300);
    expect(line.favorable).toBe(true);
    expect(line.percentOfPlan).toBeCloseTo(109.68, 2);
  });

  it("reports a negative percent when a planned-positive activity loses money", () => {
    const line = buildNetLine("c", "Poinsettias", 3100, new Map([["c", -200]]), noChildren);
    expect(line.variance).toBe(-3300);
    expect(line.favorable).toBe(false);
    expect(line.percentOfPlan).toBeCloseTo(-6.45, 2);
  });

  it("returns null percent when nothing is budgeted", () => {
    expect(buildNetLine("c", "X", 0, new Map(), noChildren).percentOfPlan).toBeNull();
  });

  it("rolls descendant activity into a parent line", () => {
    const line = buildNetLine(
      "p",
      "Fundraising",
      3000,
      new Map([["p", 100], ["child", 2900]]),
      new Map([["p", ["child"]]])
    );
    expect(line.actual).toBe(3000);
    expect(line.favorable).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/reports/fetch-budget-data.test.ts`
Expected: FAIL — module has no export named `buildNetLine`.

- [ ] **Step 4: Make actuals signed in the query**

In `fetchBudgetReportData`, the transaction query currently omits `transaction_type`. Add it:

```typescript
    .select(
      `
      id,
      transaction_type,
      accounts!inner(organization_id),
      transaction_line_items(category_id, amount)
    `
    )
```

Replace the `actualsByCategory` accumulation with a signed version:

```typescript
  const netByCategory = new Map<string, number>();
  for (const txn of transactions ?? []) {
    const sign = txn.transaction_type === "income" ? 1 : -1;
    for (const li of txn.transaction_line_items ?? []) {
      const current = netByCategory.get(li.category_id) ?? 0;
      netByCategory.set(li.category_id, current + sign * li.amount);
    }
  }
```

- [ ] **Step 5: Build netLines, unbudgetedNet and netTotals**

Keep the existing `incomeLines` / `expenseLines` / `combinedLines` construction untouched — Task 10 removes it. Add alongside:

```typescript
  const netLines = lineItems.map((li) =>
    buildNetLine(
      li.category_id,
      resolveName(li.category_id),
      li.amount,
      netByCategory,
      childrenByParent
    )
  );

  const unbudgetedNet: BudgetNetLine[] = [];
  for (const [categoryId, actual] of netByCategory) {
    if (budgetedCategoryIds.has(categoryId) || actual === 0) continue;
    unbudgetedNet.push(
      buildNetLine(categoryId, resolveName(categoryId), 0, new Map([[categoryId, actual]]), new Map())
    );
  }
  unbudgetedNet.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  const netTotals = {
    budgeted: netLines.reduce((s, l) => s + l.budgeted, 0),
    actual: netLines.reduce((s, l) => s + l.actual, 0),
    variance: netLines.reduce((s, l) => s + l.variance, 0),
  };
```

The `actual === 0` guard replaces the old `actual > 0` filter. Under net semantics `> 0` would hide every unbudgeted category that lost money — spec §5.3.

`budgetedCategoryIds` must now be built with `collectDescendantIds` rather than the current one-level loop, so a budgeted parent's grandchildren are not also reported as unbudgeted.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: all passing. Existing budget tests still pass — the old fields are unchanged.

- [ ] **Step 7: Commit**

```bash
git add lib/reports/fetch-budget-data.ts lib/reports/fetch-budget-data.test.ts
git commit -m "feat(budgets): compute signed net actuals with recursive rollup"
```

---

### Task 8: Excel and PDF budget sections render netLines

**Files:**
- Modify: `lib/excel/generate-report.ts:642-900` (`addCombinedBudgetSection` and `buildBudgetSheet`)
- Modify: `lib/pdf/generate-report.ts:667-750` (budget page)
- Test: `lib/excel/generate-report.test.ts`, `lib/pdf/generate-report.test.ts`

**Interfaces:**
- Consumes: `BudgetReportData.netLines`, `.unbudgetedNet`, `.netTotals`
- Produces: a single budget table in each format

- [ ] **Step 1: Write the failing tests**

One test per format asserting a single table with headers `["Category", "Budgeted", "Actual", "Variance", "% of Plan"]` and one row per net line. Build the fixture with `netLines: [{ categoryId: "c", categoryName: "Poinsettias", budgeted: 3100, actual: 3400, variance: 300, favorable: true, percentOfPlan: 109.68 }]`. Assert the `% of Plan` cell renders `"109.7%"` and that no `INCOME` / `EXPENSES` / `COMBINED` header remains.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run lib/excel/generate-report.test.ts lib/pdf/generate-report.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace the Excel budget sections**

Delete `addCombinedBudgetSection` entirely, and the `data.incomeLines` and `data.expenseLines` blocks in `buildBudgetSheet`. Replace with:

```typescript
function formatPercentOfPlan(percent: number | null): string {
  return percent === null ? "—" : `${percent.toFixed(1)}%`;
}

const header = sheet.addRow([
  "Category", "Budgeted", "Actual", "Variance", "% of Plan",
]);
header.font = { bold: true };

for (const line of data.netLines) {
  const row = sheet.addRow([
    line.categoryName,
    line.budgeted,
    line.actual,
    line.variance,
    formatPercentOfPlan(line.percentOfPlan),
  ]);
  row.getCell(4).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: line.favorable ? "FFD6F5D6" : "FFF8D7D7" },
  };
  for (let c = 2; c <= 4; c++) row.getCell(c).numFmt = currencyFmt;
}

if (data.unbudgetedNet.length > 0) {
  const unbudgetedHeader = sheet.addRow(["UNBUDGETED"]);
  unbudgetedHeader.font = { bold: true };
  for (const line of data.unbudgetedNet) {
    const row = sheet.addRow([line.categoryName, 0, line.actual, line.variance, "—"]);
    for (let c = 2; c <= 4; c++) row.getCell(c).numFmt = currencyFmt;
  }
}

const totalRow = sheet.addRow([
  "Total",
  data.netTotals.budgeted,
  data.netTotals.actual,
  data.netTotals.variance,
  "",
]);
totalRow.font = { bold: true };
for (let c = 2; c <= 4; c++) totalRow.getCell(c).numFmt = currencyFmt;
```

Fills are keyed on `line.favorable`, not on the sign of the variance — under net semantics a negative budgeted amount makes sign an unreliable proxy.

- [ ] **Step 4: Replace the PDF budget section**

Delete the `budgetData.combinedLines` block at `lib/pdf/generate-report.ts:687` and the income/expense blocks after it. Replace with one autotable, matching the file's existing `formatCurrency`, `MARGIN`, and running-`y` conventions.

```typescript
const budgetBody = budgetData.netLines.map((line) => [
  line.categoryName,
  formatCurrency(line.budgeted),
  formatCurrency(line.actual),
  formatCurrency(line.variance),
  line.percentOfPlan === null ? "—" : `${line.percentOfPlan.toFixed(1)}%`,
]);

for (const line of budgetData.unbudgetedNet) {
  budgetBody.push([
    `${line.categoryName} (unbudgeted)`,
    formatCurrency(0),
    formatCurrency(line.actual),
    formatCurrency(line.variance),
    "—",
  ]);
}

budgetBody.push([
  "Total",
  formatCurrency(budgetData.netTotals.budgeted),
  formatCurrency(budgetData.netTotals.actual),
  formatCurrency(budgetData.netTotals.variance),
  "",
]);

autoTable(doc, {
  startY: budgetY,
  head: [["Category", "Budgeted", "Actual", "Variance", "% of Plan"]],
  body: budgetBody,
  theme: "grid",
  styles: { fontSize: 9 },
  columnStyles: {
    1: { halign: "right" },
    2: { halign: "right" },
    3: { halign: "right" },
    4: { halign: "right" },
  },
});
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run lib/excel/generate-report.test.ts lib/pdf/generate-report.test.ts`
Expected: PASS. Rewrite pre-existing assertions against the old sections.

- [ ] **Step 6: Commit**

```bash
git add lib/excel/generate-report.ts lib/pdf/generate-report.ts lib/excel/generate-report.test.ts lib/pdf/generate-report.test.ts
git commit -m "feat(exports): render budget vs actuals as a single net table"
```

---

### Task 9: Budget detail page renders netLines

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/budgets/[budgetId]/page.tsx`

**Interfaces:**
- Consumes: `BudgetReportData.netLines`, `.unbudgetedNet`, `.netTotals`
- Produces: no exported interface — UI only

- [ ] **Step 1: Collapse the summary cards**

Six cards become three: **Budgeted Net** (`netTotals.budgeted`), **Actual Net** (`netTotals.actual`), **Variance** (`netTotals.variance`). Spec §6.3 — the budgeted-income and budgeted-expense cards have no meaning once a line item is a single signed net.

- [ ] **Step 2: Replace the Income and Expense tables with one**

Delete both section tables and render one. Reuse the page's existing `formatCurrency` and card shell.

```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b text-muted-foreground">
      <th className="py-2 text-left font-medium">Category</th>
      <th className="py-2 text-right font-medium">Budgeted</th>
      <th className="py-2 text-right font-medium">Actual</th>
      <th className="py-2 text-right font-medium">Variance</th>
      <th className="py-2 text-right font-medium">% of Plan</th>
      <th className="py-2 pl-4 text-left font-medium">Progress</th>
    </tr>
  </thead>
  <tbody>
    {budgetData.netLines.map((line) => {
      const barPercent =
        line.percentOfPlan === null
          ? 0
          : Math.max(0, Math.min(line.percentOfPlan, 100));

      return (
        <tr key={line.categoryId} className="border-b">
          <td className="py-2">{line.categoryName}</td>
          <td className="py-2 text-right">{formatCurrency(line.budgeted)}</td>
          <td className="py-2 text-right">{formatCurrency(line.actual)}</td>
          <td
            className={`py-2 text-right ${
              line.favorable ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {formatCurrency(line.variance)}
          </td>
          <td className="py-2 text-right">
            {line.percentOfPlan === null
              ? "—"
              : `${line.percentOfPlan.toFixed(1)}%`}
          </td>
          <td className="py-2 pl-4">
            <div className="h-2 w-24 overflow-hidden rounded bg-muted">
              <div
                className={`h-full ${
                  line.favorable ? "bg-emerald-600" : "bg-destructive"
                }`}
                style={{ width: `${barPercent}%` }}
              />
            </div>
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
```

If the page already has a success colour class other than `text-emerald-600` / `bg-emerald-600`, use the page's rather than introducing a second one.

- [ ] **Step 3: Confirm the clamp is bar-only**

`barPercent` clamps to `[0, 100]` and feeds **only** the bar width. The `% of Plan` cell and every dollar figure render unclamped, including negative percentages — spec §5.2. Verify with a line whose budgeted is `3100` and actual is `-200`: the cell must read `-6.5%` while the bar sits empty and red. If the cell shows `0.0%`, the clamp has leaked into the text.

- [ ] **Step 4: Update the unbudgeted section**

Render `unbudgetedNet` with Category and Actual columns. Negative actuals now appear here; confirm they are not filtered out anywhere in the JSX.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — the 4 baseline errors, unchanged.
Run: `npm run dev`, open a budget detail page, confirm three cards, one table, and a clamped bar.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/organizations/[orgId]/budgets/[budgetId]/page.tsx"
git commit -m "feat(budgets): render budget vs actuals as a single net table"
```

---

### Task 10: Contract — delete budget-combined and the old budget shape

**Files:**
- Delete: `lib/reports/budget-combined.ts`
- Delete: `lib/reports/budget-combined.test.ts`
- Modify: `lib/reports/fetch-budget-data.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `BudgetReportData` with exactly `budgetName`, `startDate`, `endDate`, `status`, `netLines`, `unbudgetedNet`, `netTotals`

- [ ] **Step 1: Confirm there are no remaining consumers**

Run: `grep -rn "budget-combined\|combinedLines\|CombinedBudgetLine\|incomeLines\|expenseLines\|unbudgetedActuals" --include="*.ts" --include="*.tsx" . | grep -v node_modules`

Expected: hits only inside `lib/reports/fetch-budget-data.ts` and the two files being deleted. Any other hit means Task 8 or 9 is incomplete — finish it before continuing.

- [ ] **Step 2: Delete the files**

```bash
git rm lib/reports/budget-combined.ts lib/reports/budget-combined.test.ts
```

This is spec §1's first name-matching site. The second was removed in Task 6.

- [ ] **Step 3: Strip the old fields**

In `lib/reports/fetch-budget-data.ts`, remove the `buildCombinedBudgetLines` import, the `BudgetReportLine` and `UnbudgetedActualLine` interfaces, the `incomeLines` / `expenseLines` / synthetic-line construction, the `totals` object, and those keys from the return value and from `BudgetReportData`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — the 4 baseline errors, unchanged.
Run: `npx vitest run` — all passing.

- [ ] **Step 5: Commit**

```bash
git add -A lib/reports/
git commit -m "refactor(budgets): delete name-matching combined budget lines"
```

---

### Task 11: Budget form accepts a signed net

**Files:**
- Modify: `lib/validations/budget.ts:14-20`
- Modify: `app/(dashboard)/organizations/[orgId]/budgets/budget-form.tsx`
- Test: `lib/validations/budget.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `budgetLineItemSchema` accepting any non-zero number

- [ ] **Step 1: Write the failing validation test**

```typescript
it("accepts a negative net amount", () => {
  const result = budgetLineItemSchema.safeParse({
    category_id: "3f1e6c9a-0000-4000-8000-000000000001",
    amount: -4650,
    notes: "",
  });
  expect(result.success).toBe(true);
});

it("rejects a zero amount", () => {
  const result = budgetLineItemSchema.safeParse({
    category_id: "3f1e6c9a-0000-4000-8000-000000000001",
    amount: 0,
    notes: "",
  });
  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/validations/budget.test.ts`
Expected: FAIL — `.positive()` rejects `-4650`.

- [ ] **Step 3: Change the schema**

In `lib/validations/budget.ts`, replace the `amount` field:

```typescript
  amount: z.coerce
    .number()
    .refine((v) => v !== 0, "Amount must not be zero."),
```

- [ ] **Step 4: Add the direction control to the form**

Treasurers should not have to type minus signs. Keep a positive-magnitude number input and add a direction `Select` beside it.

Add `direction: "in" | "out"` to `LineItemState`. When loading `defaultValues`, derive it: `direction: li.amount < 0 ? "out" : "in"`, and set `amount: String(Math.abs(li.amount))`.

Change the amount `Input` at `budget-form.tsx:480-490` to keep `min="0.01"`, and label it "Expected Net". Add the select:

```tsx
<Select
  value={li.direction}
  onValueChange={(v) => updateLineItem(li.key, "direction", v)}
>
  <SelectTrigger id={`${formId}-li-dir-${li.key}`}>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="in">Net income</SelectItem>
    <SelectItem value="out">Net expense</SelectItem>
  </SelectContent>
</Select>
```

Apply the sign when serialising, replacing the `amount: parseFloat(li.amount)` in `lineItemsJson`:

```typescript
        amount:
          li.direction === "out"
            ? -Math.abs(parseFloat(li.amount))
            : Math.abs(parseFloat(li.amount)),
```

- [ ] **Step 5: Replace the form's totals**

Delete the `categoryTypeMap` at `budget-form.tsx:135-137` and the `totalIncome` / `totalExpenses` loop — they read `category_type`. Replace with a single net total over the signed values, displayed as "Net Budget".

- [ ] **Step 6: Verify**

Run: `npx vitest run lib/validations/budget.test.ts` — PASS.
Run: `npx tsc --noEmit` — the 4 baseline errors, unchanged.
Run: `npm run dev` and create a budget with one Net income and one Net expense line; confirm the Net Budget total is their signed sum.

- [ ] **Step 7: Commit**

```bash
git add lib/validations/budget.ts lib/validations/budget.test.ts "app/(dashboard)/organizations/[orgId]/budgets/budget-form.tsx"
git commit -m "feat(budgets): enter budget line items as signed nets"
```

---

### Task 12: Remove every remaining read of category_type

The column is still `NOT NULL` and still written on insert — that stays until Task 13. This task removes only **reads**.

**Files:** all listed below.

**Interfaces:**
- Consumes: nothing
- Produces: no code outside `supabase/migrations/` and `types/database.ts` reads `category_type`

- [ ] **Step 1: Drop the transaction form's dropdown filter**

`app/(dashboard)/organizations/[orgId]/transactions/transaction-form.tsx`

- Line 152: `(c) => c.category_type === transactionType` → show all categories.
- Line 230: `(c) => !c.parent_id && c.category_type === transactionType` → `(c) => !c.parent_id`.
- Lines 47 and 218: remove `category_type` from the `Pick<>` and the inline type.

Spec decision 3: every active category is selectable on every transaction.

- [ ] **Step 2: Drop the remaining dropdown filters**

Apply the same treatment in:
- `app/(dashboard)/organizations/[orgId]/templates/template-form.tsx`
- `app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/[sessionId]/quick-transaction-dialog.tsx`
- `app/(dashboard)/organizations/[orgId]/transactions/[transactionId]/category-reassign-form.tsx`
- `app/(dashboard)/organizations/[orgId]/categories/create-category-dialog.tsx`

- [ ] **Step 3: Drop the fee category type check**

`app/(dashboard)/organizations/[orgId]/accounts/actions.ts` lines 56, 69, 148, 161. Remove `category_type` from both `.select(...)` calls and delete both `if (feeCat.category_type !== "expense")` guards. Keep the organization and `is_active` checks — only the type check goes. Spec §9.

- [ ] **Step 4: Drop category_type from every remaining select and prop**

Run: `grep -rln "category_type" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v "^./types/database.ts"`

Work the list. Remaining hits are `.select("... category_type ...")` strings, `Pick<>` unions, and page-level props in the transactions, templates, reconcile, budgets, and organization-overview pages. Leave `app/(dashboard)/organizations/[orgId]/categories/**` alone — Task 13 handles the write path.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — the 4 baseline errors, unchanged.
Run: `npx vitest run` — all passing. Tests asserting that a dropdown filters by type must be **rewritten to assert all categories are offered**, not deleted.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(categories): stop filtering and reading category_type"
```

---

### Task 13: Migration, RPC rewrite, and category write path

The destructive step. Schema and write path change together because `category_type` is `NOT NULL` with no default — inserts must keep supplying it right up until the column is dropped.

**Files:**
- Create: `supabase/migrations/20260826000001_untyped_categories.sql`
- Modify: `types/database.ts` (regenerated)
- Modify: `lib/validations/category.ts`
- Modify: `app/(dashboard)/organizations/[orgId]/categories/category-form.tsx`
- Modify: `app/(dashboard)/organizations/[orgId]/categories/actions.ts`
- Modify: `app/(dashboard)/organizations/[orgId]/categories/page.tsx`, `[categoryId]/page.tsx`, `[categoryId]/category-actions.tsx`
- Test: `app/(dashboard)/organizations/[orgId]/categories/actions.test.ts`, `lib/validations/category.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `categories` with no `category_type`; `merge_categories` returning `reassigned_line_items`, `reassigned_template_line_items`, `reassigned_budget_line_items`, `merged_budget_line_items`, `reassigned_fee_accounts`

- [ ] **Step 1: Snapshot the database**

**Do this before anything else.** The migration is not reversible — merged categories cannot be split back apart, because which line item came from which half of the pair is destroyed. Spec §4 Rollback.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260826000001_untyped_categories.sql`. Step order is load-bearing: the signing in step 1 reads `category_type`, which the final `ALTER` destroys.

```sql
-- Migration: Untyped categories and signed budget amounts
-- Direction now comes from transactions.transaction_type, not the category.
-- NOT REVERSIBLE. Snapshot before applying.

-- Step 1: sign budget amounts while category_type still exists.
UPDATE public.budget_line_items AS bli
   SET amount = -bli.amount
  FROM public.categories AS c
 WHERE c.id = bli.category_id
   AND c.category_type = 'expense';

-- Steps 2-4: merge duplicate-name categories, repeating until none remain.
-- Merging a parent repoints its children, which can create new duplicate
-- siblings, so a single pass is not enough.
DO $$
DECLARE
  r RECORD;
  v_found BOOLEAN;
  v_fee_before INTEGER;
  v_fee_after INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_fee_before
    FROM public.accounts WHERE fee_category_id IS NOT NULL;

  LOOP
    v_found := FALSE;

    FOR r IN
      SELECT id AS dup_id, survivor_id
        FROM (
          SELECT id,
                 first_value(id) OVER (
                   PARTITION BY organization_id, parent_id, lower(trim(name))
                   ORDER BY created_at, id
                 ) AS survivor_id
            FROM public.categories
        ) s
       WHERE id <> survivor_id
    LOOP
      v_found := TRUE;

      -- Survivor stays active if any member of the group was active.
      UPDATE public.categories SET is_active = TRUE
       WHERE id = r.survivor_id
         AND EXISTS (
           SELECT 1 FROM public.categories d
            WHERE d.id = r.dup_id AND d.is_active
         );

      UPDATE public.transaction_line_items
         SET category_id = r.survivor_id WHERE category_id = r.dup_id;

      UPDATE public.recurring_template_line_items
         SET category_id = r.survivor_id WHERE category_id = r.dup_id;

      UPDATE public.categories
         SET parent_id = r.survivor_id WHERE parent_id = r.dup_id;

      -- ON DELETE SET NULL, so a miss here fails silently. Asserted below.
      UPDATE public.accounts
         SET fee_category_id = r.survivor_id WHERE fee_category_id = r.dup_id;

      -- Budget lines: sum signed amounts into the survivor's row.
      UPDATE public.budget_line_items AS tgt
         SET amount = tgt.amount + src.amount,
             notes = CASE
               WHEN tgt.notes IS NULL OR tgt.notes = '' THEN src.notes
               WHEN src.notes IS NULL OR src.notes = '' THEN tgt.notes
               ELSE tgt.notes || '; ' || src.notes
             END
        FROM public.budget_line_items AS src
       WHERE src.category_id = r.dup_id
         AND tgt.category_id = r.survivor_id
         AND src.budget_id = tgt.budget_id;

      DELETE FROM public.budget_line_items AS src
       USING public.budget_line_items AS tgt
       WHERE src.category_id = r.dup_id
         AND tgt.category_id = r.survivor_id
         AND src.budget_id = tgt.budget_id;

      UPDATE public.budget_line_items
         SET category_id = r.survivor_id WHERE category_id = r.dup_id;

      DELETE FROM public.categories WHERE id = r.dup_id;
    END LOOP;

    EXIT WHEN NOT v_found;
  END LOOP;

  SELECT COUNT(*) INTO v_fee_after
    FROM public.accounts WHERE fee_category_id IS NOT NULL;

  IF v_fee_after <> v_fee_before THEN
    RAISE EXCEPTION
      'Migration would orphan fee configuration on % account(s).',
      v_fee_before - v_fee_after;
  END IF;
END $$;

-- A merged pair can net to exactly zero (income 5000 + expense -5000).
-- Such a line carries no information and would violate the constraint below.
DELETE FROM public.budget_line_items WHERE amount = 0;

-- Step 5: drop the column and apply the new constraints.
ALTER TABLE public.categories DROP COLUMN category_type;

ALTER TABLE public.budget_line_items
  DROP CONSTRAINT budget_line_items_amount_check;

ALTER TABLE public.budget_line_items
  ADD CONSTRAINT budget_line_items_amount_nonzero CHECK (amount <> 0);

-- UNIQUE treats NULLs as distinct, which would let two top-level categories
-- share a name; NULLS NOT DISTINCT (PG15+) closes that. Scoped to active rows
-- so a deactivated category can keep its name.
CREATE UNIQUE INDEX idx_categories_unique_active_name
  ON public.categories (organization_id, parent_id, lower(trim(name)))
  NULLS NOT DISTINCT
  WHERE is_active;
```

- [ ] **Step 3: Rewrite merge_categories in the same migration**

Append to the same file. Copy `supabase/migrations/20260203000002_update_merge_categories_for_budgets.sql` as the starting point and make exactly four changes: drop `category_type` from both `SELECT ... INTO` lists; delete the `IF v_source.category_type <> v_target.category_type` guard; add the `accounts.fee_category_id` repoint, which the current version omits entirely; add `reassigned_fee_accounts` to the returned JSON.

- [ ] **Step 4: Verify the migration against a seeded database**

Apply to a scratch database, not production. Seed the cases from spec §8 and assert each:

| Seed | Assertion |
|------|-----------|
| Income "Poinsettias" + expense "Poinsettias", both with transactions | One category remains; both sets of line items point at it |
| Budget lines 8200 (income) and 5100 (expense) on that pair | One line remains with `amount = 3100` |
| Parent pair whose children also pair | All four collapse to two; children hang off the surviving parent |
| Account whose `fee_category_id` is the non-survivor | `fee_category_id` points at the survivor; migration does not raise |
| Same name under two different parents | Both survive untouched |
| One member inactive, one active | Survivor has `is_active = TRUE` |
| Budget lines 5000 (income) and 5000 (expense) on a pair | The zero-net line is deleted, and the migration completes |

- [ ] **Step 5: Apply and regenerate types**

Apply the migration, then regenerate:

```bash
npx supabase gen types typescript --linked > types/database.ts
```

Confirm `category_type` is gone from `types/database.ts`.

- [ ] **Step 6: Remove category_type from the write path**

`npx tsc --noEmit` now reports every remaining write. Fix each:

- `lib/validations/category.ts`: delete `CATEGORY_TYPES`, `CATEGORY_TYPE_LABELS`, and the `category_type` field from `createCategorySchema`.
- `categories/category-form.tsx`: delete the Category Type `Select` (lines ~191-200), the `category_type` hidden input (line ~96), the `selectedParent.category_type` derivation (line ~56), and the income/expense parent partition (lines ~60-63) — the parent dropdown now lists all top-level categories.
- `categories/actions.ts`: remove `category_type` from insert and update payloads and from any type-equality validation.
- `categories/page.tsx`, `[categoryId]/page.tsx`, `[categoryId]/category-actions.tsx`: remove the type badge and any type-based grouping.

- [ ] **Step 7: Update the category tests**

`categories/actions.test.ts` and `lib/validations/category.test.ts` assert type behavior throughout, including a test that cross-type merges are rejected. **That test must now assert the opposite** — a cross-type merge is exactly what the model enables. Rewrite it; do not delete it.

Three of the four baseline `tsc` errors live in `categories/actions.test.ts`. Fix them while you are in the file — they are mock return types that do not match the RPC signature. The baseline drops from 4 errors to 1 after this task.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit` — expect **1 error** (`lib/excel/generate-report.test.ts` Buffer type), down from 4.
Run: `npx vitest run` — all passing.
Run: `npm run lint` — 3 problems, unchanged.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(categories): drop category_type and merge duplicate-name pairs"
```

---

### Task 14: Final verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Confirm category_type is fully gone**

Run: `grep -rn "category_type" --include="*.ts" --include="*.tsx" . | grep -v node_modules`

Expected: **no hits.** `types/database.ts` was regenerated and `supabase/migrations/` is excluded by the `--include` filters, so any hit is live code that was missed.

- [ ] **Step 2: Confirm both name-matching sites are gone**

Run: `grep -rn "budget-combined\|MergedCategorySummary\|netByCategory\|buildCategorySummaries" --include="*.ts" --include="*.tsx" . | grep -v node_modules`

Expected: no hits. This is the defect from spec §1.

- [ ] **Step 3: Run everything**

```bash
npx vitest run
npx tsc --noEmit
npm run lint
npm run build
```

Expected: tests all passing; `tsc` **1 error** (down from 4); lint **3 problems** (unchanged); build succeeds.

Report the actual numbers. Do not describe the result as "clean" — the pre-existing lint problems and the Buffer type error remain.

- [ ] **Step 4: Exercise the app end to end**

With `npm run dev`:
1. Create a category — confirm no type field is offered.
2. Create an income transaction and an expense transaction against that **same** category.
3. Open Reports — the category appears on one row with In, Out, and Net populated.
4. Create a budget with a Net income line and a Net expense line.
5. Open the budget detail page — one table, three cards, correct variance signs, bar clamped at 0 for any negative percent.
6. Export Excel and PDF — both show the single net table.
7. Merge two categories that were formerly different types — confirm it now succeeds.

- [ ] **Step 5: Commit any fixes and open the PR**

```bash
git add -A
git commit -m "test: verify untyped categories end to end"
git push -u origin feat/untyped-categories
gh pr create --title "Untyped categories and net budgeting" --body "Implements docs/superpowers/specs/2026-08-26-untyped-categories-design.md"
```

Note in the PR body that the migration is **not reversible** and that a database snapshot must be taken before it is applied on merge.
