import ExcelJS from "exceljs";

import type { AccountBalanceSummary, ReportData, ReportTransaction, SeasonsReportData } from "@/lib/reports/types";
import {
  groupBudgetLines,
  isOverBudget,
  rollUpGroup,
  rollUpPercentOfPlan,
} from "@/lib/reports/budget-grouping";

import type { BudgetGroup } from "@/lib/reports/budget-grouping";
import type { BudgetReportData } from "@/lib/reports/fetch-budget-data";

function formatExcelDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Real `Date` for a `YYYY-MM-DD` string. Parsed as UTC midnight, not local:
 * ExcelJS derives the Excel serial number from the UTC epoch, so a local
 * midnight would land a day early for any runtime east of GMT.
 */
function toExcelDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * Currency values arrive as float sums, so a total can land on 3548.0299999999997.
 * The number format hides that, but the stored value is what gets re-summed or
 * pasted elsewhere — round before writing.
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const POSITIVE_COLOR = "FF16A34A"; // green-600
const NEGATIVE_COLOR = "FFDC2626"; // red-600
const BANNER_BG = "FF1E293B"; // slate-800
const BANNER_TEXT = "FFFFFFFF";
const COLUMN_HEADER_BG = "FFE2E8F0"; // slate-200
const RULE_COLOR = "FF94A3B8"; // slate-400
const SUBTOTAL_BG = "FFF1F5F9"; // slate-100
const MUTED_TEXT = "FF666666";

/**
 * Accounting format: decimal points line up down the column, negatives read as
 * (1,234.00), and an exact zero shows a dash instead of $0.00.
 */
const CURRENCY_FMT = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
const DATE_FMT = "mm/dd/yyyy";
const PERCENT_FMT = "0.0%";
const UNFAVORABLE_BG = "FFF8D7D7"; // red-100

/**
 * Font colour for a signed amount. Used on columns that carry a direction in
 * their sign (net, and the signed budget amounts) rather than columns that are
 * always positive and take their colour from the column itself (In / Out).
 * Zero reads as positive: a net of exactly 0 is not a loss.
 */
function signedColor(value: number): string {
  return value >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
}

/**
 * Dark full-width banner used as the first row of every sheet, so the sheets in
 * one workbook read as a single report rather than separate exports.
 */
function writeBanner(
  sheet: ExcelJS.Worksheet,
  row: number,
  lastColumn: number,
  text: string,
  size = 16
) {
  const r = sheet.getRow(row);
  r.getCell(1).value = text;
  r.getCell(1).font = { size, bold: true, color: { argb: BANNER_TEXT } };
  r.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  for (let c = 1; c <= lastColumn; c++) {
    r.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BANNER_BG },
    };
  }
  r.height = size + 8;
  sheet.mergeCells(row, 1, row, lastColumn);
}

/** Centred, muted context line under a banner (date range, generated timestamp). */
function writeBannerSubtitle(
  sheet: ExcelJS.Worksheet,
  row: number,
  lastColumn: number,
  text: string
) {
  const r = sheet.getRow(row);
  r.getCell(1).value = text;
  r.getCell(1).font = { size: 9, italic: true, color: { argb: MUTED_TEXT } };
  r.getCell(1).alignment = { horizontal: "center" };
  sheet.mergeCells(row, 1, row, lastColumn);
}

/**
 * Fit-to-width printing with the column header row repeated on every page.
 * Without this a 12-column sheet prints portrait at 100% and spills columns
 * onto unreadable overflow pages.
 */
function applyPrintSetup(
  sheet: ExcelJS.Worksheet,
  opts?: { headerRow?: number; orientation?: "portrait" | "landscape" }
) {
  sheet.pageSetup = {
    orientation: opts?.orientation ?? "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    ...(opts?.headerRow === undefined
      ? {}
      : { printTitlesRow: `${opts.headerRow}:${opts.headerRow}` }),
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
  };
  sheet.headerFooter = { oddFooter: "&L&A&R Page &P of &N" };
}

