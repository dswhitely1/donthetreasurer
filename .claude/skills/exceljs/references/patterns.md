# ExcelJS Patterns Reference

## Contents
- Report Workbook Structure
- Column Definitions and Currency Formatting
- Split Transaction Row Layout
- Summary Worksheet Construction
- Anti-Patterns

---

## Report Workbook Structure

The PRD (Section 8) defines a two-sheet workbook: Transactions and Summary. Build the workbook in a single function that receives pre-queried data.

```typescript
import ExcelJS from 'exceljs';
import type { TransactionReportRow, CategorySummary } from '@/types';

const USD = '"$"#,##0.00';
const DATE_FMT = 'MM/DD/YYYY';

export async function buildReportWorkbook(
  orgName: string,
  startDate: string,
  endDate: string,
  rows: TransactionReportRow[],
  categorySummary: CategorySummary,
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Treasurer App';
  wb.created = new Date();

  buildTransactionsSheet(wb, orgName, startDate, endDate, rows);
  buildSummarySheet(wb, orgName, categorySummary);

  return wb;
}
```

Keep workbook construction separate from the HTTP handler. The API route calls `buildReportWorkbook`, then converts to buffer. See the **nextjs** skill for API Route response patterns.

---

## Column Definitions and Currency Formatting

Define columns once with `key`, `width`, and `style`. The `key` maps to `addRow()` object fields.

```typescript
function defineTransactionColumns(ws: ExcelJS.Worksheet) {
  ws.columns = [
    { header: 'Transaction Date', key: 'txnDate',      width: 15, style: { numFmt: DATE_FMT } },
    { header: 'Created Date',     key: 'createdDate',   width: 15, style: { numFmt: DATE_FMT } },
    { header: 'Account',          key: 'account',       width: 20 },
    { header: 'Check #',          key: 'checkNumber',   width: 10 },
    { header: 'Description',      key: 'description',   width: 40 },
    { header: 'Category',         key: 'category',      width: 30 },
    { header: 'Line Memo',        key: 'lineMemo',      width: 25 },
    { header: 'Income',           key: 'income',        width: 15, style: { numFmt: USD } },
    { header: 'Expense',          key: 'expense',       width: 15, style: { numFmt: USD } },
    { header: 'Status',           key: 'status',        width: 12 },
    { header: 'Cleared Date',     key: 'clearedDate',   width: 15, style: { numFmt: DATE_FMT } },
    { header: 'Running Balance',  key: 'runningBalance', width: 15, style: { numFmt: USD } },
  ];
}
```

### WARNING: Hardcoding numFmt Strings Inline

**The Problem:**

```typescript
// BAD - duplicated format strings scattered across the file
ws.getCell('H7').numFmt = '"$"#,##0.00';
ws.getCell('I7').numFmt = '"$"#,##0.00';
ws.getCell('L7').numFmt = '"$"#,##0.00';
```

**Why This Breaks:**
1. A typo in one location silently produces wrong formatting in Excel
2. Changing currency symbol requires a multi-file search-and-replace
3. Column styles already apply numFmt to all cells in that column

**The Fix:**

```typescript
// GOOD - single constant, applied via column style
const USD = '"$"#,##0.00';
// Column definition handles formatting for all data rows automatically
```

---

## Split Transaction Row Layout

Per PRD Section 8.2, split transactions emit one row per line item. The first row carries all transaction fields; subsequent rows only show category, memo, and amount. Running balance appears on the last line item row only.

