import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { renderTemplate } from "@/lib/letters/render-template";
import { formatDate } from "@/lib/utils";

import type {
  LetterBatchData,
  LetterDetailTable,
  LetterDirector,
  LetterRecipient,
} from "@/lib/letters/types";

const MARGIN = 56;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT = 15;
const PARAGRAPH_GAP = 9;

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

/** Renders one `LetterDetailTable` — a title, then the table or, if it has
 * no rows, an `emptyMessage` printed in the table's place. */
function renderDetailTable(
  doc: jsPDF,
  table: LetterDetailTable,
  cursorY: number
): number {
  let y = ensureSpace(doc, cursorY, table.title ? 72 : 96);

  if (table.title) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(table.title, MARGIN, y);
    y += 14;
  }

  if (table.rows.length === 0) {
    if (!table.emptyMessage) return y;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    y += 8;
    doc.text(table.emptyMessage, MARGIN, y);
    return y + 28;
  }

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6 },
    margin: { left: MARGIN, right: MARGIN },
    body: table.rows,
  });
  return getFinalY(doc) + 28;
}

function renderLetter(
  doc: jsPDF,
  data: LetterBatchData,
  recipient: LetterRecipient,
  contentWidth: number
): void {
  const values = recipient.tokenValues;
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

  for (const table of recipient.detailTables ?? []) {
    cursorY = renderDetailTable(doc, table, cursorY);
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
