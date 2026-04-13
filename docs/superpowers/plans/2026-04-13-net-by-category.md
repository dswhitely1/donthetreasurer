# Net by Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Net by Category" section to reports that merges parent categories appearing in both income and expense into a unified view showing income totals, expense totals, and net amounts.

**Architecture:** Extend `computeSummary()` to detect parent category names appearing in both `incomeByCategory` and `expensesByCategory`, extract them into a new `netByCategory` field on `ReportSummary`, and remove them from the original arrays. All three outputs (UI, Excel, PDF) consume this pre-computed data.

**Tech Stack:** TypeScript, React (Server Component), ExcelJS, jsPDF + jspdf-autotable, Vitest

---

### Task 1: Add `MergedCategorySummary` type and update `ReportSummary`

**Files:**
- Modify: `lib/reports/types.ts:29-46`

- [ ] **Step 1: Add the new type and update `ReportSummary`**

In `lib/reports/types.ts`, add the `MergedCategorySummary` interface after `ReportCategorySummary` (line 33), and add `netByCategory` to `ReportSummary`:

```typescript
export interface MergedCategorySummary {
  parentName: string;
  incomeChildren: { name: string; total: number }[];
  expenseChildren: { name: string; total: number }[];
  totalIncome: number;
  totalExpenses: number;
  net: number;
}
```

Add to `ReportSummary` after `expensesByCategory`:

```typescript
  netByCategory: MergedCategorySummary[];
```

- [ ] **Step 2: Fix the TypeScript error in `computeSummary` return**

In `lib/reports/report-utils.ts`, add `netByCategory: []` to the return object of `computeSummary()` at line 116 (temporary — Task 2 will implement the real logic):

```typescript
  return {
    totalIncome,
    totalExpenses,
    netChange: totalIncome - totalExpenses,
    balanceByStatus,
    incomeByCategory,
    expensesByCategory,
    netByCategory: [],
  };
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add lib/reports/types.ts lib/reports/report-utils.ts
git commit -m "feat: add MergedCategorySummary type and netByCategory field to ReportSummary"
```

---

### Task 2: Write failing tests for merge logic in `computeSummary`

**Files:**
- Modify: `lib/reports/report-utils.test.ts`

- [ ] **Step 1: Add test for categories with both income and expense**

Add to the `computeSummary` describe block in `lib/reports/report-utils.test.ts`:

```typescript
  it("merges parent categories with both income and expense into netByCategory", () => {
    const dualNameMap = {
      c1: "Band Gigs",
      c2: "Wedding Gigs",
      c3: "Equipment Rental",
      c4: "Supplies",
    };
    const dualParentMap: Record<string, string | null> = {
      c1: null,
      c2: "c1",
      c3: "c1",
      c4: null,
    };

    const transactions: ReportTransaction[] = [
      makeTxn({
        id: "t1",
        transactionType: "income",
        amount: 500,
        lineItems: [
          { categoryLabel: "Band Gigs → Wedding Gigs", amount: 500, memo: null },
        ],
      }),
      makeTxn({
        id: "t2",
        transactionType: "expense",
        amount: 200,
        lineItems: [
          { categoryLabel: "Band Gigs → Equipment Rental", amount: 200, memo: null },
        ],
      }),
      makeTxn({
        id: "t3",
        transactionType: "expense",
        amount: 50,
        lineItems: [{ categoryLabel: "Supplies", amount: 50, memo: null }],
      }),
    ];

    const result = computeSummary(transactions, dualNameMap, dualParentMap);

    // "Band Gigs" has both income and expense → merged
    expect(result.netByCategory).toHaveLength(1);
    expect(result.netByCategory[0].parentName).toBe("Band Gigs");
    expect(result.netByCategory[0].incomeChildren).toEqual([
      { name: "Wedding Gigs", total: 500 },
    ]);
    expect(result.netByCategory[0].expenseChildren).toEqual([
      { name: "Equipment Rental", total: 200 },
    ]);
    expect(result.netByCategory[0].totalIncome).toBe(500);
    expect(result.netByCategory[0].totalExpenses).toBe(200);
    expect(result.netByCategory[0].net).toBe(300);

    // "Band Gigs" removed from income and expense arrays
    expect(result.incomeByCategory).toHaveLength(0);
    expect(result.expensesByCategory).toHaveLength(1);
    expect(result.expensesByCategory[0].parentName).toBe("Supplies");
  });
```

