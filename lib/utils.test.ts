import { describe, it, expect } from "vitest";

import { cn, formatCurrency, formatDate, formatDateTime } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles undefined and null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });

  it("returns empty string for no input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats positive amount as USD", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative amount", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("500.00");
    expect(result).toContain("$");
  });

  it("rounds to two decimal places", () => {
    expect(formatCurrency(10.999)).toBe("$11.00");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });

  it("formats small decimal amounts", () => {
    expect(formatCurrency(0.01)).toBe("$0.01");
  });
});

describe("formatDate", () => {
  it("formats YYYY-MM-DD to MM/DD/YYYY", () => {
    const result = formatDate("2025-01-15");
    expect(result).toBe("01/15/2025");
  });

  it("formats date at year boundary", () => {
    const result = formatDate("2024-12-31");
    expect(result).toBe("12/31/2024");
  });

  it("handles leap year date", () => {
    const result = formatDate("2024-02-29");
    expect(result).toBe("02/29/2024");
  });

  it("formats first day of year", () => {
    const result = formatDate("2025-01-01");
    expect(result).toBe("01/01/2025");
  });
});

describe("formatDateTime", () => {
  it("formats ISO string to date only", () => {
    const result = formatDateTime("2025-01-15T14:30:00.000Z");
    // The output depends on local timezone, but should contain the date parts
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("handles ISO string without milliseconds", () => {
    const result = formatDateTime("2025-06-15T10:00:00Z");
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
