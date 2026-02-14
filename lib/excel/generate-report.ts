import ExcelJS from "exceljs";

import type { AccountBalanceSummary, ReportData, ReportTransaction, SeasonsReportData } from "@/lib/reports/types";
import type { BudgetReportData } from "@/lib/reports/fetch-budget-data";
import type { CombinedBudgetLine } from "@/lib/reports/budget-combined";

function formatExcelDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function generateReportWorkbook(
  data: ReportData,
  budgetData?: BudgetReportData | null,
  seasonsData?: SeasonsReportData | null
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  buildTransactionsSheet(workbook, data);
  buildSummarySheet(workbook, data);
  if (budgetData) {
    buildBudgetSheet(workbook, budgetData);
  }
  if (seasonsData) {
    buildSeasonsSheet(workbook, seasonsData);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function addTransactionRows(
  sheet: ExcelJS.Worksheet,
  txn: ReportTransaction,
  currencyFmt: string
) {
  for (let i = 0; i < txn.lineItems.length; i++) {
    const li = txn.lineItems[i];
    const isFirst = i === 0;

    const row = sheet.addRow([
      isFirst ? formatExcelDate(txn.transactionDate) : "",
      isFirst ? txn.accountName : "",
      isFirst ? txn.checkNumber ?? "" : "",
      isFirst ? txn.vendor ?? "" : "",
      isFirst ? txn.description : "",
      li.categoryLabel,
      li.memo ?? "",
      txn.transactionType === "income" ? li.amount : null,
      txn.transactionType === "expense" ? li.amount : null,
      isFirst
        ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1)
        : "",
      isFirst && txn.clearedAt ? formatExcelDate(txn.clearedAt.slice(0, 10)) : "",
      null, // Running balance left blank in grouped view
    ]);

    const incomeCell = row.getCell(8);
    const expenseCell = row.getCell(9);

    if (incomeCell.value !== null) {
      incomeCell.numFmt = currencyFmt;
    }
    if (expenseCell.value !== null) {
      expenseCell.numFmt = currencyFmt;
    }

    if (txn.transactionType === "income" && incomeCell.value !== null) {
      incomeCell.font = { color: { argb: "FF16A34A" } };
    }
    if (txn.transactionType === "expense" && expenseCell.value !== null) {
      expenseCell.font = { color: { argb: "FFDC2626" } };
    }
  }
}

function addSubtotalRow(
  sheet: ExcelJS.Worksheet,
  label: string,
  income: number,
  expense: number,
  currencyFmt: string,
  bold: boolean
) {
  const row = sheet.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    label,
    income || null,
    expense || null,
    "",
    "",
    null,
  ]);
  row.font = { bold };
  const incomeCell = row.getCell(8);
  const expenseCell = row.getCell(9);
  if (incomeCell.value !== null) {
    incomeCell.numFmt = currencyFmt;
    incomeCell.font = { bold, color: { argb: "FF16A34A" } };
  }
  if (expenseCell.value !== null) {
    expenseCell.numFmt = currencyFmt;
    expenseCell.font = { bold, color: { argb: "FFDC2626" } };
  }
}

const STATUS_ORDER: ReportTransaction["status"][] = [
  "uncleared",
  "cleared",
  "reconciled",
];
const STATUS_LABELS: Record<string, string> = {
  uncleared: "Uncleared",
  cleared: "Cleared",
  reconciled: "Reconciled",
};

function buildTransactionsSheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet("Transactions");

  // Column widths
  sheet.columns = [
    { key: "txnDate", width: 15 },
    { key: "account", width: 20 },
    { key: "checkNum", width: 10 },
    { key: "vendor", width: 20 },
    { key: "description", width: 40 },
    { key: "category", width: 30 },
    { key: "lineMemo", width: 25 },
    { key: "income", width: 15 },
    { key: "expense", width: 15 },
    { key: "status", width: 12 },
    { key: "clearedDate", width: 15 },
    { key: "runningBalance", width: 15 },
  ];

  // Header section
  const titleRow = sheet.addRow([data.organizationName]);
  titleRow.font = { size: 14, bold: true };
  sheet.mergeCells("A1:L1");

  const subtitleRow = sheet.addRow(["Transaction Report"]);
  subtitleRow.font = { size: 12 };
  sheet.mergeCells("A2:L2");

  const dateRangeText = data.fiscalYearLabel
    ? `${data.fiscalYearLabel} — Cleared: ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)} (includes all uncleared)`
    : `Cleared: ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)} (includes all uncleared)`;
  const dateRangeRow = sheet.addRow([dateRangeText]);
  dateRangeRow.font = { italic: true };
  sheet.mergeCells("A3:L3");

  const generatedRow = sheet.addRow([
    `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
  ]);
  generatedRow.font = { italic: true, color: { argb: "FF666666" } };
  sheet.mergeCells("A4:L4");

  // Blank row
  sheet.addRow([]);

  // Column headers
  const headerRow = sheet.addRow([
    "Transaction Date",
    "Account",
    "Check #",
    "Vendor",
    "Description",
    "Category",
    "Line Memo",
    "Income",
    "Expense",
    "Status",
    "Cleared Date",
    "Running Balance",
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });

  // Freeze panes: rows 1-6 frozen, columns not frozen
  sheet.views = [{ state: "frozen", ySplit: 6, xSplit: 0 }];

  const currencyFmt = "$#,##0.00";

  if (data.transactions.length === 0) {
    const emptyRow = sheet.addRow([
      "No transactions found matching these filters.",
    ]);
    sheet.mergeCells(`A${emptyRow.number}:L${emptyRow.number}`);
    emptyRow.font = { italic: true, color: { argb: "FF666666" } };
    return;
  }

  // Group transactions by account (preserving encounter order)
  const accountGroups = new Map<string, ReportTransaction[]>();
  for (const txn of data.transactions) {
    const group = accountGroups.get(txn.accountName) ?? [];
    group.push(txn);
    accountGroups.set(txn.accountName, group);
  }

  // Build lookup for account balances
  const balanceByAccount = new Map<string, AccountBalanceSummary>();
  if (data.accountBalances) {
    for (const ab of data.accountBalances) {
      balanceByAccount.set(ab.accountName, ab);
    }
  }

  let grandTotalIncome = 0;
  let grandTotalExpense = 0;

  for (const [accountName, txns] of accountGroups) {
    // Account header row
    const acctRow = sheet.addRow([`Account: ${accountName}`]);
    sheet.mergeCells(
      `A${acctRow.number}:L${acctRow.number}`
    );
    acctRow.font = { size: 12, bold: true };
    acctRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDBEAFE" },
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF93C5FD" } },
      };
    });

    // Starting balance row
    const acctBalance = balanceByAccount.get(accountName);
    if (acctBalance) {
      const startRow = sheet.addRow([
        "", "", "", "", "", "", "Starting Balance:",
        null, null, "", "",
        acctBalance.startingBalance,
      ]);
      startRow.font = { italic: true };
      startRow.getCell(12).numFmt = currencyFmt;
      startRow.getCell(12).font = { italic: true, bold: true };
    }

    let accountIncome = 0;
    let accountExpense = 0;

    for (const status of STATUS_ORDER) {
      const statusTxns = txns.filter((t) => t.status === status);
      if (statusTxns.length === 0) continue;

      // Status sub-header row
      const statusRow = sheet.addRow([`  ${STATUS_LABELS[status]}`]);
      sheet.mergeCells(
        `A${statusRow.number}:L${statusRow.number}`
      );
      statusRow.font = { italic: true, bold: true };
      statusRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
      });

      let statusIncome = 0;
      let statusExpense = 0;

      for (const txn of statusTxns) {
        addTransactionRows(sheet, txn, currencyFmt);

        if (txn.transactionType === "income") {
          statusIncome += txn.amount;
        } else {
          statusExpense += txn.amount;
        }
      }

      // Status subtotal
      addSubtotalRow(
        sheet,
        `${STATUS_LABELS[status]} Subtotal:`,
        statusIncome,
        statusExpense,
        currencyFmt,
        false
      );

      accountIncome += statusIncome;
      accountExpense += statusExpense;
    }

    // Account total
    addSubtotalRow(
      sheet,
      `${accountName} Total:`,
      accountIncome,
      accountExpense,
      currencyFmt,
      true
    );

    // Ending balance row
    if (acctBalance) {
      const endRow = sheet.addRow([
        "", "", "", "", "", "", "Ending Balance:",
        null, null, "", "",
        acctBalance.endingBalance,
      ]);
      endRow.font = { italic: true };
      endRow.getCell(12).numFmt = currencyFmt;
      endRow.getCell(12).font = { italic: true, bold: true };
      endRow.getCell(12).border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
      };
    }

    // Blank separator between accounts
    sheet.addRow([]);

    grandTotalIncome += accountIncome;
    grandTotalExpense += accountExpense;
  }

  // Grand total row
  const grandRow = sheet.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "GRAND TOTAL:",
    grandTotalIncome || null,
    grandTotalExpense || null,
    "",
    "",
    null,
  ]);
  grandRow.font = { size: 12, bold: true };
  const grandIncomeCell = grandRow.getCell(8);
  const grandExpenseCell = grandRow.getCell(9);
  if (grandIncomeCell.value !== null) {
    grandIncomeCell.numFmt = currencyFmt;
    grandIncomeCell.font = { size: 12, bold: true, color: { argb: "FF16A34A" } };
  }
  if (grandExpenseCell.value !== null) {
    grandExpenseCell.numFmt = currencyFmt;
    grandExpenseCell.font = { size: 12, bold: true, color: { argb: "FFDC2626" } };
  }
  grandRow.eachCell((cell) => {
    cell.border = {
      top: { style: "double", color: { argb: "FF1E293B" } },
    };
  });
}

function buildSummarySheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet("Summary");
  const { summary } = data;

  const currencyFmt = "$#,##0.00";

  // 5-column layout: A-B (left), C (spacer), D-E (right)
  sheet.getColumn(1).width = 32; // A: Left label
  sheet.getColumn(2).width = 16; // B: Left value
  sheet.getColumn(3).width = 4;  // C: Spacer
  sheet.getColumn(4).width = 32; // D: Right label
  sheet.getColumn(5).width = 16; // E: Right value

  const HEADER_FILL: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // slate-800
  };
  const HEADER_FONT: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 10,
  };

  // Row 1: "Summary" title spanning A1:E1
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = "Summary";
  titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.getCell(1).fill = HEADER_FILL;
  titleRow.getCell(1).alignment = { horizontal: "center" };
  for (let c = 2; c <= 5; c++) {
    titleRow.getCell(c).fill = HEADER_FILL;
  }
  sheet.mergeCells("A1:E1");

  // Row 2: Org name + date range
  const infoRow = sheet.getRow(2);
  const dateRangeText = data.fiscalYearLabel
    ? `${data.organizationName}  |  ${data.fiscalYearLabel}  |  ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)}`
    : `${data.organizationName}  |  ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)}`;
  infoRow.getCell(1).value = dateRangeText;
  infoRow.getCell(1).font = { size: 9, italic: true, color: { argb: "FF666666" } };
  infoRow.getCell(1).alignment = { horizontal: "center" };
  sheet.mergeCells("A2:E2");

  // Row 3: blank separator
  // Freeze panes: title rows frozen
  sheet.views = [{ state: "frozen", ySplit: 3, xSplit: 0 }];

  // Helpers that write into a specific column pair (colOffset 1=left A-B, 4=right D-E)
  function writeSectionHeader(row: number, colOffset: number, title: string) {
    const r = sheet.getRow(row);
    const labelCell = r.getCell(colOffset);
    const valueCell = r.getCell(colOffset + 1);
    labelCell.value = title;
    labelCell.font = HEADER_FONT;
    labelCell.fill = HEADER_FILL;
    valueCell.fill = HEADER_FILL;
  }

  function writeAmountRow(
    row: number,
    colOffset: number,
    label: string,
    amount: number,
    opts?: { bold?: boolean; italic?: boolean; indent?: boolean; color?: string }
  ) {
    const r = sheet.getRow(row);
    const displayLabel = opts?.indent ? `  ${label}` : label;
    const labelCell = r.getCell(colOffset);
    const valueCell = r.getCell(colOffset + 1);
    labelCell.value = displayLabel;
    if (opts?.bold) labelCell.font = { bold: true };
    if (opts?.italic) labelCell.font = { italic: true };
    valueCell.value = amount;
    valueCell.numFmt = currencyFmt;
    valueCell.alignment = { horizontal: "right" };
    const fontOpts: Partial<ExcelJS.Font> = {};
    if (opts?.bold) fontOpts.bold = true;
    if (opts?.italic) fontOpts.italic = true;
    if (opts?.color) fontOpts.color = { argb: opts.color };
    if (Object.keys(fontOpts).length > 0) valueCell.font = fontOpts;
  }

  function writeLabelRow(
    row: number,
    colOffset: number,
    label: string,
    opts?: { bold?: boolean }
  ) {
    const r = sheet.getRow(row);
    r.getCell(colOffset).value = label;
    if (opts?.bold) r.getCell(colOffset).font = { bold: true };
  }

  // ── Left Column (cols A-B, colOffset=1) ──────────────────────
  let leftRow = 4;

  // OVERALL SUMMARY
  writeSectionHeader(leftRow, 1, "OVERALL SUMMARY");
  leftRow++;
  writeAmountRow(leftRow, 1, "Total Income:", summary.totalIncome, { color: "FF16A34A" });
  leftRow++;
  writeAmountRow(leftRow, 1, "Total Expenses:", summary.totalExpenses, { color: "FFDC2626" });
  leftRow++;
  writeAmountRow(leftRow, 1, "Net Change:", summary.netChange, {
    bold: true,
    color: summary.netChange >= 0 ? "FF16A34A" : "FFDC2626",
  });
  leftRow += 2; // blank separator

  // ACCOUNT BALANCES
  if (data.accountBalances && data.accountBalances.length > 0) {
    writeSectionHeader(leftRow, 1, "ACCOUNT BALANCES");
    leftRow++;
    for (const ab of data.accountBalances) {
      writeLabelRow(leftRow, 1, ab.accountName, { bold: true });
      leftRow++;
      writeAmountRow(leftRow, 1, "Starting Balance:", ab.startingBalance, { indent: true });
      leftRow++;
      writeAmountRow(leftRow, 1, "Ending Balance:", ab.endingBalance, { indent: true });
      leftRow++;
      const netChange = ab.endingBalance - ab.startingBalance;
      writeAmountRow(leftRow, 1, "Net Change:", netChange, {
        indent: true,
        italic: true,
        color: netChange >= 0 ? "FF16A34A" : "FFDC2626",
      });
      leftRow++;
    }
    leftRow++; // blank separator
  }

  // BALANCE BY STATUS
  writeSectionHeader(leftRow, 1, "BALANCE BY STATUS");
  leftRow++;
  writeAmountRow(leftRow, 1, "Uncleared Balance:", summary.balanceByStatus.uncleared);
  leftRow++;
  writeAmountRow(leftRow, 1, "Cleared Balance:", summary.balanceByStatus.cleared);
  leftRow++;
  writeAmountRow(leftRow, 1, "Reconciled Balance:", summary.balanceByStatus.reconciled);

  // ── Right Column (cols D-E, colOffset=4) ─────────────────────
  let rightRow = 4;

  // INCOME BY CATEGORY
  if (summary.incomeByCategory.length > 0) {
    writeSectionHeader(rightRow, 4, "INCOME BY CATEGORY");
    rightRow++;
    for (const group of summary.incomeByCategory) {
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
    rightRow++; // blank separator
  }

  // EXPENSES BY CATEGORY
  if (summary.expensesByCategory.length > 0) {
    writeSectionHeader(rightRow, 4, "EXPENSES BY CATEGORY");
    rightRow++;
    for (const group of summary.expensesByCategory) {
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
  }
}

function addCombinedBudgetSection(
  sheet: ExcelJS.Worksheet,
  combinedLines: CombinedBudgetLine[],
  currencyFmt: string
) {
  const sectionHeader = sheet.addRow(["COMBINED INCOME & EXPENSE"]);
  sectionHeader.font = { bold: true, size: 11 };
  sheet.mergeCells(`A${sectionHeader.number}:H${sectionHeader.number}`);
  sectionHeader.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F9FF" },
    };
  });

  const colHeader = sheet.addRow([
    "Category",
    "Inc. Budgeted",
    "Inc. Actual",
    "Exp. Budgeted",
    "Exp. Actual",
    "Net Budgeted",
    "Net Actual",
    "Net Variance",
  ]);
  colHeader.font = { bold: true };
  colHeader.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });

  for (const line of combinedLines) {
    const row = sheet.addRow([
      line.categoryName,
      line.incomeBudgeted,
      line.incomeActual,
      line.expenseBudgeted,
      line.expenseActual,
      line.netBudgeted,
      line.netActual,
      line.netVariance,
    ]);
    // Format currency cells
    for (let i = 2; i <= 8; i++) {
      row.getCell(i).numFmt = currencyFmt;
    }
    // Color income cells green
    row.getCell(2).font = { color: { argb: "FF16A34A" } };
    row.getCell(3).font = { color: { argb: "FF16A34A" } };
    // Color expense cells red
    row.getCell(4).font = { color: { argb: "FFDC2626" } };
    row.getCell(5).font = { color: { argb: "FFDC2626" } };
    // Color net cells based on sign
    const netBudgetedColor = line.netBudgeted >= 0 ? "FF16A34A" : "FFDC2626";
    const netActualColor = line.netActual >= 0 ? "FF16A34A" : "FFDC2626";
    const netVarianceColor = line.netVariance >= 0 ? "FF16A34A" : "FFDC2626";
    row.getCell(6).font = { color: { argb: netBudgetedColor } };
    row.getCell(7).font = { color: { argb: netActualColor } };
    row.getCell(8).font = { color: { argb: netVarianceColor } };
  }

  // Subtotal row
  const totIncBudget = combinedLines.reduce((s, l) => s + l.incomeBudgeted, 0);
  const totIncActual = combinedLines.reduce((s, l) => s + l.incomeActual, 0);
  const totExpBudget = combinedLines.reduce((s, l) => s + l.expenseBudgeted, 0);
  const totExpActual = combinedLines.reduce((s, l) => s + l.expenseActual, 0);
  const totNetBudget = combinedLines.reduce((s, l) => s + l.netBudgeted, 0);
  const totNetActual = combinedLines.reduce((s, l) => s + l.netActual, 0);
  const totNetVariance = combinedLines.reduce((s, l) => s + l.netVariance, 0);

  const totalRow = sheet.addRow([
    "Combined Total",
    totIncBudget,
    totIncActual,
    totExpBudget,
    totExpActual,
    totNetBudget,
    totNetActual,
    totNetVariance,
  ]);
  totalRow.font = { bold: true };
  for (let i = 2; i <= 8; i++) {
    totalRow.getCell(i).numFmt = currencyFmt;
  }
  totalRow.getCell(2).font = { bold: true, color: { argb: "FF16A34A" } };
  totalRow.getCell(3).font = { bold: true, color: { argb: "FF16A34A" } };
  totalRow.getCell(4).font = { bold: true, color: { argb: "FFDC2626" } };
  totalRow.getCell(5).font = { bold: true, color: { argb: "FFDC2626" } };
  totalRow.getCell(6).font = { bold: true, color: { argb: totNetBudget >= 0 ? "FF16A34A" : "FFDC2626" } };
  totalRow.getCell(7).font = { bold: true, color: { argb: totNetActual >= 0 ? "FF16A34A" : "FFDC2626" } };
  totalRow.getCell(8).font = { bold: true, color: { argb: totNetVariance >= 0 ? "FF16A34A" : "FFDC2626" } };
}

function buildBudgetSheet(workbook: ExcelJS.Workbook, data: BudgetReportData) {
  const sheet = workbook.addWorksheet("Budget vs. Actuals");
  const currencyFmt = "$#,##0.00";

  sheet.columns = [
    { key: "category", width: 35 },
    { key: "budgeted", width: 15 },
    { key: "actual", width: 15 },
    { key: "variance", width: 15 },
    { key: "variancePct", width: 12 },
  ];

  // Header
  const titleRow = sheet.addRow([`Budget vs. Actuals: ${data.budgetName}`]);
  titleRow.font = { size: 14, bold: true };
  sheet.mergeCells(`A1:E1`);

  const dateRow = sheet.addRow([
    `${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)} (${data.status})`,
  ]);
  dateRow.font = { size: 10, italic: true };
  sheet.mergeCells(`A2:E2`);

  sheet.addRow([]);

  // Column headers
  const headerRow = sheet.addRow([
    "Category",
    "Budgeted",
    "Actual",
    "Variance ($)",
    "Variance (%)",
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });

  function addBudgetRow(
    label: string,
    budgeted: number,
    actual: number,
    variance: number,
    variancePct: number | null,
    isFavorable: boolean,
    bold = false
  ) {
    const row = sheet.addRow([
      label,
      budgeted,
      actual,
      variance,
      variancePct !== null ? variancePct / 100 : null,
    ]);
    if (bold) row.font = { bold: true };

    row.getCell(2).numFmt = currencyFmt;
    row.getCell(3).numFmt = currencyFmt;
    row.getCell(4).numFmt = currencyFmt;
    if (row.getCell(5).value !== null) {
      row.getCell(5).numFmt = "0%";
    }

    // Conditional color for variance
    const varianceColor = isFavorable ? "FF16A34A" : "FFDC2626";
    row.getCell(4).font = { bold, color: { argb: varianceColor } };

    // Green/red fill for variance cell
    row.getCell(4).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isFavorable ? "FFF0FDF4" : "FFFEF2F2" },
    };
  }

  // Combined Income & Expense section
  if (data.combinedLines.length > 0) {
    addCombinedBudgetSection(sheet, data.combinedLines, currencyFmt);
    sheet.addRow([]);
  }

  // Income section (unmatched only)
  if (data.incomeLines.length > 0) {
    const incomeHeader = sheet.addRow(["INCOME"]);
    incomeHeader.font = { bold: true, size: 11 };
    sheet.mergeCells(`A${incomeHeader.number}:E${incomeHeader.number}`);
    incomeHeader.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDBEAFE" },
      };
    });

    for (const line of data.incomeLines) {
      addBudgetRow(
        line.categoryName,
        line.budgeted,
        line.actual,
        line.variance,
        line.variancePercent,
        line.variance >= 0
      );
    }

    const incomeBudgeted = data.incomeLines.reduce((s, l) => s + l.budgeted, 0);
    const incomeActual = data.incomeLines.reduce((s, l) => s + l.actual, 0);
    addBudgetRow(
      "Income Subtotal",
      incomeBudgeted,
      incomeActual,
      incomeActual - incomeBudgeted,
      incomeBudgeted > 0
        ? (incomeActual / incomeBudgeted) * 100
        : null,
      incomeActual >= incomeBudgeted,
      true
    );

    sheet.addRow([]);
  }

  // Expenses section (unmatched only)
  if (data.expenseLines.length > 0) {
    const expenseHeader = sheet.addRow(["EXPENSES"]);
    expenseHeader.font = { bold: true, size: 11 };
    sheet.mergeCells(`A${expenseHeader.number}:E${expenseHeader.number}`);
    expenseHeader.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEF2F2" },
      };
    });

    for (const line of data.expenseLines) {
      addBudgetRow(
        line.categoryName,
        line.budgeted,
        line.actual,
        line.variance,
        line.variancePercent,
        line.variance >= 0
      );
    }

    const expenseBudgeted = data.expenseLines.reduce((s, l) => s + l.budgeted, 0);
    const expenseActual = data.expenseLines.reduce((s, l) => s + l.actual, 0);
    addBudgetRow(
      "Expenses Subtotal",
      expenseBudgeted,
      expenseActual,
      expenseBudgeted - expenseActual,
      expenseBudgeted > 0
        ? (expenseActual / expenseBudgeted) * 100
        : null,
      expenseActual <= expenseBudgeted,
      true
    );

    sheet.addRow([]);
  }

  // Net summary
  const netRow = sheet.addRow([
    "NET",
    data.totals.netBudget,
    data.totals.netActual,
    data.totals.netActual - data.totals.netBudget,
    null,
  ]);
  netRow.font = { bold: true, size: 11 };
  netRow.getCell(2).numFmt = currencyFmt;
  netRow.getCell(3).numFmt = currencyFmt;
  netRow.getCell(4).numFmt = currencyFmt;

  const netVariance = data.totals.netActual - data.totals.netBudget;
  netRow.getCell(4).font = {
    bold: true,
    size: 11,
    color: { argb: netVariance >= 0 ? "FF16A34A" : "FFDC2626" },
  };
  netRow.eachCell((cell) => {
    cell.border = {
      top: { style: "double", color: { argb: "FF1E293B" } },
    };
  });
}

function buildSeasonsSheet(workbook: ExcelJS.Workbook, data: SeasonsReportData) {
  const sheet = workbook.addWorksheet("Active Seasons");
  const currencyFmt = "$#,##0.00";
  const pctFmt = "0.0%";

  sheet.columns = [
    { key: "season", width: 30 },
    { key: "startDate", width: 14 },
    { key: "endDate", width: 14 },
    { key: "baseFee", width: 14 },
    { key: "enrolled", width: 12 },
    { key: "expected", width: 16 },
    { key: "collected", width: 16 },
    { key: "outstanding", width: 16 },
    { key: "rate", width: 12 },
  ];

  // Title
  const titleRow = sheet.addRow(["Active Seasons Summary"]);
  titleRow.font = { size: 14, bold: true };
  sheet.mergeCells("A1:I1");

  sheet.addRow([]);

  // Column headers
  const headerRow = sheet.addRow([
    "Season",
    "Start Date",
    "End Date",
    "Base Fee",
    "Enrolled",
    "Fees Expected",
    "Collected",
    "Outstanding",
    "Collection Rate",
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });

  // Freeze panes
  sheet.views = [{ state: "frozen", ySplit: 3, xSplit: 0 }];

  for (const season of data.seasons) {
    const row = sheet.addRow([
      season.seasonName,
      formatExcelDate(season.startDate),
      formatExcelDate(season.endDate),
      season.baseFee,
      season.enrolledCount,
      season.totalExpected,
      season.totalCollected,
      season.totalOutstanding,
      season.collectionRate / 100,
    ]);

    row.getCell(4).numFmt = currencyFmt;
    row.getCell(6).numFmt = currencyFmt;
    row.getCell(7).numFmt = currencyFmt;
    row.getCell(7).font = { color: { argb: "FF16A34A" } };
    row.getCell(8).numFmt = currencyFmt;
    row.getCell(8).font = { color: { argb: "FFDC2626" } };
    row.getCell(9).numFmt = pctFmt;
  }

  // Grand total row (only when multiple seasons)
  if (data.seasons.length > 1) {
    const totalRow = sheet.addRow([
      "Grand Total",
      "",
      "",
      "",
      data.grandTotals.enrolledCount,
      data.grandTotals.totalExpected,
      data.grandTotals.totalCollected,
      data.grandTotals.totalOutstanding,
      data.grandTotals.collectionRate / 100,
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(6).numFmt = currencyFmt;
    totalRow.getCell(7).numFmt = currencyFmt;
    totalRow.getCell(7).font = { bold: true, color: { argb: "FF16A34A" } };
    totalRow.getCell(8).numFmt = currencyFmt;
    totalRow.getCell(8).font = { bold: true, color: { argb: "FFDC2626" } };
    totalRow.getCell(9).numFmt = pctFmt;
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "double", color: { argb: "FF1E293B" } },
      };
    });
  }
}
