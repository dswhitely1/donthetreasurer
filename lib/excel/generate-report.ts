import ExcelJS from "exceljs";

import type { ReportData, ReportTransaction } from "@/lib/reports/types";

function formatExcelDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function generateReportWorkbook(
  data: ReportData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  buildTransactionsSheet(workbook, data);
  buildSummarySheet(workbook, data);

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

  const dateRangeRow = sheet.addRow([
    `Cleared: ${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)} (includes all uncleared)`,
  ]);
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

  sheet.columns = [
    { key: "label", width: 35 },
    { key: "value", width: 20 },
  ];

  const currencyFmt = "$#,##0.00";

  function addSectionHeader(text: string) {
    const row = sheet.addRow([text]);
    row.font = { size: 13, bold: true };
    sheet.addRow([]);
  }

  function addAmountRow(label: string, amount: number, indent = false) {
    const displayLabel = indent ? `  ${label}` : label;
    const row = sheet.addRow([displayLabel, amount]);
    row.getCell(2).numFmt = currencyFmt;
    return row;
  }

  function addBoldAmountRow(label: string, amount: number) {
    const row = addAmountRow(label, amount);
    row.font = { bold: true };
    return row;
  }

  // Overall Summary
  addSectionHeader("OVERALL SUMMARY");
  addAmountRow("Total Income:", summary.totalIncome);
  addAmountRow("Total Expenses:", summary.totalExpenses);
  const netRow = addBoldAmountRow("Net Change:", summary.netChange);
  if (summary.netChange >= 0) {
    netRow.getCell(2).font = { bold: true, color: { argb: "FF16A34A" } };
  } else {
    netRow.getCell(2).font = { bold: true, color: { argb: "FFDC2626" } };
  }
  sheet.addRow([]);

  // Balance by Status
  addSectionHeader("BALANCE BY STATUS");
  addAmountRow("Uncleared Balance:", summary.balanceByStatus.uncleared);
  addAmountRow("Cleared Balance:", summary.balanceByStatus.cleared);
  addAmountRow("Reconciled Balance:", summary.balanceByStatus.reconciled);
  sheet.addRow([]);

  // Income by Category
  if (summary.incomeByCategory.length > 0) {
    addSectionHeader("INCOME BY CATEGORY");
    for (const group of summary.incomeByCategory) {
      const parentRow = sheet.addRow([group.parentName]);
      parentRow.font = { bold: true };
      for (const child of group.children) {
        addAmountRow(child.name, child.total, true);
      }
      if (group.children.length > 1) {
        const subtotalRow = addAmountRow("Subtotal:", group.subtotal, true);
        subtotalRow.font = { italic: true };
        subtotalRow.getCell(2).font = { italic: true };
        subtotalRow.getCell(2).numFmt = currencyFmt;
      }
    }
    sheet.addRow([]);
  }

  // Expenses by Category
  if (summary.expensesByCategory.length > 0) {
    addSectionHeader("EXPENSES BY CATEGORY");
    for (const group of summary.expensesByCategory) {
      const parentRow = sheet.addRow([group.parentName]);
      parentRow.font = { bold: true };
      for (const child of group.children) {
        addAmountRow(child.name, child.total, true);
      }
      if (group.children.length > 1) {
        const subtotalRow = addAmountRow("Subtotal:", group.subtotal, true);
        subtotalRow.font = { italic: true };
        subtotalRow.getCell(2).font = { italic: true };
        subtotalRow.getCell(2).numFmt = currencyFmt;
      }
    }
  }
}
