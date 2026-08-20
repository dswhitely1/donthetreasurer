import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { buildTokenValues, renderTemplate } from "@/lib/letters/render-template";
import { formatCurrency, formatDate } from "@/lib/utils";

import type {
  LetterBatchData,
  LetterDirector,
  LetterRecipient,
} from "@/lib/letters/types";

const MARGIN = 56;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT = 15;
const PARAGRAPH_GAP = 9;
const HEADER_BG: [number, number, number] = [226, 232, 240];

function getFinalY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastTable = (doc as any).lastAutoTable;
  return lastTable?.finalY ?? MARGIN;
}

/** Adds a page when `needed` points would run past the bottom margin. */
function ensureSpace(doc: jsPDF, cursorY: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return cursorY;
}

/** Blank lines separate paragraphs; single newlines stay inside one. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Signature lines, skipping fields the organization has not filled in. */
export function buildSignatureLines(director: LetterDirector): string[] {
  return [director.name, director.title, director.email, director.phone]
    .map((line) => line?.trim() ?? "")
    .filter((line) => line.length > 0);
}

function renderLetter(
  doc: jsPDF,
  data: LetterBatchData,
  recipient: LetterRecipient,
  contentWidth: number
): void {
  const values = buildTokenValues(data, recipient);
  let cursorY = MARGIN;

  // Letterhead: organization name left, generation date right.
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.organizationName, MARGIN, cursorY);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.generatedOn), MARGIN + contentWidth, cursorY, {
    align: "right",
  });
  cursorY += 28;

  const heading = data.template.heading
    ? renderTemplate(data.template.heading, values).trim()
    : "";
  if (heading) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(heading, MARGIN, cursorY);
    cursorY += 24;
  }

  doc.setFontSize(BODY_FONT_SIZE);
  doc.setFont("helvetica", "normal");
  for (const paragraph of splitParagraphs(
    renderTemplate(data.template.body, values)
  )) {
    const lines = doc.splitTextToSize(paragraph, contentWidth) as string[];
    for (const line of lines) {
      cursorY = ensureSpace(doc, cursorY, LINE_HEIGHT);
      doc.text(line, MARGIN, cursorY);
      cursorY += LINE_HEIGHT;
    }
    cursorY += PARAGRAPH_GAP;
  }

  // Balance summary — always printed, so the numbers are on the page even if
  // the template never used a currency placeholder.
  cursorY = ensureSpace(doc, cursorY, 96);
  const balanceRows = [
    ["Season Fee", formatCurrency(recipient.feeAmount)],
    ["Total Paid", formatCurrency(recipient.totalPaid)],
    ["Balance Due", formatCurrency(recipient.balanceDue)],
  ];
  autoTable(doc, {
    startY: cursorY,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 110, halign: "right" },
    },
    tableWidth: 250,
    margin: { left: MARGIN, right: MARGIN },
    body: balanceRows,
    didParseCell: (hook) => {
      // Bold the last row (Balance Due), whichever row that ends up being.
      if (hook.row.index === balanceRows.length - 1) {
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });
  cursorY = getFinalY(doc) + 28;

  cursorY = ensureSpace(doc, cursorY, 72);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Payments Received", MARGIN, cursorY);
  cursorY += 14;

  if (recipient.payments.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    cursorY += 8;
    doc.text("No payments received to date.", MARGIN, cursorY);
    cursorY += 28;
  } else {
    autoTable(doc, {
      startY: cursorY,
      head: [["Date", "Amount", "Method"]],
      body: recipient.payments.map((payment) => [
        formatDate(payment.payment_date),
        formatCurrency(payment.amount),
        payment.payment_method ?? "",
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: HEADER_BG, textColor: 20, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    cursorY = getFinalY(doc) + 28;
  }

  const closing = data.template.closing
    ? renderTemplate(data.template.closing, values).trim()
    : "";
  const signatureLines = buildSignatureLines(data.director);
  const signatureHeight =
    (closing ? LINE_HEIGHT + 24 : 0) + signatureLines.length * LINE_HEIGHT;

  cursorY = ensureSpace(doc, cursorY, signatureHeight);
  doc.setFontSize(BODY_FONT_SIZE);
  doc.setFont("helvetica", "normal");

  if (closing) {
    doc.text(closing, MARGIN, cursorY);
    // Blank space for a handwritten signature.
    cursorY += LINE_HEIGHT + 24;
  }
  for (const line of signatureLines) {
    doc.text(line, MARGIN, cursorY);
    cursorY += LINE_HEIGHT;
  }
}

/**
 * Builds the batch document. Exported separately from `generateLettersPdf` so
 * tests can assert structure (page counts) without parsing binary output.
 *
 * Deliberately carries NO page numbers, unlike the season report: "Page 3 of
 * 40" on a letter handed to a student discloses the size of the list.
 */
export function buildLettersDocument(data: LetterBatchData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter",
  });
  const contentWidth = doc.internal.pageSize.getWidth() - MARGIN * 2;

  data.recipients.forEach((recipient, index) => {
    // Every recipient starts on a fresh page, so no page shows two families.
    if (index > 0) doc.addPage();
    renderLetter(doc, data, recipient, contentWidth);
  });

  return doc;
}

export function generateLettersPdf(data: LetterBatchData): Buffer {
  return Buffer.from(buildLettersDocument(data).output("arraybuffer"));
}
