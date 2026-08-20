import { describe, it, expect } from "vitest";

import {
  buildLettersDocument,
  buildSignatureLines,
  generateLettersPdf,
  splitParagraphs,
} from "./generate-letters";

import type { LetterBatchData, LetterRecipient } from "@/lib/letters/types";

function makeRecipient(
  overrides: Partial<LetterRecipient> = {}
): LetterRecipient {
  return {
    enrollmentId: "880e8400-e29b-41d4-a716-446655440000",
    studentFirstName: "Alex",
    studentLastName: "Rivera",
    guardianName: "Maria Rivera",
    feeAmount: 450,
    totalPaid: 200,
    balanceDue: 250,
    payments: [
      {
        payment_date: "2026-09-01",
        amount: 200,
        payment_method: "Check #1043",
      },
    ],
    ...overrides,
  };
}

function makeBatch(overrides: Partial<LetterBatchData> = {}): LetterBatchData {
  return {
    organizationName: "Acme Band Boosters",
    director: {
      name: "Jane Doe",
      title: "Band Director",
      email: "jane@band.org",
      phone: "555-0100",
    },
    seasonName: "Fall 2026",
    seasonStartDate: "2026-08-01",
    seasonEndDate: "2026-12-15",
    generatedOn: "2026-08-20",
    template: {
      heading: "Outstanding Balance Notice",
      body: "Dear {{guardian_name}},\n\n{{student_full_name}} owes {{balance_due}} for {{season_name}}.",
      closing: "Sincerely,",
    },
    recipients: [makeRecipient()],
    ...overrides,
  };
}

describe("splitParagraphs", () => {
  it("splits on blank lines", () => {
    expect(splitParagraphs("One\n\nTwo")).toEqual(["One", "Two"]);
  });

  it("keeps single newlines inside a paragraph", () => {
    expect(splitParagraphs("One\nstill one")).toEqual(["One\nstill one"]);
  });

  it("drops empty paragraphs from repeated blank lines", () => {
    expect(splitParagraphs("One\n\n\n\nTwo")).toEqual(["One", "Two"]);
  });

  it("returns an empty array for whitespace-only text", () => {
    expect(splitParagraphs("   \n\n  ")).toEqual([]);
  });
});

describe("buildSignatureLines", () => {
  it("returns all four lines when every field is set", () => {
    expect(
      buildSignatureLines({
        name: "Jane Doe",
        title: "Band Director",
        email: "jane@band.org",
        phone: "555-0100",
      })
    ).toEqual(["Jane Doe", "Band Director", "jane@band.org", "555-0100"]);
  });

  it("omits null fields instead of printing blank lines", () => {
    expect(
      buildSignatureLines({
        name: "Jane Doe",
        title: "Band Director",
        email: null,
        phone: null,
      })
    ).toEqual(["Jane Doe", "Band Director"]);
  });

  it("omits whitespace-only fields", () => {
    expect(
      buildSignatureLines({
        name: "Jane Doe",
        title: "   ",
        email: null,
        phone: null,
      })
    ).toEqual(["Jane Doe"]);
  });

  it("returns an empty array when no director is recorded", () => {
    expect(
      buildSignatureLines({ name: null, title: null, email: null, phone: null })
    ).toEqual([]);
  });
});

describe("buildLettersDocument", () => {
  it("produces one page per recipient", () => {
    const batch = makeBatch({
      recipients: [
        makeRecipient({ enrollmentId: "a" }),
        makeRecipient({ enrollmentId: "b" }),
        makeRecipient({ enrollmentId: "c" }),
      ],
    });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(3);
  });

  it("produces a single page for a single recipient", () => {
    expect(buildLettersDocument(makeBatch()).getNumberOfPages()).toBe(1);
  });

  it("handles a recipient with no payments", () => {
    const batch = makeBatch({ recipients: [makeRecipient({ payments: [] })] });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(1);
  });

  it("handles a blank heading", () => {
    const batch = makeBatch({
      template: { heading: null, body: "Short body.", closing: null },
    });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(1);
  });

  it("handles a missing director without throwing", () => {
    const batch = makeBatch({
      director: { name: null, title: null, email: null, phone: null },
    });
    expect(() => buildLettersDocument(batch)).not.toThrow();
  });

  it("paginates a body too long for one page", () => {
    const batch = makeBatch({
      template: {
        heading: null,
        body: Array.from({ length: 60 }, (_, i) => `Paragraph ${i}.`).join("\n\n"),
        closing: "Sincerely,",
      },
    });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBeGreaterThan(1);
  });

  it("still starts each recipient on a fresh page after an overflow", () => {
    const longBody = Array.from({ length: 60 }, (_, i) => `Paragraph ${i}.`).join(
      "\n\n"
    );
    const batch = makeBatch({
      template: { heading: null, body: longBody, closing: "Sincerely," },
      recipients: [
        makeRecipient({ enrollmentId: "a" }),
        makeRecipient({ enrollmentId: "b" }),
      ],
    });
    const single = buildLettersDocument({
      ...batch,
      recipients: [makeRecipient({ enrollmentId: "a" })],
    }).getNumberOfPages();
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(single * 2);
  });
});

describe("generateLettersPdf", () => {
  it("returns a non-empty Buffer", () => {
    const buffer = generateLettersPdf(makeBatch());
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("starts with PDF magic bytes", () => {
    const buffer = generateLettersPdf(makeBatch());
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