export async function generateReportWorkbook(
  data: ReportData,
  budgetData?: BudgetReportData | null,
  seasonsData?: SeasonsReportData | null
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Treasurer";
  workbook.lastModifiedBy = "Treasurer";
  workbook.company = data.organizationName;
  workbook.title = `${data.organizationName} — Transaction Report`;
  workbook.created = new Date(data.generatedAt);
  workbook.modified = new Date(data.generatedAt);

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
      isFirst ? toExcelDate(txn.transactionDate) : "",
      isFirst ? txn.accountName : "",
      isFirst ? txn.checkNumber ?? "" : "",
      isFirst ? txn.vendor ?? "" : "",
      isFirst ? txn.description : "",
      li.categoryLabel,
      li.memo ?? "",
      txn.transactionType === "income" ? round2(li.amount) : null,
      txn.transactionType === "expense" ? round2(li.amount) : null,
      isFirst
        ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1)
        : "",
      isFirst && txn.clearedAt ? toExcelDate(txn.clearedAt.slice(0, 10)) : "",
      null, // Running balance left blank in grouped view
    ]);

    // Dates go in as real Dates rather than pre-formatted text, so both date
    // columns sort, filter and pivot chronologically in Excel.
    for (const c of [1, 11]) {
      const cell = row.getCell(c);
      if (cell.value instanceof Date) cell.numFmt = DATE_FMT;
    }

    const incomeCell = row.getCell(8);
    const expenseCell = row.getCell(9);

    if (incomeCell.value !== null) {
      incomeCell.numFmt = currencyFmt;
    }
    if (expenseCell.value !== null) {
      expenseCell.numFmt = currencyFmt;
    }

    if (txn.transactionType === "income" && incomeCell.value !== null) {
      incomeCell.font = { color: { argb: POSITIVE_COLOR } };
    }
    if (txn.transactionType === "expense" && expenseCell.value !== null) {
      expenseCell.font = { color: { argb: NEGATIVE_COLOR } };
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
    income ? round2(income) : null,
    expense ? round2(expense) : null,
    "",
    "",
    null,
  ]);
  row.font = { bold };

  // A rule above every subtotal, plus a fill on the bolder account totals, so
  // they read as boundaries instead of blending into the data rows above them.
  for (let c = 1; c <= 12; c++) {
    const cell = row.getCell(c);
    cell.border = { top: { style: "thin", color: { argb: RULE_COLOR } } };
    if (bold) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SUBTOTAL_BG },
      };
    }
  }

  const incomeCell = row.getCell(8);
  const expenseCell = row.getCell(9);
  if (incomeCell.value !== null) {
    incomeCell.numFmt = currencyFmt;
    incomeCell.font = { bold, color: { argb: POSITIVE_COLOR } };
  }
  if (expenseCell.value !== null) {
    expenseCell.numFmt = currencyFmt;
    expenseCell.font = { bold, color: { argb: NEGATIVE_COLOR } };
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
    { key: "checkNum", width: 16 },
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

  // Header section — banner plus muted context lines, the same treatment the
  // Summary sheet uses, so the two sheets look like one report.
  writeBanner(sheet, 1, 12, data.organizationName);
  writeBanner(sheet, 2, 12, "Transaction Report", 11);

  const dateRangeText = data.fiscalYearLabel
    ? `${data.fiscalYearLabel} — Cleared: ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)} (includes all uncleared)`
    : `Cleared: ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)} (includes all uncleared)`;
  writeBannerSubtitle(sheet, 3, 12, dateRangeText);
  writeBannerSubtitle(
    sheet,
    4,
    12,
    `Generated: ${new Date(data.generatedAt).toLocaleString()}`
  );

  // Blank row
  sheet.addRow([]);

  // Column headers
  const headerRow = sheet.addRow([
    "Transaction Date",
    "Account",
    "Check # / Method",
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
  headerRow.height = 18;
  headerRow.eachCell((cell) => {
    cell.alignment = { vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLUMN_HEADER_BG },
    };
    cell.border = {
      top: { style: "thin", color: { argb: RULE_COLOR } },
      bottom: { style: "thin", color: { argb: RULE_COLOR } },
    };
  });

  // Freeze panes: rows 1-6 frozen, columns not frozen. Gridlines off — the
  // banded section headers and subtotal rules already carry the structure.
  sheet.views = [
    { state: "frozen", ySplit: 6, xSplit: 0, showGridLines: false },
  ];
  sheet.properties.tabColor = { argb: BANNER_BG };
  applyPrintSetup(sheet, { headerRow: 6 });

  const currencyFmt = CURRENCY_FMT;

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
        round2(acctBalance.startingBalance),
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
        round2(acctBalance.endingBalance),
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
    grandTotalIncome ? round2(grandTotalIncome) : null,
    grandTotalExpense ? round2(grandTotalExpense) : null,
    "",
    "",
    null,
  ]);
  grandRow.font = { size: 12, bold: true };
  const grandIncomeCell = grandRow.getCell(8);
  const grandExpenseCell = grandRow.getCell(9);
  if (grandIncomeCell.value !== null) {
    grandIncomeCell.numFmt = currencyFmt;
    grandIncomeCell.font = { size: 12, bold: true, color: { argb: POSITIVE_COLOR } };
  }
  if (grandExpenseCell.value !== null) {
    grandExpenseCell.numFmt = currencyFmt;
    grandExpenseCell.font = { size: 12, bold: true, color: { argb: NEGATIVE_COLOR } };
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

  const currencyFmt = CURRENCY_FMT;

  // 4-column layout: A (category label), B-D (In / Out / Net currency)
  sheet.getColumn(1).width = 32; // A: Category label
  sheet.getColumn(2).width = 16; // B: In (currency)
  sheet.getColumn(3).width = 16; // C: Out (currency)
  sheet.getColumn(4).width = 16; // D: Net (currency)

  const HEADER_FILL: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BANNER_BG },
  };
  const HEADER_FONT: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: BANNER_TEXT },
    size: 10,
  };

  // Row 1: "Summary" title spanning A1:D1
  writeBanner(sheet, 1, 4, "Summary");

  // Row 2: Org name + date range
  const dateBasisLabel = data.dateBasis === "transaction_date" ? "Transaction Date" : "Cleared Date";
  const dateRangeText = data.fiscalYearLabel
    ? `${data.organizationName}  |  ${data.fiscalYearLabel}  |  ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)}  |  Date Basis: ${dateBasisLabel}`
    : `${data.organizationName}  |  ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)}  |  Date Basis: ${dateBasisLabel}`;
  writeBannerSubtitle(sheet, 2, 4, dateRangeText);

  // Row 3: blank separator
  // Freeze panes: title rows frozen
  sheet.views = [
    { state: "frozen", ySplit: 3, xSplit: 0, showGridLines: false },
  ];
  sheet.properties.tabColor = { argb: BANNER_BG };
  applyPrintSetup(sheet, { orientation: "portrait" });

  // Helpers that write into a specific column pair (colOffset 1=left A-B, 4=right D-E)
  function writeSectionHeader(row: number, colOffset: number, title: string) {
    const r = sheet.getRow(row);
    const labelCell = r.getCell(colOffset);
    labelCell.value = title;
    labelCell.font = HEADER_FONT;
    // Fill through the last column: a bar that stops at column B looks
    // truncated against the four-column category table below it.
    for (let c = colOffset; c <= 4; c++) {
      r.getCell(c).fill = HEADER_FILL;
    }
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
    valueCell.value = round2(amount);
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
  writeAmountRow(leftRow, 1, "Total Income:", summary.totalIncome, { color: POSITIVE_COLOR });
  leftRow++;
  writeAmountRow(leftRow, 1, "Total Expenses:", summary.totalExpenses, { color: NEGATIVE_COLOR });
  leftRow++;
  writeAmountRow(leftRow, 1, "Net Change:", summary.netChange, {
    bold: true,
    color: signedColor(summary.netChange),
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
        color: signedColor(netChange),
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

  // ── Category Totals (full-width, below the summary column) ──
  if (summary.categoryTotals.length > 0) {
    let categoryRow = leftRow + 2;

    writeSectionHeader(categoryRow, 1, "CATEGORY BREAKDOWN");
    categoryRow++;

    const header = sheet.getRow(categoryRow);
    header.getCell(1).value = "Category";
    // "Income" / "Expense" rather than "In" / "Out": same concept as the
    // Transactions sheet, so it gets the same name.
    header.getCell(2).value = "Income";
    header.getCell(3).value = "Expense";
    header.getCell(4).value = "Net";
    header.font = { bold: true };
    for (let c = 1; c <= 4; c++) {
      header.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLUMN_HEADER_BG },
      };
      header.getCell(c).border = {
        bottom: { style: "thin", color: { argb: RULE_COLOR } },
      };
    }
    categoryRow++;

    const firstDataRow = categoryRow;

    for (const group of summary.categoryTotals) {
      const groupRow = sheet.getRow(categoryRow);
      groupRow.getCell(1).value = group.parentName;
      groupRow.getCell(2).value = round2(group.totalIn);
      groupRow.getCell(3).value = round2(group.totalOut);
      groupRow.getCell(4).value = round2(group.net);
      const groupBold = group.children.length > 0;
      if (groupBold) groupRow.font = { bold: true };
      // Set after the row font: assigning row.font would otherwise overwrite
      // this cell's colour, and assigning it here drops the row's bold.
      groupRow.getCell(4).font = {
        bold: groupBold,
        color: { argb: signedColor(group.net) },
      };
      categoryRow++;

      for (const child of group.children) {
        const childRow = sheet.getRow(categoryRow);
        childRow.getCell(1).value = `    ${child.name}`;
        childRow.getCell(2).value = round2(child.in);
        childRow.getCell(3).value = round2(child.out);
        childRow.getCell(4).value = round2(child.net);
        childRow.getCell(4).font = { color: { argb: signedColor(child.net) } };
        categoryRow++;
      }
    }

    const totalRow = sheet.getRow(categoryRow);
    totalRow.getCell(1).value = "Total";
    totalRow.getCell(2).value = round2(summary.totalIncome);
    totalRow.getCell(3).value = round2(summary.totalExpenses);
    totalRow.getCell(4).value = round2(summary.netChange);
    totalRow.font = { bold: true };
    totalRow.getCell(4).font = {
      bold: true,
      color: { argb: signedColor(summary.netChange) },
    };
    for (let c = 1; c <= 4; c++) {
      totalRow.getCell(c).border = {
        top: { style: "double", color: { argb: BANNER_BG } },
      };
    }

    for (let r = firstDataRow; r <= categoryRow; r++) {
      for (let c = 2; c <= 4; c++) {
        sheet.getCell(r, c).numFmt = currencyFmt;
      }
    }
  }
}

