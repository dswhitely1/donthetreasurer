---
name: exceljs
description: |
  Generates .xlsx Excel reports with formatting, worksheets, and data export.
  Use when: building the Excel export API route, creating transaction report workbooks, formatting currency columns, constructing summary sheets, or handling large dataset streaming.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# ExcelJS Skill

ExcelJS v4 generates `.xlsx` reports server-side in the API Route at `app/api/reports/export/route.ts`. Reports follow the PRD Section 8.2 specification: two sheets (Transactions + Summary), USD currency formatting, split transaction line item rows, and frozen header panes. File naming: `{OrgName}_Transactions_{StartDate}_to_{EndDate}.xlsx`.

## Quick Start

### Workbook Setup

```typescript
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
workbook.creator = "Treasurer App";
workbook.created = new Date();

const sheet = workbook.addWorksheet("Transactions");
```

### Column Definitions with Currency Format

```typescript
sheet.columns = [
  { header: "Transaction Date", key: "transaction_date", width: 15 },
  { header: "Description", key: "description", width: 40 },
  { header: "Category", key: "category", width: 30 },
  { header: "Income", key: "income", width: 15, style: { numFmt: "$#,##0.00" } },
  { header: "Expense", key: "expense", width: 15, style: { numFmt: "$#,##0.00" } },
  { header: "Status", key: "status", width: 12 },
  { header: "Running Balance", key: "running_balance", width: 15, style: { numFmt: "$#,##0.00" } },
];
```

### API Route Response

```typescript
// app/api/reports/export/route.ts
const buffer = await workbook.xlsx.writeBuffer();

return new NextResponse(buffer, {
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${orgName}_Transactions_${startDate}_to_${endDate}.xlsx"`,
  },
});
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| Two sheets | "Transactions" (data) + "Summary" (category totals) |
| Currency format | `$#,##0.00` via `numFmt` |
| Split transactions | First line item row shows all fields, subsequent rows show category/amount only |
| Header rows | Rows 1-4: org name, report title, date range, generated date |
| Frozen panes | Freeze header row for scrolling |
| Streaming | `workbook.xlsx.writeBuffer()` for API Route response |

## See Also

- [patterns](references/patterns.md) — Report workbook structure, split transaction rows, summary sheet
- [workflows](references/workflows.md) — Export API route setup, streaming for large datasets, testing

## Related Skills

- See the **nextjs** skill for API Route patterns
- See the **supabase** skill for fetching transaction data
- See the **typescript** skill for typed report data structures
- See the **zod** skill for validating report query parameters

## Documentation Resources

> Fetch latest ExcelJS documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "exceljs"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/exceljs/exceljs`

**Recommended Queries:**
- "ExcelJS workbook worksheet creation"
- "ExcelJS column formatting currency numFmt"
- "ExcelJS writeBuffer streaming response"
- "ExcelJS cell styling font alignment"