- [ ] **Step 2: Add test for no overlap (no merged categories)**

```typescript
  it("leaves netByCategory empty when no parent names overlap", () => {
    const transactions: ReportTransaction[] = [
      makeTxn({
        id: "t1",
        transactionType: "income",
        amount: 500,
        lineItems: [
          { categoryLabel: "Donations → Individual", amount: 500, memo: null },
        ],
      }),
      makeTxn({
        id: "t2",
        transactionType: "expense",
        amount: 200,
        lineItems: [{ categoryLabel: "Supplies", amount: 200, memo: null }],
      }),
    ];

    const result = computeSummary(transactions, nameMap, parentMap);
    expect(result.netByCategory).toHaveLength(0);
    expect(result.incomeByCategory).toHaveLength(1);
    expect(result.expensesByCategory).toHaveLength(1);
  });
```

- [ ] **Step 3: Add test for collapsed root categories merging**

```typescript
  it("merges collapsed root categories that appear in both income and expense", () => {
    const rootNameMap = {
      c1: "Merchandise",
      c2: "Supplies",
    };
    const rootParentMap: Record<string, string | null> = {
      c1: null,
      c2: null,
    };

    const transactions: ReportTransaction[] = [
      makeTxn({
        id: "t1",
        transactionType: "income",
        amount: 300,
        lineItems: [{ categoryLabel: "Merchandise", amount: 300, memo: null }],
      }),
      makeTxn({
        id: "t2",
        transactionType: "expense",
        amount: 100,
        lineItems: [{ categoryLabel: "Merchandise", amount: 100, memo: null }],
      }),
    ];

    const result = computeSummary(transactions, rootNameMap, rootParentMap);
    expect(result.netByCategory).toHaveLength(1);
    expect(result.netByCategory[0].parentName).toBe("Merchandise");
    // Collapsed roots have empty children arrays
    expect(result.netByCategory[0].incomeChildren).toEqual([]);
    expect(result.netByCategory[0].expenseChildren).toEqual([]);
    expect(result.netByCategory[0].totalIncome).toBe(300);
    expect(result.netByCategory[0].totalExpenses).toBe(100);
    expect(result.netByCategory[0].net).toBe(200);
  });
```

- [ ] **Step 4: Add test for alphabetical sorting of merged categories**

