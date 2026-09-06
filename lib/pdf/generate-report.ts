import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { CellHookData, CellInput, UserOptions } from "jspdf-autotable";
import type {
  AccountBalanceSummary,
  ReportData,
  ReportTransaction,
  SeasonsReportData,
} from "@/lib/reports/types";
import {
  groupBudgetLines,
  isOverBudget,
  rollUpGroup,
  rollUpPercentOfPlan,
} from "@/lib/reports/budget-grouping";

import type { BudgetGroup } from "@/lib/reports/budget-grouping";
import type { BudgetReportData } from "@/lib/reports/fetch-budget-data";

function formatPdfDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/** Replace Unicode characters unsupported by jsPDF built-in fonts with ASCII */
function sanitizeText(text: string): string {
  return text.replace(/\u2192/g, ">").replace(/\u2014/g, "--");
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

const MARGIN = 40;
const GREEN: [number, number, number] = [22, 163, 74]; // #16a34a
const RED: [number, number, number] = [220, 38, 38]; // #dc2626
const BLUE_BG: [number, number, number] = [219, 234, 254]; // #dbeafe
const GRAY_BG: [number, number, number] = [241, 245, 249]; // #f1f5f9
const HEADER_BG: [number, number, number] = [226, 232, 240]; // #e2e8f0

function getFinalY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastTable = (doc as any).lastAutoTable;
  return lastTable?.finalY ?? MARGIN;
}

function addPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - MARGIN, pageHeight - 20, {
      align: "right",
    });
  }
}

