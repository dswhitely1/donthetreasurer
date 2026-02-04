import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { SeasonReportData } from "@/lib/seasons/types";

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

const MARGIN = 40;
const HEADER_BG: [number, number, number] = [226, 232, 240];

function addPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - MARGIN,
      pageHeight - 20,
      { align: "right" }
    );
  }
}

function getFinalY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastTable = (doc as any).lastAutoTable;
  return lastTable?.finalY ?? MARGIN;
}

export function generateSeasonReportPdf(data: SeasonReportData): Buffer {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });

  // Title block
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.organizationName, MARGIN, MARGIN + 10);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Season Report: ${data.seasonName}`, MARGIN, MARGIN + 28);

  doc.setFontSize(10);
  doc.text(
    `${formatPdfDate(data.startDate)} to ${formatPdfDate(data.endDate)}`,
    MARGIN,
    MARGIN + 44
  );
  doc.text(
    `Generated: ${new Date(data.generatedAt).toLocaleString("en-US")}`,
    MARGIN,
    MARGIN + 58
  );

  // Summary table
  const summaryData = [
    ["Total Enrolled", String(data.summary.totalEnrolled)],
    ["Total Fees Expected", formatCurrency(data.summary.totalFeesExpected)],
    ["Total Collected", formatCurrency(data.summary.totalCollected)],
    ["Total Outstanding", formatCurrency(data.summary.totalOutstanding)],
    ["Collection Rate", `${data.summary.collectionRate.toFixed(1)}%`],
  ];

  autoTable(doc, {
    startY: MARGIN + 72,
    head: [["Summary", ""]],
    body: summaryData,
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: HEADER_BG,
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 150, fontStyle: "bold" },
      1: { cellWidth: 100, halign: "right" },
    },
    tableWidth: 250,
  });

  // Enrollment detail table
  const enrollmentData = data.enrollments.map((e) => [
    e.studentName,
    e.guardianName ?? "",
    e.contactEmail ?? e.contactPhone ?? "",
    formatCurrency(e.feeAmount),
    formatCurrency(e.totalPaid),
    formatCurrency(e.balanceDue),
    e.paymentStatus.charAt(0).toUpperCase() + e.paymentStatus.slice(1),
  ]);

  autoTable(doc, {
    startY: getFinalY(doc) + 20,
    head: [
      [
        "Student Name",
        "Guardian",
        "Contact",
        "Fee",
        "Total Paid",
        "Balance Due",
        "Status",
      ],
    ],
    body: enrollmentData,
    theme: "striped",
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: HEADER_BG,
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "center" },
    },
  });

  addPageNumbers(doc);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