```typescript
  it("sorts netByCategory alphabetically by parentName", () => {
    const sortNameMap = {
      c1: "Zebra Events",
      c2: "Gig A",
      c3: "Alpha Shows",
      c4: "Show B",
    };
    const sortParentMap: Record<string, string | null> = {
      c1: null,
      c2: "c1",
      c3: null,
      c4: "c3",
    };

    const transactions: ReportTransaction[] = [
      makeTxn({
        id: "t1",
        transactionType: "income",
        amount: 100,
        lineItems: [{ categoryLabel: "Zebra Events → Gig A", amount: 100, memo: null }],
      }),
      makeTxn({
        id: "t2",
        transactionType: "expense",
        amount: 50,
        lineItems: [{ categoryLabel: "Zebra Events → Gig A", amount: 50, memo: null }],
      }),
      makeTxn({
        id: "t3",
        transactionType: "income",
        amount: 200,
        lineItems: [{ categoryLabel: "Alpha Shows → Show B", amount: 200, memo: null }],
      }),
      makeTxn({
        id: "t4",
        transactionType: "expense",
        amount: 75,
        lineItems: [{ categoryLabel: "Alpha Shows → Show B", amount: 75, memo: null }],
      }),
    ];

    const result = computeSummary(transactions, sortNameMap, sortParentMap);
    expect(result.netByCategory).toHaveLength(2);
    expect(result.netByCategory[0].parentName).toBe("Alpha Shows");
    expect(result.netByCategory[1].parentName).toBe("Zebra Events");
  });
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: 4 new tests FAIL (merge logic not yet implemented — `netByCategory` is always `[]`)

- [ ] **Step 6: Commit failing tests**

```bash
git add lib/reports/report-utils.test.ts
git commit -m "test: add failing tests for netByCategory merge logic in computeSummary"
```

---

### Task 3: Implement merge logic in `computeSummary`

**Files:**
- Modify: `lib/reports/report-utils.ts:82-124`

- [ ] **Step 1: Update the import in `report-utils.ts`**

Add `MergedCategorySummary` to the import from `./types`:

```typescript
import type { ReportTransaction, ReportCategorySummary, ReportSummary, MergedCategorySummary } from "./types";
```

- [ ] **Step 2: Replace the return section of `computeSummary` with merge logic**

Replace lines 113-124 of `lib/reports/report-utils.ts` (from `const incomeByCategory =` to the closing `}`) with:

```typescript
  const incomeByCategory = buildCategorySummaries(incomeByCatId, categoryNameMap, categoryParentMap);
  const expensesByCategory = buildCategorySummaries(expenseByCatId, categoryNameMap, categoryParentMap);

  // Detect parent names present in both income and expense
  const incomeParentNames = new Set(incomeByCategory.map((g) => g.parentName));
  const expenseParentNames = new Set(expensesByCategory.map((g) => g.parentName));
  const mergedParentNames = new Set(
    [...incomeParentNames].filter((name) => expenseParentNames.has(name))
  );

  // Build merged categories and filter originals
  const netByCategory: MergedCategorySummary[] = [];

  if (mergedParentNames.size > 0) {
    const incomeByParent = new Map(incomeByCategory.map((g) => [g.parentName, g]));
    const expenseByParent = new Map(expensesByCategory.map((g) => [g.parentName, g]));

    for (const parentName of [...mergedParentNames].sort()) {
      const incomeGroup = incomeByParent.get(parentName)!;
      const expenseGroup = expenseByParent.get(parentName)!;

      netByCategory.push({
        parentName,
        incomeChildren: incomeGroup.children,
        expenseChildren: expenseGroup.children,
        totalIncome: incomeGroup.subtotal,
        totalExpenses: expenseGroup.subtotal,
        net: incomeGroup.subtotal - expenseGroup.subtotal,
      });
    }
  }

  const filteredIncome = incomeByCategory.filter((g) => !mergedParentNames.has(g.parentName));
  const filteredExpenses = expensesByCategory.filter((g) => !mergedParentNames.has(g.parentName));

  return {
    totalIncome,
    totalExpenses,
    netChange: totalIncome - totalExpenses,
    balanceByStatus,
    incomeByCategory: filteredIncome,
    expensesByCategory: filteredExpenses,
    netByCategory,
  };
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run lib/reports/report-utils.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Run full build check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add lib/reports/report-utils.ts
git commit -m "feat: implement netByCategory merge logic in computeSummary"
```

---

### Task 4: Add "Net by Category" UI section to reports page

**Files:**
- Modify: `app/(dashboard)/organizations/[orgId]/reports/page.tsx`

- [ ] **Step 1: Add the Net by Category card after the category breakdowns grid**

After the closing `</div>` of the `grid gap-4 lg:grid-cols-2` div (line 399 in the reports page), add:

```tsx
          {/* Net by Category */}
          {reportData.summary.netByCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Net by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reportData.summary.netByCategory.map((group) => (
                    <div key={group.parentName} className="space-y-1">
                      <p className="font-semibold text-sm">{group.parentName}</p>

                      {/* Income children */}
                      <div className="ml-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Income</p>
                        <div className="ml-2 space-y-0.5">
                          {group.incomeChildren.length > 0 ? (
                            group.incomeChildren.map((child) => (
                              <div key={child.name} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{child.name}</span>
                                <span className="tabular-nums text-income">{formatCurrency(child.total)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">(root)</span>
                              <span className="tabular-nums text-income">{formatCurrency(group.totalIncome)}</span>
                            </div>
                          )}
                          {group.incomeChildren.length > 1 && (
                            <div className="flex justify-between text-sm font-medium border-t border-border pt-1 mt-1">
                              <span className="italic">Subtotal</span>
                              <span className="tabular-nums text-income">{formatCurrency(group.totalIncome)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expense children */}
                      <div className="ml-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expenses</p>
                        <div className="ml-2 space-y-0.5">
                          {group.expenseChildren.length > 0 ? (
                            group.expenseChildren.map((child) => (
                              <div key={child.name} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{child.name}</span>
                                <span className="tabular-nums text-expense">{formatCurrency(child.total)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">(root)</span>
                              <span className="tabular-nums text-expense">{formatCurrency(group.totalExpenses)}</span>
                            </div>
                          )}
                          {group.expenseChildren.length > 1 && (
                            <div className="flex justify-between text-sm font-medium border-t border-border pt-1 mt-1">
                              <span className="italic">Subtotal</span>
                              <span className="tabular-nums text-expense">{formatCurrency(group.totalExpenses)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Net for this parent */}
                      <div className="ml-4 flex justify-between text-sm font-semibold border-t border-border pt-1 mt-1">
                        <span>Net</span>
                        <span className={`tabular-nums ${group.net >= 0 ? "text-income" : "text-expense"}`}>
                          {formatCurrency(group.net)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Combined net total */}
                  {reportData.summary.netByCategory.length > 1 && (
                    <div className="flex justify-between text-sm font-bold border-t-2 border-border pt-2 mt-2">
                      <span>Combined Net Total</span>
                      <span className={`tabular-nums ${
                        reportData.summary.netByCategory.reduce((s, g) => s + g.net, 0) >= 0
                          ? "text-income"
                          : "text-expense"
                      }`}>
                        {formatCurrency(reportData.summary.netByCategory.reduce((s, g) => s + g.net, 0))}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
```

- [ ] **Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/organizations/\[orgId\]/reports/page.tsx
git commit -m "feat: add Net by Category section to reports page UI"
```

---

### Task 5: Add "Net by Category" Excel worksheet

**Files:**
- Modify: `lib/excel/generate-report.ts`

- [ ] **Step 1: Add the import for `MergedCategorySummary`**

Update the import at line 3 of `lib/excel/generate-report.ts`:

```typescript
import type { AccountBalanceSummary, MergedCategorySummary, ReportData, ReportTransaction, SeasonsReportData } from "@/lib/reports/types";
```

- [ ] **Step 2: Add `buildNetByCategorySheet` function**

Add after the `buildSummarySheet` function (after line 565):

```typescript
function buildNetByCategorySheet(
  workbook: ExcelJS.Workbook,
  netByCategory: MergedCategorySummary[]
) {
  const sheet = workbook.addWorksheet("Net by Category");
  const currencyFmt = "$#,##0.00";

  sheet.getColumn(1).width = 32; // Label
  sheet.getColumn(2).width = 4;  // Spacer
  sheet.getColumn(3).width = 16; // Amount

  const HEADER_FILL: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  const HEADER_FONT: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 10,
  };

  // Header row
  const headerRow = sheet.getRow(1);
  headerRow.getCell(1).value = "NET BY CATEGORY";
  headerRow.getCell(1).font = { ...HEADER_FONT, size: 14 };
  headerRow.getCell(1).fill = HEADER_FILL;
  headerRow.getCell(2).fill = HEADER_FILL;
  headerRow.getCell(3).fill = HEADER_FILL;
  sheet.mergeCells("A1:C1");

  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];

  let row = 3;

  function writeLabel(r: number, label: string, opts?: { bold?: boolean; italic?: boolean; indent?: boolean }) {
    const cell = sheet.getRow(r).getCell(1);
    cell.value = opts?.indent ? `  ${label}` : label;
    const font: Partial<ExcelJS.Font> = {};
    if (opts?.bold) font.bold = true;
    if (opts?.italic) font.italic = true;
    if (Object.keys(font).length > 0) cell.font = font;
  }

  function writeAmount(r: number, amount: number, opts?: { bold?: boolean; italic?: boolean; color?: string }) {
    const cell = sheet.getRow(r).getCell(3);
    cell.value = amount;
    cell.numFmt = currencyFmt;
    cell.alignment = { horizontal: "right" };
    const font: Partial<ExcelJS.Font> = {};
    if (opts?.bold) font.bold = true;
    if (opts?.italic) font.italic = true;
    if (opts?.color) font.color = { argb: opts.color };
    if (Object.keys(font).length > 0) cell.font = font;
  }

  let combinedNet = 0;

  for (const group of netByCategory) {
    // Parent name
    writeLabel(row, group.parentName, { bold: true });
    row++;

    // Income section
    writeLabel(row, "Income:");
    row++;

    if (group.incomeChildren.length > 0) {
      for (const child of group.incomeChildren) {
        writeLabel(row, child.name, { indent: true });
        writeAmount(row, child.total, { color: "FF16A34A" });
        row++;
      }
      if (group.incomeChildren.length > 1) {
        writeLabel(row, "Subtotal", { indent: true, italic: true });
        writeAmount(row, group.totalIncome, { italic: true, color: "FF16A34A" });
        row++;
      }
    } else {
      writeLabel(row, "(root)", { indent: true });
      writeAmount(row, group.totalIncome, { color: "FF16A34A" });
      row++;
    }

    // Expense section
    writeLabel(row, "Expenses:");
    row++;

    if (group.expenseChildren.length > 0) {
      for (const child of group.expenseChildren) {
        writeLabel(row, child.name, { indent: true });
        writeAmount(row, child.total, { color: "FFDC2626" });
        row++;
      }
      if (group.expenseChildren.length > 1) {
        writeLabel(row, "Subtotal", { indent: true, italic: true });
        writeAmount(row, group.totalExpenses, { italic: true, color: "FFDC2626" });
        row++;
      }
    } else {
      writeLabel(row, "(root)", { indent: true });
      writeAmount(row, group.totalExpenses, { color: "FFDC2626" });
      row++;
    }

    // Net row
    const netColor = group.net >= 0 ? "FF16A34A" : "FFDC2626";
    writeLabel(row, "Net", { bold: true });
    writeAmount(row, group.net, { bold: true, color: netColor });
    row++;

    combinedNet += group.net;
    row++; // blank separator
  }

  // Combined Net Total
  const totalColor = combinedNet >= 0 ? "FF16A34A" : "FFDC2626";
  writeLabel(row, "Combined Net Total", { bold: true });
  writeAmount(row, combinedNet, { bold: true, color: totalColor });
  sheet.getRow(row).getCell(3).border = {
    top: { style: "double", color: { argb: "FF1E293B" } },
  };
}
```

- [ ] **Step 3: Call `buildNetByCategorySheet` from `generateReportWorkbook`**

In `generateReportWorkbook` (around line 20), add after `buildSummarySheet(workbook, data);`:

```typescript
  if (data.summary.netByCategory.length > 0) {
    buildNetByCategorySheet(workbook, data.summary.netByCategory);
  }
```

- [ ] **Step 4: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add lib/excel/generate-report.ts
git commit -m "feat: add Net by Category worksheet to Excel export"
```

---

### Task 6: Add "Net by Category" section to PDF export

**Files:**
- Modify: `lib/pdf/generate-report.ts`

- [ ] **Step 1: Add `MergedCategorySummary` to the import**

Update the import at lines 5-10 of `lib/pdf/generate-report.ts`:

```typescript
import type {
  AccountBalanceSummary,
  MergedCategorySummary,
  ReportData,
  ReportTransaction,
  SeasonsReportData,
} from "@/lib/reports/types";
```

- [ ] **Step 2: Add the Net by Category section after the Expenses by Category section**

After the EXPENSES BY CATEGORY block (after line 544, which is `rightY = drawColumnTable(expenseRows, RIGHT_X, rightY);`), add:

```typescript
  // ── Net by Category (full-width, below both columns) ────────
  if (summary.netByCategory.length > 0) {
    const netCatY = Math.max(leftY, rightY) + 8;
    let currentY = netCatY;

    // Check if we need a new page
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY > pageHeight - 100) {
      doc.addPage();
      currentY = MARGIN;
    }

    // Full-width section header
    doc.setFillColor(...SLATE_800);
    doc.rect(MARGIN, currentY, pageWidth - MARGIN * 2, 16, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("NET BY CATEGORY", MARGIN + 6, currentY + 11);
    doc.setTextColor(0, 0, 0);
    currentY += 16;

    const netRows: CellInput[][] = [];

    let combinedNet = 0;

    for (const group of summary.netByCategory) {
      // Parent header
      netRows.push([
        { content: group.parentName, styles: { fontStyle: "bold" } },
        "",
        "",
        "",
      ]);

      // Income children
      if (group.incomeChildren.length > 0) {
        for (const child of group.incomeChildren) {
          netRows.push([
            `  ${child.name}`,
            { content: formatCurrency(child.total), styles: { textColor: GREEN } },
            "--",
            "",
          ]);
        }
      } else {
        netRows.push([
          "  (root)",
          { content: formatCurrency(group.totalIncome), styles: { textColor: GREEN } },
          "--",
          "",
        ]);
      }

      // Expense children
      if (group.expenseChildren.length > 0) {
        for (const child of group.expenseChildren) {
          netRows.push([
            `  ${child.name}`,
            "--",
            { content: formatCurrency(child.total), styles: { textColor: RED } },
            "",
          ]);
        }
      } else {
        netRows.push([
          "  (root)",
          "--",
          { content: formatCurrency(group.totalExpenses), styles: { textColor: RED } },
          "",
        ]);
      }

      // Subtotal row for this parent
      const netColor = group.net >= 0 ? GREEN : RED;
      netRows.push([
        { content: "  Subtotal", styles: { fontStyle: "italic" } },
        { content: formatCurrency(group.totalIncome), styles: { fontStyle: "italic", textColor: GREEN } },
        { content: formatCurrency(group.totalExpenses), styles: { fontStyle: "italic", textColor: RED } },
        { content: formatCurrency(group.net), styles: { fontStyle: "italic", textColor: netColor } },
      ]);

      // Blank separator row
      netRows.push(["", "", "", ""]);

      combinedNet += group.net;
    }

    // Combined Net Total
    const totalNetColor = combinedNet >= 0 ? GREEN : RED;
    netRows.push([
      { content: "Combined Net Total", styles: { fontStyle: "bold" } },
      "",
      "",
      { content: formatCurrency(combinedNet), styles: { fontStyle: "bold", textColor: totalNetColor } },
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Category", "Income", "Expense", "Net"]],
      body: netRows,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      headStyles: {
        fillColor: HEADER_BG,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 200 },
        1: { cellWidth: 100, halign: "right" },
        2: { cellWidth: 100, halign: "right" },
        3: { cellWidth: 100, halign: "right" },
      },
      tableWidth: 500,
    });
  }
```

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add lib/pdf/generate-report.ts
git commit -m "feat: add Net by Category section to PDF export"
```

---

### Task 7: Run full test suite and verify build

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Final commit if any fixes needed**

If any fixes were required, commit them:

```bash
git add -A
git commit -m "fix: address lint/build issues from net-by-category feature"
```