export function generateReportPdf(
  data: ReportData,
  budgetData?: BudgetReportData | null,
  seasonsData?: SeasonsReportData | null
): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

  // Title block
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.organizationName, MARGIN, MARGIN + 10);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Transaction Report", MARGIN, MARGIN + 28);

  const dateBasisLabel = data.dateBasis === "transaction_date" ? "Transaction Date" : "Cleared Date";
  const dateRangeText = data.dateBasis === "transaction_date"
    ? (data.fiscalYearLabel
      ? `${data.fiscalYearLabel} — ${formatPdfDate(data.startDate)} to ${formatPdfDate(data.endDate)} (by Transaction Date)`
      : `${formatPdfDate(data.startDate)} to ${formatPdfDate(data.endDate)} (by Transaction Date)`)
    : (data.fiscalYearLabel
      ? `${data.fiscalYearLabel} — Cleared: ${formatPdfDate(data.startDate)} to ${formatPdfDate(data.endDate)} (includes all uncleared)`
      : `Cleared: ${formatPdfDate(data.startDate)} to ${formatPdfDate(data.endDate)} (includes all uncleared)`);

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(dateRangeText, MARGIN, MARGIN + 43);

  doc.setTextColor(102, 102, 102);
  doc.text(
    `Generated: ${new Date(data.generatedAt).toLocaleString()}  |  Date Basis: ${dateBasisLabel}`,
    MARGIN,
    MARGIN + 55
  );
  doc.setTextColor(0, 0, 0);

  let startY = MARGIN + 70;

  // Transactions section
  if (data.transactions.length === 0) {
    autoTable(doc, {
      startY,
      head: [["Transaction Date", "Account", "Check #", "Vendor", "Description", "Category", "Line Memo", "Income", "Expense", "Status", "Cleared", "Balance"]],
      body: [[{ content: "No transactions found matching these filters.", colSpan: 12, styles: { fontStyle: "italic", textColor: [102, 102, 102], halign: "center" } }]],
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      headStyles: { fillColor: HEADER_BG, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 3 },
    });
  } else {
    const accountGroups = new Map<string, ReportTransaction[]>();
    for (const txn of data.transactions) {
      const group = accountGroups.get(txn.accountName) ?? [];
      group.push(txn);
      accountGroups.set(txn.accountName, group);
    }

    const balanceByAccount = new Map<string, AccountBalanceSummary>();
    if (data.accountBalances) {
      for (const ab of data.accountBalances) {
        balanceByAccount.set(ab.accountName, ab);
      }
    }

    let grandTotalIncome = 0;
    let grandTotalExpense = 0;

    for (const [accountName, txns] of accountGroups) {
      const acctBalance = balanceByAccount.get(accountName);

      // Account header
      const accountRows: CellInput[][] = [];
      const accountRowStyles: Record<number, Partial<UserOptions["bodyStyles"]>> = {};

      // Account header row
      accountRows.push([
        {
          content: `Account: ${accountName}`,
          colSpan: 12,
          styles: { fillColor: BLUE_BG, fontStyle: "bold", fontSize: 8 },
        },
      ]);

      // Starting balance
      if (acctBalance) {
        accountRows.push([
          "", "", "", "", "", "",
          { content: "Starting Balance:", styles: { fontStyle: "italic" } },
          "", "", "", "",
          { content: formatCurrency(acctBalance.startingBalance), styles: { fontStyle: "bolditalic", halign: "right" } },
        ]);
      }

      let accountIncome = 0;
      let accountExpense = 0;

      for (const status of STATUS_ORDER) {
        const statusTxns = txns.filter((t) => t.status === status);
        if (statusTxns.length === 0) continue;

        // Status sub-header
        accountRows.push([
          {
            content: `  ${STATUS_LABELS[status]}`,
            colSpan: 12,
            styles: { fillColor: GRAY_BG, fontStyle: "bolditalic", fontSize: 7 },
          },
        ]);

        let statusIncome = 0;
        let statusExpense = 0;

        for (const txn of statusTxns) {
          for (let i = 0; i < txn.lineItems.length; i++) {
            const li = txn.lineItems[i];
            const isFirst = i === 0;
            const incomeAmt = txn.transactionType === "income" ? li.amount : null;
            const expenseAmt = txn.transactionType === "expense" ? li.amount : null;

            accountRows.push([
              isFirst ? formatPdfDate(txn.transactionDate) : "",
              isFirst ? txn.accountName : "",
              isFirst ? txn.checkNumber ?? "" : "",
              isFirst ? txn.vendor ?? "" : "",
              isFirst ? txn.description : "",
              sanitizeText(li.categoryLabel),
              li.memo ?? "",
              incomeAmt !== null ? formatCurrency(incomeAmt) : "",
              expenseAmt !== null ? formatCurrency(expenseAmt) : "",
              isFirst
                ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1)
                : "",
              isFirst && txn.clearedAt
                ? formatPdfDate(txn.clearedAt.slice(0, 10))
                : "",
              "", // Balance column
            ]);

            // Track row index for coloring
            const rowIdx = accountRows.length - 1;
            if (incomeAmt !== null) {
              accountRowStyles[rowIdx] = { _incomeCol: 7 } as Record<string, unknown>;
            }
            if (expenseAmt !== null) {
              accountRowStyles[rowIdx] = { _expenseCol: 8 } as Record<string, unknown>;
            }
          }

          if (txn.transactionType === "income") {
            statusIncome += txn.amount;
          } else {
            statusExpense += txn.amount;
          }
        }

        // Status subtotal
        accountRows.push([
          "", "", "", "", "", "",
          { content: `${STATUS_LABELS[status]} Subtotal:`, styles: { fontStyle: "italic" } },
          statusIncome ? formatCurrency(statusIncome) : "",
          statusExpense ? formatCurrency(statusExpense) : "",
          "", "", "",
        ]);

        accountIncome += statusIncome;
        accountExpense += statusExpense;
      }

      // Account total
      accountRows.push([
        "", "", "", "", "", "",
        { content: `${accountName} Total:`, styles: { fontStyle: "bold" } },
        accountIncome ? formatCurrency(accountIncome) : "",
        accountExpense ? formatCurrency(accountExpense) : "",
        "", "", "",
      ]);

      // Ending balance
      if (acctBalance) {
        accountRows.push([
          "", "", "", "", "", "",
          { content: "Ending Balance:", styles: { fontStyle: "italic" } },
          "", "", "", "",
          { content: formatCurrency(acctBalance.endingBalance), styles: { fontStyle: "bolditalic", halign: "right" } },
        ]);
      }

      grandTotalIncome += accountIncome;
      grandTotalExpense += accountExpense;

      autoTable(doc, {
        startY,
        head: [["Txn Date", "Account", "Check #", "Vendor", "Description", "Category", "Line Memo", "Income", "Expense", "Status", "Cleared", "Balance"]],
        body: accountRows,
        margin: { left: MARGIN, right: MARGIN },
        theme: "grid",
        headStyles: {
          fillColor: HEADER_BG,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 7,
        },
        styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
        columnStyles: {
          0: { cellWidth: 50 },  // Txn Date
          1: { cellWidth: 55 },  // Account
          2: { cellWidth: 35 },  // Check #
          3: { cellWidth: 60 },  // Vendor
          4: { cellWidth: "auto" }, // Description
          5: { cellWidth: 75 },  // Category
          6: { cellWidth: 60 },  // Line Memo
          7: { cellWidth: 50, halign: "right" },  // Income
          8: { cellWidth: 50, halign: "right" },  // Expense
          9: { cellWidth: 45 },  // Status
          10: { cellWidth: 50 }, // Cleared
          11: { cellWidth: 50, halign: "right" }, // Balance
        },
        willDrawCell(hookData: CellHookData) {
          if (hookData.section === "body") {
            const colIdx = hookData.column.index;
            const text = hookData.cell.text.join("");
            // Color income column green
            if (colIdx === 7 && text && text.startsWith("$")) {
              hookData.cell.styles.textColor = GREEN;
            }
            // Color expense column red
            if (colIdx === 8 && text && text.startsWith("$")) {
              hookData.cell.styles.textColor = RED;
            }
          }
        },
      });

      startY = getFinalY(doc) + 10;
    }

    // Grand Total row
    autoTable(doc, {
      startY,
      body: [
        [
          "", "", "", "", "", "",
          { content: "GRAND TOTAL:", styles: { fontStyle: "bold", fontSize: 8 } },
          {
            content: grandTotalIncome ? formatCurrency(grandTotalIncome) : "",
            styles: { fontStyle: "bold", textColor: GREEN, halign: "right" },
          },
          {
            content: grandTotalExpense ? formatCurrency(grandTotalExpense) : "",
            styles: { fontStyle: "bold", textColor: RED, halign: "right" },
          },
          "", "", "",
        ],
      ],
      margin: { left: MARGIN, right: MARGIN },
      theme: "plain",
      showHead: false,
      styles: { fontSize: 7, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 55 },
        2: { cellWidth: 35 },
        3: { cellWidth: 60 },
        4: { cellWidth: "auto" },
        5: { cellWidth: 75 },
        6: { cellWidth: 60 },
        7: { cellWidth: 50, halign: "right" },
        8: { cellWidth: 50, halign: "right" },
        9: { cellWidth: 45 },
        10: { cellWidth: 50 },
        11: { cellWidth: 50, halign: "right" },
      },
    });
  }

  // Summary section — new page with two-column layout
  doc.addPage();
  const { summary } = data;

  const SLATE_800: [number, number, number] = [30, 41, 59]; // #1E293B
  const SLATE_50: [number, number, number] = [248, 250, 252]; // #F8FAFC
  const WHITE: [number, number, number] = [255, 255, 255];
  const LEFT_X = MARGIN;
  const COL_WIDTH = 340;
  const LABEL_WIDTH = 220;
  const VALUE_WIDTH = 120;

  // Full-width "Summary" title banner
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...SLATE_800);
  doc.rect(MARGIN, MARGIN, pageWidth - MARGIN * 2, 24, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("Summary", pageWidth / 2, MARGIN + 16, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Subtitle row: org name + date range
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(102, 102, 102);
  const summarySubtitle = `${data.organizationName}  |  ${formatPdfDate(data.startDate)} to ${formatPdfDate(data.endDate)}`;
  doc.text(summarySubtitle, pageWidth / 2, MARGIN + 36, { align: "center" });
  doc.setTextColor(0, 0, 0);

  const columnsStartY = MARGIN + 48;

  // Helper: draw a dark section header bar within a column
  function drawColumnSectionHeader(title: string, x: number, y: number): number {
    doc.setFillColor(...SLATE_800);
    doc.rect(x, y, COL_WIDTH, 16, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text(title, x + 6, y + 11);
    doc.setTextColor(0, 0, 0);
    return y + 16;
  }

  // Helper: draw a summary table within a column using autoTable
  function drawColumnTable(
    rows: CellInput[][],
    x: number,
    y: number
  ): number {
    autoTable(doc, {
      startY: y,
      body: rows,
      margin: { left: x, right: pageWidth - x - COL_WIDTH },
      theme: "plain",
      showHead: false,
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: LABEL_WIDTH },
        1: { cellWidth: VALUE_WIDTH, halign: "right" },
      },
      tableWidth: COL_WIDTH,
      alternateRowStyles: { fillColor: SLATE_50 },
    });
    return getFinalY(doc) + 8;
  }

  // ── Left Column ──────────────────────────────────────────────
  let leftY = columnsStartY;

  // OVERALL SUMMARY
  leftY = drawColumnSectionHeader("OVERALL SUMMARY", LEFT_X, leftY);
  const overallRows: CellInput[][] = [
    [
      "Total Income:",
      { content: formatCurrency(summary.totalIncome), styles: { textColor: GREEN } },
    ],
    [
      "Total Expenses:",
      { content: formatCurrency(summary.totalExpenses), styles: { textColor: RED } },
    ],
    [
      { content: "Net Change:", styles: { fontStyle: "bold" } },
      {
        content: formatCurrency(summary.netChange),
        styles: {
          fontStyle: "bold",
          textColor: summary.netChange >= 0 ? GREEN : RED,
        },
      },
    ],
  ];
  leftY = drawColumnTable(overallRows, LEFT_X, leftY);

  // ACCOUNT BALANCES
  if (data.accountBalances && data.accountBalances.length > 0) {
    leftY = drawColumnSectionHeader("ACCOUNT BALANCES", LEFT_X, leftY);
    const balanceRows: CellInput[][] = [];
    for (const ab of data.accountBalances) {
      balanceRows.push([
        { content: ab.accountName, styles: { fontStyle: "bold" } },
        "",
      ]);
      balanceRows.push(["  Starting Balance:", formatCurrency(ab.startingBalance)]);
      balanceRows.push(["  Ending Balance:", formatCurrency(ab.endingBalance)]);
      const netChange = ab.endingBalance - ab.startingBalance;
      balanceRows.push([
        { content: "  Net Change:", styles: { fontStyle: "italic" } },
        {
          content: formatCurrency(netChange),
          styles: {
            fontStyle: "italic",
            textColor: netChange >= 0 ? GREEN : RED,
          },
        },
      ]);
    }
    leftY = drawColumnTable(balanceRows, LEFT_X, leftY);
  }

  // BALANCE BY STATUS
  leftY = drawColumnSectionHeader("BALANCE BY STATUS", LEFT_X, leftY);
  leftY = drawColumnTable(
    [
      ["Uncleared Balance:", formatCurrency(summary.balanceByStatus.uncleared)],
      ["Cleared Balance:", formatCurrency(summary.balanceByStatus.cleared)],
      ["Reconciled Balance:", formatCurrency(summary.balanceByStatus.reconciled)],
    ],
    LEFT_X,
    leftY
  );

  // ── Category Totals (full-width, below the left column) ─────
  if (summary.categoryTotals.length > 0) {
    let categoryY = leftY + 8;

    // Check if we need a new page
    const pageHeight = doc.internal.pageSize.getHeight();
    if (categoryY > pageHeight - 100) {
      doc.addPage();
      categoryY = MARGIN;
    }

    // Bold whole rows for parents with subcategories and for the grand
    // total, mirroring Task 3's Excel behavior (font bold, no color).
    const boldRow = (values: string[]): CellInput[] =>
      values.map((value) => ({ content: value, styles: { fontStyle: "bold" } }));

    const body: CellInput[][] = [];

    for (const group of summary.categoryTotals) {
      const rowValues = [
        group.parentName,
        formatCurrency(group.totalIn),
        formatCurrency(group.totalOut),
        formatCurrency(group.net),
      ];
      body.push(group.children.length > 0 ? boldRow(rowValues) : rowValues);
      for (const child of group.children) {
        body.push([
          `    ${child.name}`,
          formatCurrency(child.in),
          formatCurrency(child.out),
          formatCurrency(child.net),
        ]);
      }
    }

    body.push(
      boldRow([
        "Total",
        formatCurrency(summary.totalIncome),
        formatCurrency(summary.totalExpenses),
        formatCurrency(summary.netChange),
      ])
    );

    autoTable(doc, {
      startY: categoryY,
      head: [["Category", "In", "Out", "Net"]],
      body,
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

  // Budget vs. Actuals page
  if (budgetData) {
    doc.addPage();
    let budgetY = MARGIN + 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`Budget vs. Actuals: ${budgetData.budgetName}`, MARGIN, budgetY);
    budgetY += 18;

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(
      `${formatPdfDate(budgetData.startDate)} to ${formatPdfDate(budgetData.endDate)} (${budgetData.status})`,
      MARGIN,
      budgetY
    );
    budgetY += 15;

    // Net budget table, grouped by parent category. Budget line items are
    // stored in insertion order, which interleaves parents down the page and
    // repeats the "Parent > Child" prefix on every row.
    const budgetHead = [
      [
        "Category",
        "Budgeted",
        "Actual",
        // Budgets are signed, so a positive variance on an expense line means
        // under-spent -- which reads backwards without the direction stated.
        "Variance (Actual - Budget)",
        "% of Plan",
      ],
    ];
    const budgetRows: CellInput[][] = [];

    const pushBudgetRow = (
      label: string,
      line: {
        budgeted: number;
        actual: number;
        variance: number;
        percentOfPlan: number | null;
      },
      opts: { bold?: boolean; group?: boolean; overBudget?: boolean } = {}
    ) => {
      const base = {
        ...(opts.bold ? { fontStyle: "bold" as const } : {}),
        ...(opts.group ? { fillColor: GRAY_BG } : {}),
      };
      budgetRows.push([
        { content: sanitizeText(label), styles: { ...base } },
        {
          content: formatCurrency(line.budgeted),
          styles: { ...base, halign: "right" },
        },
        {
          content: formatCurrency(line.actual),
          styles: { ...base, halign: "right" },
        },
        {
          content: formatCurrency(line.variance),
          // Only over-budget lines take a colour. Colouring the favorable ones
          // green too marked almost every row at the start of a fiscal year,
          // purely because the money had not been spent yet.
          styles: {
            ...base,
            halign: "right",
            ...(opts.overBudget ? { textColor: RED } : {}),
          },
        },
        {
          content:
            line.percentOfPlan === null
              ? ""
              : `${line.percentOfPlan.toFixed(1)}%`,
          styles: { ...base, halign: "right" },
        },
      ]);
    };

    const pushBudgetGroups = (groups: readonly BudgetGroup[]) => {
      for (const group of groups) {
        const rollUp = rollUpGroup(group);
        pushBudgetRow(
          group.parentName,
          { ...rollUp, percentOfPlan: rollUpPercentOfPlan(rollUp) },
          {
            bold: true,
            group: true,
            overBudget: isOverBudget(
              rollUp.actual >= rollUp.budgeted,
              rollUp.actual
            ),
          }
        );
        for (const { label, line } of group.children) {
          pushBudgetRow(`    ${label}`, line, {
            overBudget: isOverBudget(line.favorable, line.actual),
          });
        }
      }
    };

    pushBudgetGroups(groupBudgetLines(budgetData.netLines));

    pushBudgetRow(
      "Total (Budgeted Lines)",
      { ...budgetData.netTotals, percentOfPlan: null },
      {
        bold: true,
        overBudget: isOverBudget(
          budgetData.netTotals.actual >= budgetData.netTotals.budgeted,
          budgetData.netTotals.actual
        ),
      }
    );

    if (budgetData.unbudgetedNet.length > 0) {
      budgetRows.push([
        {
          content: "UNBUDGETED",
          colSpan: 5,
          styles: { fillColor: HEADER_BG, fontStyle: "bold", fontSize: 8 },
        },
      ]);

      pushBudgetGroups(groupBudgetLines(budgetData.unbudgetedNet));

      const unbudgetedActual = budgetData.unbudgetedNet.reduce(
        (sum, line) => sum + line.actual,
        0
      );
      pushBudgetRow(
        "Total (Unbudgeted Lines)",
        {
          budgeted: 0,
          actual: unbudgetedActual,
          variance: unbudgetedActual,
          percentOfPlan: null,
        },
        { bold: true }
      );

      const allActual = budgetData.netTotals.actual + unbudgetedActual;
      pushBudgetRow(
        "Total (All Lines)",
        {
          budgeted: budgetData.netTotals.budgeted,
          actual: allActual,
          variance: allActual - budgetData.netTotals.budgeted,
          percentOfPlan: null,
        },
        {
          bold: true,
          overBudget: isOverBudget(
            allActual >= budgetData.netTotals.budgeted,
            allActual
          ),
        }
      );
    }

    autoTable(doc, {
      startY: budgetY,
      head: budgetHead,
      body: budgetRows,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      headStyles: {
        fillColor: HEADER_BG,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 200 },
        1: { cellWidth: 80, halign: "right" },
        2: { cellWidth: 80, halign: "right" },
        3: { cellWidth: 80, halign: "right" },
        4: { cellWidth: 60, halign: "right" },
      },
      tableWidth: 500,
    });
  }

  // Active Seasons Summary page
  if (seasonsData) {
    doc.addPage();
    let seasonsY = MARGIN + 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Active Seasons Summary", MARGIN, seasonsY);
    seasonsY += 20;

    const seasonsHead = [["Season", "Start", "End", "Base Fee", "Enrolled", "Expected", "Collected", "Outstanding", "Rate"]];
    const seasonsRows: CellInput[][] = [];

    for (const season of seasonsData.seasons) {
      seasonsRows.push([
        season.seasonName,
        formatPdfDate(season.startDate),
        formatPdfDate(season.endDate),
        formatCurrency(season.baseFee),
        String(season.enrolledCount),
        formatCurrency(season.totalExpected),
        { content: formatCurrency(season.totalCollected), styles: { textColor: GREEN } },
        { content: formatCurrency(season.totalOutstanding), styles: { textColor: RED } },
        `${season.collectionRate.toFixed(1)}%`,
      ]);
    }

    // Grand total row when multiple seasons
    if (seasonsData.seasons.length > 1) {
      seasonsRows.push([
        { content: "Grand Total", styles: { fontStyle: "bold" } },
        "",
        "",
        "",
        { content: String(seasonsData.grandTotals.enrolledCount), styles: { fontStyle: "bold" } },
        { content: formatCurrency(seasonsData.grandTotals.totalExpected), styles: { fontStyle: "bold" } },
        { content: formatCurrency(seasonsData.grandTotals.totalCollected), styles: { fontStyle: "bold", textColor: GREEN } },
        { content: formatCurrency(seasonsData.grandTotals.totalOutstanding), styles: { fontStyle: "bold", textColor: RED } },
        { content: `${seasonsData.grandTotals.collectionRate.toFixed(1)}%`, styles: { fontStyle: "bold" } },
      ]);
    }

    autoTable(doc, {
      startY: seasonsY,
      head: seasonsHead,
      body: seasonsRows,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      headStyles: {
        fillColor: HEADER_BG,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60 },
        2: { cellWidth: 60 },
        3: { cellWidth: 60, halign: "right" },
        4: { cellWidth: 45, halign: "right" },
        5: { cellWidth: 70, halign: "right" },
        6: { cellWidth: 70, halign: "right" },
        7: { cellWidth: 70, halign: "right" },
        8: { cellWidth: 50, halign: "right" },
      },
    });
  }

  // Page numbers
  addPageNumbers(doc);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
