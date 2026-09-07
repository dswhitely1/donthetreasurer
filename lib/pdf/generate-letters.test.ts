import { describe, it, expect, vi } from "vitest";

// Wraps the real jspdf-autotable implementation in a spy instead of
// replacing it: `buildLettersDocument` still renders (so page-count
// assertions elsewhere in this file are unaffected), but the regression
// test below can inspect the options each call was made with — the only
// way to pin down that the season-shaped detail tables keep their distinct
// styling (narrow emphasized box vs. headered list) across future changes.
vi.mock("jspdf-autotable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf-autotable")>();
  return { ...actual, default: vi.fn(actual.default) };
});

import autoTable from "jspdf-autotable";

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
    id: "880e8400-e29b-41d4-a716-446655440000",
    tokenValues: {
      guardian_name: "Maria Rivera",
      student_full_name: "Alex Rivera",
      season_name: "Fall 2026",
      balance_due: "$250.00",
    },
    detailTables: [
      {
        variant: "summary",
        rows: [
          ["Season Fee", "$450.00"],
          ["Total Paid", "$200.00"],
          ["Balance Due", "$250.00"],
        ],
      },
      {
        title: "Payments Received",
        head: ["Date", "Amount", "Method"],
        emptyMessage: "No payments received to date.",
        rows: [["09/01/2026", "$200.00", "Check #1043"]],
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
        makeRecipient({ id: "a" }),
        makeRecipient({ id: "b" }),
        makeRecipient({ id: "c" }),
      ],
    });
    expect(buildLettersDocument(batch).getNumberOfPages()).toBe(3);
  });

  it("produces a single page for a single recipient", () => {
    expect(buildLettersDocument(makeBatch()).getNumberOfPages()).toBe(1);
  });

  it("handles a recipient with no payments", () => {
    const batch = makeBatch({
      recipients: [
        makeRecipient({
          detailTables: [
            {
              variant: "summary",
              rows: [
                ["Season Fee", "$450.00"],
                ["Total Paid", "$0.00"],
                ["Balance Due", "$450.00"],
              ],
            },
            {
              title: "Payments Received",
              head: ["Date", "Amount", "Method"],
              emptyMessage: "No payments received to date.",
              rows: [],
            },
          ],
        }),
      ],
    });
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
      recipients: [makeRecipient({ id: "a" }), makeRecipient({ id: "b" })],
    });
    const single = buildLettersDocument({
      ...batch,
      recipients: [makeRecipient({ id: "a" })],
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

describe("season-shaped detail tables", () => {
  it("renders the balance summary as a narrow emphasized box and the payment history with a header row", () => {
    vi.mocked(autoTable).mockClear();

    buildLettersDocument(makeBatch());

    const calls = vi.mocked(autoTable).mock.calls.map(([, options]) => options);
    expect(calls).toHaveLength(2);

    const [summaryOptions, listOptions] = calls;

    // The balance box: no header row, a narrow fixed width, and the
    // per-cell hook that bolds the final ("Balance Due") row.
    expect(summaryOptions.head).toBeUndefined();
    expect(summaryOptions.tableWidth).toBe(250);
    expect(summaryOptions.didParseCell).toBeInstanceOf(Function);

    // The payment history: a real header row, and none of the narrow-box
    // treatment.
    expect(listOptions.head).toEqual([["Date", "Amount", "Method"]]);
    expect(listOptions.tableWidth).toBeUndefined();
    expect(listOptions.didParseCell).toBeUndefined();
  });
});