/**
 * `percentOfPlan` arrives as a percentage (109.68 means 109.7%), but Excel's
 * percent format expects a ratio. Written as a number rather than a formatted
 * string so the column sorts, filters and conditional-formats.
 */
function toPercentRatio(percent: number | null): number | null {
  return percent === null ? null : percent / 100;
}

function buildBudgetSheet(workbook: ExcelJS.Workbook, data: BudgetReportData) {
  const sheet = workbook.addWorksheet("Budget vs. Actuals");
  const currencyFmt = CURRENCY_FMT;

  sheet.columns = [
    { key: "category", width: 42 },
    { key: "budgeted", width: 15 },
    { key: "actual", width: 15 },
    { key: "variance", width: 20 },
    { key: "variancePct", width: 12 },
  ];

  // Header
  writeBanner(sheet, 1, 5, `Budget vs. Actuals: ${data.budgetName}`, 14);
  writeBannerSubtitle(
    sheet,
    2,
    5,
    `${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)} (${data.status})`
  );

  sheet.addRow([]);

  // Column headers
  const headerRow = sheet.addRow([
    "Category",
    "Budgeted",
    "Actual",
    // Spelling out the direction: budgets are signed, so a positive variance on
    // an expense line means under-spent, which reads backwards without this.
    "Variance (Actual − Budget)",
    "% of Plan",
  ]);
  headerRow.font = { bold: true };
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLUMN_HEADER_BG },
    };
    cell.border = {
      top: { style: "thin", color: { argb: RULE_COLOR } },
      bottom: { style: "thin", color: { argb: RULE_COLOR } },
    };
  });

  sheet.views = [
    { state: "frozen", ySplit: 4, xSplit: 0, showGridLines: false },
  ];
  sheet.properties.tabColor = { argb: BANNER_BG };
  applyPrintSetup(sheet, { headerRow: 4, orientation: "portrait" });

  /** One data row: signed colours on Budgeted/Actual, percent as a ratio. */
  function writeLineRow(
    label: string,
    line: {
      budgeted: number;
      actual: number;
      variance: number;
      percentOfPlan: number | null;
    },
    opts: { bold?: boolean; fill?: string; unfavorable?: boolean }
  ): ExcelJS.Row {
    const row = sheet.addRow([
      label,
      round2(line.budgeted),
      round2(line.actual),
      round2(line.variance),
      toPercentRatio(line.percentOfPlan),
    ]);
    const bold = opts.bold ?? false;
    if (bold) row.font = { bold: true };
    if (opts.fill) {
      for (let c = 1; c <= 5; c++) {
        row.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: opts.fill },
        };
      }
    }
    // Only lines that are actually over budget get a fill, and only once they
    // have activity to compare — see isOverBudget.
    if (opts.unfavorable) {
      row.getCell(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: UNFAVORABLE_BG },
      };
    }
    // Variance deliberately keeps its unfavorable fill and no sign colour:
    // coming in under budget on an expense line is negative but good, so
    // colouring it by sign would contradict the fill in the same cell.
    row.getCell(2).font = { bold, color: { argb: signedColor(line.budgeted) } };
    row.getCell(3).font = { bold, color: { argb: signedColor(line.actual) } };
    for (let c = 2; c <= 4; c++) row.getCell(c).numFmt = currencyFmt;
    row.getCell(5).numFmt = PERCENT_FMT;
    return row;
  }

  /** A parent header carrying the group roll-up, then its child lines. */
  function writeGroups(groups: readonly BudgetGroup[]) {
    for (const group of groups) {
      const rollUp = rollUpGroup(group);
      writeLineRow(
        group.parentName,
        { ...rollUp, percentOfPlan: rollUpPercentOfPlan(rollUp) },
        {
          bold: true,
          fill: SUBTOTAL_BG,
          unfavorable: isOverBudget(
            rollUp.actual >= rollUp.budgeted,
            rollUp.actual
          ),
        }
      );

      for (const { label, line } of group.children) {
        writeLineRow(`    ${label}`, line, {
          unfavorable: isOverBudget(line.favorable, line.actual),
        });
      }
    }
  }

  writeGroups(groupBudgetLines(data.netLines));

  const totalRow = writeLineRow(
    "Total (Budgeted Lines)",
    { ...data.netTotals, percentOfPlan: null },
    {
      bold: true,
      unfavorable: isOverBudget(
        data.netTotals.actual >= data.netTotals.budgeted,
        data.netTotals.actual
      ),
    }
  );
  totalRow.getCell(5).value = null;
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: "double", color: { argb: BANNER_BG } },
    };
  });

  if (data.unbudgetedNet.length > 0) {
    sheet.addRow([]);
    writeBanner(sheet, sheet.rowCount + 1, 5, "UNBUDGETED", 11);

    writeGroups(groupBudgetLines(data.unbudgetedNet));

    const unbudgetedActual = round2(
      data.unbudgetedNet.reduce((sum, line) => sum + line.actual, 0)
    );
    const unbudgetedRow = writeLineRow(
      "Total (Unbudgeted Lines)",
      {
        budgeted: 0,
        actual: unbudgetedActual,
        variance: unbudgetedActual,
        percentOfPlan: null,
      },
      { bold: true }
    );
    unbudgetedRow.getCell(5).value = null;
    unbudgetedRow.eachCell((cell) => {
      cell.border = { top: { style: "thin", color: { argb: RULE_COLOR } } };
    });

    const allActual = round2(data.netTotals.actual + unbudgetedActual);
    const allRow = writeLineRow(
      "Total (All Lines)",
      {
        budgeted: data.netTotals.budgeted,
        actual: allActual,
        variance: round2(allActual - data.netTotals.budgeted),
        percentOfPlan: null,
      },
      {
        bold: true,
        unfavorable: isOverBudget(
          allActual >= data.netTotals.budgeted,
          allActual
        ),
      }
    );
    allRow.getCell(5).value = null;
    allRow.eachCell((cell) => {
      cell.border = { top: { style: "double", color: { argb: BANNER_BG } } };
    });
  }
}
function buildSeasonsSheet(workbook: ExcelJS.Workbook, data: SeasonsReportData) {
  const sheet = workbook.addWorksheet("Active Seasons");
  const currencyFmt = CURRENCY_FMT;

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
  writeBanner(sheet, 1, 9, "Active Seasons Summary", 14);

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
  headerRow.height = 18;
  headerRow.eachCell((cell) => {
    cell.alignment = { vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLUMN_HEADER_BG },
    };
    cell.border = {
      top: { style: "thin", color: { argb: RULE_COLOR } },
      bottom: { style: "thin", color: { argb: RULE_COLOR } },
    };
  });

  // Freeze panes
  sheet.views = [
    { state: "frozen", ySplit: 3, xSplit: 0, showGridLines: false },
  ];
  sheet.properties.tabColor = { argb: BANNER_BG };
  applyPrintSetup(sheet, { headerRow: 3 });

  for (const season of data.seasons) {
    const row = sheet.addRow([
      season.seasonName,
      toExcelDate(season.startDate),
      toExcelDate(season.endDate),
      round2(season.baseFee),
      season.enrolledCount,
      round2(season.totalExpected),
      round2(season.totalCollected),
      round2(season.totalOutstanding),
      season.collectionRate / 100,
    ]);

    row.getCell(2).numFmt = DATE_FMT;
    row.getCell(3).numFmt = DATE_FMT;
    row.getCell(4).numFmt = currencyFmt;
    row.getCell(6).numFmt = currencyFmt;
    row.getCell(7).numFmt = currencyFmt;
    row.getCell(7).font = { color: { argb: POSITIVE_COLOR } };
    row.getCell(8).numFmt = currencyFmt;
    row.getCell(8).font = { color: { argb: NEGATIVE_COLOR } };
    row.getCell(9).numFmt = PERCENT_FMT;
  }

  // Grand total row (only when multiple seasons)
  if (data.seasons.length > 1) {
    const totalRow = sheet.addRow([
      "Grand Total",
      "",
      "",
      "",
      data.grandTotals.enrolledCount,
      round2(data.grandTotals.totalExpected),
      round2(data.grandTotals.totalCollected),
      round2(data.grandTotals.totalOutstanding),
      data.grandTotals.collectionRate / 100,
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(6).numFmt = currencyFmt;
    totalRow.getCell(7).numFmt = currencyFmt;
    totalRow.getCell(7).font = { bold: true, color: { argb: POSITIVE_COLOR } };
    totalRow.getCell(8).numFmt = currencyFmt;
    totalRow.getCell(8).font = { bold: true, color: { argb: NEGATIVE_COLOR } };
    totalRow.getCell(9).numFmt = PERCENT_FMT;
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "double", color: { argb: "FF1E293B" } },
      };
    });
  }
}
