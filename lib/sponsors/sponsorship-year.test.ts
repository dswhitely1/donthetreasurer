import { describe, it, expect } from "vitest";

import {
  formatTermLabel,
  getNextSponsorshipTerm,
  getSponsorshipTerm,
} from "./sponsorship-year";

describe("getSponsorshipTerm", () => {
  it("returns July through June for a July fiscal start", () => {
    const term = getSponsorshipTerm(7, new Date(2026, 9, 14));
    expect(term.startDate).toBe("2026-07-01");
    expect(term.endDate).toBe("2027-06-30");
  });

  it("returns the prior term for a date before the fiscal start month", () => {
    const term = getSponsorshipTerm(7, new Date(2026, 2, 14));
    expect(term.startDate).toBe("2025-07-01");
    expect(term.endDate).toBe("2026-06-30");
  });

  it("returns a calendar year for a January fiscal start", () => {
    const term = getSponsorshipTerm(1, new Date(2026, 9, 14));
    expect(term.startDate).toBe("2026-01-01");
    expect(term.endDate).toBe("2026-12-31");
  });

  it("labels a term that spans two calendar years", () => {
    const term = getSponsorshipTerm(7, new Date(2026, 9, 14));
    expect(term.label).toBe("2026–27");
  });
});

describe("formatTermLabel", () => {
  it("uses a single year when the term does not span a year boundary", () => {
    expect(formatTermLabel("2026-01-01", "2026-12-31")).toBe("2026");
  });

  it("uses an en dash and a two-digit end year across a boundary", () => {
    expect(formatTermLabel("2026-07-01", "2027-06-30")).toBe("2026–27");
  });
});

describe("getNextSponsorshipTerm", () => {
  it("advances both dates by one year for a renewal", () => {
    const next = getNextSponsorshipTerm("2026-07-01", "2027-06-30");
    expect(next.startDate).toBe("2027-07-01");
    expect(next.endDate).toBe("2028-06-30");
    expect(next.label).toBe("2027–28");
  });

  it("preserves a non-standard term length", () => {
    const next = getNextSponsorshipTerm("2026-09-15", "2027-03-14");
    expect(next.startDate).toBe("2027-09-15");
    expect(next.endDate).toBe("2028-03-14");
  });
});
