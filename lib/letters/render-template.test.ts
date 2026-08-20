import { describe, it, expect } from "vitest";

import { buildTokenValues, renderTemplate } from "./render-template";

import type { LetterBatchData, LetterRecipient } from "./types";

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
    payments: [],
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
    template: { heading: null, body: "", closing: null },
    recipients: [],
    ...overrides,
  };
}

describe("buildTokenValues", () => {
  it("formats currency tokens", () => {
    const values = buildTokenValues(makeBatch(), makeRecipient());
    expect(values.fee_amount).toBe("$450.00");
    expect(values.total_paid).toBe("$200.00");
    expect(values.balance_due).toBe("$250.00");
  });

  it("formats date tokens as MM/DD/YYYY", () => {
    const values = buildTokenValues(makeBatch(), makeRecipient());
    expect(values.season_start_date).toBe("08/01/2026");
    expect(values.season_end_date).toBe("12/15/2026");
    expect(values.today).toBe("08/20/2026");
  });

  it("builds the student's full name", () => {
    const values = buildTokenValues(makeBatch(), makeRecipient());
    expect(values.student_full_name).toBe("Alex Rivera");
  });

  it("uses the guardian name when present", () => {
    const values = buildTokenValues(makeBatch(), makeRecipient());
    expect(values.guardian_name).toBe("Maria Rivera");
  });

  it("falls back to the student's full name when guardian is null", () => {
    const values = buildTokenValues(
      makeBatch(),
      makeRecipient({ guardianName: null })
    );
    expect(values.guardian_name).toBe("Alex Rivera");
  });

  it("falls back to the student's full name when guardian is whitespace", () => {
    const values = buildTokenValues(
      makeBatch(),
      makeRecipient({ guardianName: "   " })
    );
    expect(values.guardian_name).toBe("Alex Rivera");
  });

  it("coerces null director fields to empty strings", () => {
    const batch = makeBatch({
      director: { name: null, title: null, email: null, phone: null },
    });
    const values = buildTokenValues(batch, makeRecipient());
    expect(values.director_name).toBe("");
    expect(values.director_title).toBe("");
    expect(values.director_email).toBe("");
    expect(values.director_phone).toBe("");
  });
});

describe("renderTemplate", () => {
  const values = buildTokenValues(makeBatch(), makeRecipient());

  it("substitutes a single token", () => {
    expect(renderTemplate("You owe {{balance_due}}.", values)).toBe(
      "You owe $250.00."
    );
  });

  it("substitutes every occurrence of a repeated token", () => {
    expect(renderTemplate("{{student_first_name}}/{{student_first_name}}", values)).toBe(
      "Alex/Alex"
    );
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("Hi {{ guardian_name }},", values)).toBe(
      "Hi Maria Rivera,"
    );
  });

  it("renders unknown tokens as empty strings", () => {
    expect(renderTemplate("A{{not_a_token}}B", values)).toBe("AB");
  });

  it("leaves text with no tokens untouched", () => {
    expect(renderTemplate("Nothing to replace.", values)).toBe(
      "Nothing to replace."
    );
  });

  it("preserves paragraph breaks", () => {
    expect(renderTemplate("One\n\nTwo", values)).toBe("One\n\nTwo");
  });

  it("does not re-expand a token that appears inside a substituted value", () => {
    const sneaky = buildTokenValues(
      makeBatch(),
      makeRecipient({ studentFirstName: "{{balance_due}}" })
    );
    expect(renderTemplate("{{student_first_name}}", sneaky)).toBe(
      "{{balance_due}}"
    );
  });

  it("treats $& in a substituted value as a literal, not a regex reference", () => {
    const sneaky = buildTokenValues(
      makeBatch(),
      makeRecipient({ studentLastName: "$&" })
    );
    expect(renderTemplate("{{student_last_name}}", sneaky)).toBe("$&");
  });
});
