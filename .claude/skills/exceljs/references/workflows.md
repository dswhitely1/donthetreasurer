# ExcelJS Workflows Reference

## Contents
- Export API Route Setup
- Streaming Writer for Large Datasets
- Testing Workbook Output
- File Naming Convention
- Adding ExcelJS to the Project

---

## Export API Route Setup

The Excel export lives at `app/api/reports/export/route.ts`. See the **nextjs** skill for API Route conventions.

```typescript
// app/api/reports/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildReportWorkbook } from '@/lib/reports/workbook-builder';
import { reportParamsSchema } from '@/lib/validations/report';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = reportParamsSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const params = parsed.data;
  const data = await fetchReportData(supabase, params);
  const workbook = await buildReportWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `${data.orgName.replace(/\s+/g, '')}_Transactions_${params.startDate}_to_${params.endDate}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

Validate query params with **zod** (see the **zod** skill). Fetch data with the **supabase** client. Build workbook in a separate module.

### Workflow Checklist

Copy this checklist and track progress:
- [ ] Create `lib/reports/workbook-builder.ts` with `buildReportWorkbook()`
- [ ] Create `lib/validations/report.ts` with Zod schema for query params
- [ ] Create `app/api/reports/export/route.ts` with GET handler
- [ ] Add frozen header row at row 6 (after header section)
- [ ] Verify column order matches PRD Section 8.2
- [ ] Test with split transactions (multiple line items per transaction)
- [ ] Test with empty result set (should return workbook with headers only)

---

## Streaming Writer for Large Datasets

Use `ExcelJS.stream.xlsx.WorkbookWriter` when generating reports with 10,000+ transactions (PRD Section 10 performance target). The streaming writer commits rows immediately, avoiding holding the entire workbook in memory.

```typescript
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

export async function buildStreamingReport(rows: AsyncIterable<TransactionReportRow>): Promise<Buffer> {
  const passThrough = new PassThrough();
  const chunks: Buffer[] = [];
  passThrough.on('data', (chunk) => chunks.push(chunk));

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: passThrough,
    useStyles: true,
    useSharedStrings: true,
  });

  const ws = workbook.addWorksheet('Transactions', {
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  defineTransactionColumns(ws);

  for await (const row of rows) {
    ws.addRow(row).commit();
  }

  ws.commit();
  await workbook.commit();

  return Buffer.concat(chunks);
}
```

### WARNING: Using Streaming Writer Without `.commit()`

**The Problem:**

```typescript
// BAD - rows are never flushed to stream
for (const row of data) {
  ws.addRow(row);  // Missing .commit()
}
```

**Why This Breaks:**
1. All rows accumulate in memory, defeating the purpose of streaming
2. For 100k transactions, this can exhaust the Vercel serverless function memory limit

**The Fix:**

```typescript
// GOOD - commit each row immediately
for (const row of data) {
  ws.addRow(row).commit();
}
ws.commit();
await workbook.commit();
```

### When to Use Streaming vs Standard

| Scenario | Use |
|----------|-----|
| < 10,000 rows | Standard `Workbook` -- simpler API, can go back and edit cells |
| > 10,000 rows | `stream.xlsx.WorkbookWriter` -- lower memory, forward-only |
| Summary sheet with back-references | Standard `Workbook` -- streaming cannot revisit previous rows |

---

## Testing Workbook Output

ExcelJS workbooks can be round-tripped: write to buffer, read back, assert cell values. Keep workbook builder functions pure (data in, workbook out) so tests don't need HTTP or database fixtures.

```typescript
import ExcelJS from 'exceljs';
import { buildReportWorkbook } from '@/lib/reports/workbook-builder';

describe('buildReportWorkbook', () => {
  it('sets currency format on income column', async () => {
    const wb = await buildReportWorkbook(mockReportData);
    const buffer = await wb.xlsx.writeBuffer();

    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buffer as Buffer);

    const ws = readBack.getWorksheet('Transactions')!;
    const incomeCell = ws.getCell('H7'); // First data row, Income column
    expect(incomeCell.numFmt).toBe('"$"#,##0.00');
    expect(typeof incomeCell.value).toBe('number');
  });

  it('produces correct row count for split transactions', async () => {
    const wb = await buildReportWorkbook(mockDataWithSplits);
    const buffer = await wb.xlsx.writeBuffer();

    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(buffer as Buffer);

    const ws = readBack.getWorksheet('Transactions')!;
    // 6 header rows + 3 line items from 2 transactions (one has 2 splits)
    expect(ws.rowCount).toBe(9);
  });
});
```

### Validation Feedback Loop

1. Write or modify workbook builder code
2. Run tests: `npx vitest run lib/reports`
3. If tests fail, fix the builder and repeat step 2
4. Only proceed when all assertions pass
5. Manually open a generated `.xlsx` in Excel/LibreOffice to verify visual formatting

---

## File Naming Convention

PRD Section 8.1 specifies the filename pattern. Sanitize the organization name to remove characters invalid in filenames.

```typescript
function buildExportFilename(orgName: string, startDate: string, endDate: string): string {
  const sanitized = orgName.replace(/[^a-zA-Z0-9]/g, '');
  return `${sanitized}_Transactions_${startDate}_to_${endDate}.xlsx`;
}
```

---

## Adding ExcelJS to the Project

ExcelJS is not yet installed. Install it as a production dependency since it runs server-side in the API route.

```bash
npm install exceljs
npm install -D @types/exceljs   # Only if types are missing; ExcelJS ships its own
```

After installation, verify the import resolves:

```typescript
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
```

If using the streaming writer in a Vercel serverless function, keep the function's memory limit in mind. The standard `Workbook` API is sufficient for most Treasurer App reports (under 100k rows per organization per PRD Section 10).