```typescript
function addTransactionRows(ws: ExcelJS.Worksheet, txn: TransactionReportRow, runningBalance: number) {
  const lineItems = txn.lineItems;

  lineItems.forEach((item, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === lineItems.length - 1;
    const incomeAmount = txn.transactionType === 'income' ? item.amount : null;
    const expenseAmount = txn.transactionType === 'expense' ? item.amount : null;

    ws.addRow({
      txnDate:        isFirst ? txn.transactionDate : null,
      createdDate:    isFirst ? txn.createdAt : null,
      account:        isFirst ? txn.accountName : null,
      checkNumber:    isFirst ? txn.checkNumber : null,
      description:    isFirst ? txn.description : null,
      category:       `${item.parentCategory} → ${item.subcategory}`,
      lineMemo:       item.memo,
      income:         incomeAmount,
      expense:        expenseAmount,
      status:         isFirst ? txn.status : null,
      clearedDate:    isFirst ? txn.clearedAt : null,
      runningBalance: isLast ? runningBalance : null,
    });
  });
}
```

### WARNING: Putting Amount in Wrong Column

**The Problem:**

```typescript
// BAD - income transactions show amount in both columns
ws.addRow({ income: txn.amount, expense: txn.amount });
```

**Why This Breaks:**
1. Summary totals double-count every transaction
2. Reports become unusable for board meetings

**The Fix:**

```typescript
// GOOD - populate only the column matching transaction_type
const income = txn.transactionType === 'income' ? item.amount : null;
const expense = txn.transactionType === 'expense' ? item.amount : null;
```

---

## Summary Worksheet Construction

The Summary sheet (PRD Section 8.2, Sheet 2) has four sections: overall summary, balance by status, income by category, and expenses by category.

```typescript
function buildSummarySheet(wb: ExcelJS.Workbook, orgName: string, summary: CategorySummary) {
  const ws = wb.addWorksheet('Summary');
  ws.getColumn(1).width = 35;
  ws.getColumn(2).width = 18;

  let row = 1;
  const bold = { bold: true };
  const currency = { numFmt: USD };

  // Overall Summary
  ws.getCell(`A${row}`).value = 'OVERALL SUMMARY';
  ws.getCell(`A${row}`).font = { bold: true, size: 13 };
  row += 1;

  ws.getCell(`A${row}`).value = 'Total Income:';
  ws.getCell(`B${row}`).value = summary.totalIncome;
  ws.getCell(`B${row}`).numFmt = USD;
  row += 1;

  ws.getCell(`A${row}`).value = 'Total Expenses:';
  ws.getCell(`B${row}`).value = summary.totalExpenses;
  ws.getCell(`B${row}`).numFmt = USD;
  row += 1;

  ws.getCell(`A${row}`).value = 'Net Change:';
  ws.getCell(`B${row}`).value = summary.totalIncome - summary.totalExpenses;
  ws.getCell(`B${row}`).numFmt = USD;
  ws.getCell(`B${row}`).font = bold;
  row += 2;

  // ... Balance by Status, Income by Category, Expenses by Category sections follow same pattern
}
```

---

## Anti-Patterns

### WARNING: Building Workbook Inside the Request Handler

**The Problem:**

```typescript
// BAD - business logic mixed with HTTP handling
export async function GET(request: Request) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Transactions');
  // 200 lines of workbook construction...
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, { headers: { /* ... */ } });
}
```

**Why This Breaks:**
1. Untestable -- you cannot unit test workbook output without making HTTP requests
2. Single function becomes 300+ lines mixing data queries, formatting, and HTTP concerns

**The Fix:**

```typescript
// GOOD - thin handler, testable builder
export async function GET(request: Request) {
  const params = parseReportParams(request.url);
  const data = await fetchReportData(params);
  const workbook = await buildReportWorkbook(params.orgName, params.startDate, params.endDate, data.rows, data.summary);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${data.filename}"`,
    },
  });
}
```

### WARNING: Using `cell.value = '$1,234.56'` for Currency

**The Problem:**

```typescript
// BAD - string value, not numeric
ws.getCell('H7').value = `$${amount.toFixed(2)}`;
```

**Why This Breaks:**
1. Excel treats it as text -- no SUM(), no sorting by value
2. Breaks any downstream formulas or pivot tables

**The Fix:**

```typescript
// GOOD - numeric value with format mask
ws.getCell('H7').value = amount;
ws.getCell('H7').numFmt = '"$"#,##0.00';
```
