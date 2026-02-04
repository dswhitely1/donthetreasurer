import ExcelJS from "exceljs";

import type { SeasonReportData } from "@/lib/seasons/types";

function formatExcelDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

const CURRENCY_FMT = "$#,##0.00";

export async function generateSeasonReportWorkbook(
  data: SeasonReportData
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  buildSummarySheet(workbook, data);
  buildEnrollmentSheet(workbook, data);
  buildPaymentSheet(workbook, data);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  data: SeasonReportData
) {
  const sheet = workbook.addWorksheet("Season Summary");
  sheet.columns = [
    { width: 25 },
    { width: 20 },
  ];

  // Header
  const titleRow = sheet.addRow([data.organizationName]);
  titleRow.getCell(1).font = { bold: true, size: 14 };

  const subtitleRow = sheet.addRow([`Season Report: ${data.seasonName}`]);
  subtitleRow.getCell(1).font = { bold: true, size: 12 };

  sheet.addRow([
    `${formatExcelDate(data.startDate)} to ${formatExcelDate(data.endDate)}`,
  ]);
  sheet.addRow([
    `Generated: ${new Date(data.generatedAt).toLocaleString("en-US")}`,
  ]);

  sheet.addRow([]); // blank row

  const summaryHeader = sheet.addRow(["Summary"]);
  summaryHeader.getCell(1).font = { bold: true, size: 12 };

  sheet.addRow(["Total Enrolled:", data.summary.totalEnrolled]);

  const feesRow = sheet.addRow([
    "Total Fees Expected:",
    data.summary.totalFeesExpected,
  ]);
  feesRow.getCell(2).numFmt = CURRENCY_FMT;

  const collectedRow = sheet.addRow([
    "Total Collected:",
    data.summary.totalCollected,
  ]);
  collectedRow.getCell(2).numFmt = CURRENCY_FMT;

  const outstandingRow = sheet.addRow([
    "Total Outstanding:",
    data.summary.totalOutstanding,
  ]);
  outstandingRow.getCell(2).numFmt = CURRENCY_FMT;

  const rateRow = sheet.addRow([
    "Collection Rate:",
    data.summary.collectionRate / 100,
  ]);
  rateRow.getCell(2).numFmt = "0.0%";
}

function buildEnrollmentSheet(
  workbook: ExcelJS.Workbook,
  data: SeasonReportData
) {
  const sheet = workbook.addWorksheet("Enrollment Detail");

  const headers = [
    "Student Name",
    "Guardian",
    "Contact",
    "Fee",
    "Total Paid",
    "Balance Due",
    "Status",
  ];
  const widths = [25, 25, 25, 12, 12, 12, 12];

  sheet.columns = widths.map((width) => ({ width }));

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
  });

  for (const enrollment of data.enrollments) {
    const row = sheet.addRow([
      enrollment.studentName,
      enrollment.guardianName ?? "",
      enrollment.contactEmail ?? enrollment.contactPhone ?? "",
      enrollment.feeAmount,
      enrollment.totalPaid,
      enrollment.balanceDue,
      enrollment.paymentStatus.charAt(0).toUpperCase() +
        enrollment.paymentStatus.slice(1),
    ]);

    row.getCell(4).numFmt = CURRENCY_FMT;
    row.getCell(5).numFmt = CURRENCY_FMT;
    row.getCell(6).numFmt = CURRENCY_FMT;
  }
}

function buildPaymentSheet(
  workbook: ExcelJS.Workbook,
  data: SeasonReportData
) {
  const sheet = workbook.addWorksheet("Payment Detail");

  const headers = [
    "Student Name",
    "Payment Date",
    "Amount",
    "Method",
    "Notes",
  ];
  const widths = [25, 15, 12, 15, 30];

  sheet.columns = widths.map((width) => ({ width }));

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
  });

  for (const enrollment of data.enrollments) {
    for (const payment of enrollment.payments) {
      const row = sheet.addRow([
        enrollment.studentName,
        formatExcelDate(payment.payment_date),
        payment.amount,
        payment.payment_method ?? "",
        payment.notes ?? "",
      ]);

      row.getCell(3).numFmt = CURRENCY_FMT;
    }
  }
}
