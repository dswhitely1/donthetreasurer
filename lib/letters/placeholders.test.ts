import { describe, it, expect } from "vitest";

import {
  LETTER_PLACEHOLDERS,
  LETTER_TEMPLATE_TYPES,
  createPlaceholderPattern,
  findUnknownPlaceholders,
  getPlaceholders,
} from "./placeholders";

describe("LETTER_PLACEHOLDERS", () => {
  it("has no duplicate tokens", () => {
    const tokens = LETTER_PLACEHOLDERS.map((p) => p.token);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("gives every placeholder a label and description", () => {
    for (const placeholder of LETTER_PLACEHOLDERS) {
      expect(placeholder.label.length).toBeGreaterThan(0);
      expect(placeholder.description.length).toBeGreaterThan(0);
    }
  });
});

describe("createPlaceholderPattern", () => {
  it("returns a fresh regex each call so lastIndex is never shared", () => {
    const first = createPlaceholderPattern();
    const second = createPlaceholderPattern();
    expect(first).not.toBe(second);
    expect(second.lastIndex).toBe(0);
  });

  it("matches tokens with and without inner whitespace", () => {
    const text = "{{balance_due}} and {{ balance_due }}";
    const matches = [...text.matchAll(createPlaceholderPattern())];
    expect(matches).toHaveLength(2);
    expect(matches[0][1]).toBe("balance_due");
    expect(matches[1][1]).toBe("balance_due");
  });
});

describe("findUnknownPlaceholders", () => {
  it("returns an empty array when every token is known", () => {
    expect(
      findUnknownPlaceholders("Dear {{guardian_name}}, you owe {{balance_due}}.")
    ).toEqual([]);
  });

  it("reports a misspelled token", () => {
    expect(findUnknownPlaceholders("You owe {{ballance_due}}.")).toEqual([
      "ballance_due",
    ]);
  });

  it("reports each unknown token only once", () => {
    expect(
      findUnknownPlaceholders("{{nope}} then {{nope}} then {{other}}")
    ).toEqual(["nope", "other"]);
  });

  it("ignores text with no placeholders", () => {
    expect(findUnknownPlaceholders("Plain text, no tokens.")).toEqual([]);
  });
});

describe("LETTER_PLACEHOLDERS_BY_TYPE", () => {
  it("offers season tokens to season templates", () => {
    const tokens = getPlaceholders("season_balance").map((p) => p.token);
    expect(tokens).toContain("student_first_name");
    expect(tokens).toContain("balance_due");
  });

  it("offers sponsor tokens to sponsor templates", () => {
    const tokens = getPlaceholders("sponsor_acknowledgment").map((p) => p.token);
    expect(tokens).toContain("sponsor_name");
    expect(tokens).toContain("sponsorship_amount");
    expect(tokens).toContain("term_label");
  });

  it("keeps student tokens out of sponsor templates", () => {
    const tokens = getPlaceholders("sponsor_acknowledgment").map((p) => p.token);
    expect(tokens).not.toContain("student_first_name");
  });

  it("shares organization and director tokens across both types", () => {
    for (const type of LETTER_TEMPLATE_TYPES) {
      const tokens = getPlaceholders(type).map((p) => p.token);
      expect(tokens).toContain("organization_name");
      expect(tokens).toContain("organization_ein");
      expect(tokens).toContain("director_name");
      expect(tokens).toContain("today");
    }
  });
});

describe("findUnknownPlaceholders with a template type", () => {
  it("flags a student token used in a sponsor letter", () => {
    const unknown = findUnknownPlaceholders(
      "Thank you {{student_first_name}}",
      "sponsor_acknowledgment"
    );
    expect(unknown).toEqual(["student_first_name"]);
  });

  it("flags a sponsor token used in a season letter", () => {
    const unknown = findUnknownPlaceholders(
      "Thank you {{sponsor_name}}",
      "season_balance"
    );
    expect(unknown).toEqual(["sponsor_name"]);
  });

  it("accepts shared tokens in either type", () => {
    for (const type of LETTER_TEMPLATE_TYPES) {
      expect(findUnknownPlaceholders("{{organization_name}} {{today}}", type)).toEqual([]);
    }
  });

  it("defaults to the season vocabulary when no type is given", () => {
    expect(findUnknownPlaceholders("{{balance_due}}")).toEqual([]);
  });
});
