import { describe, it, expect } from "vitest";

import {
  computeNextOccurrence,
  computeInitialOccurrence,
  computeResumeOccurrence,
} from "./recurrence";

describe("computeNextOccurrence", () => {
  it("computes weekly next occurrence", () => {
    const result = computeNextOccurrence("2026-01-01", "weekly", "2026-01-01");
    expect(result).toBe("2026-01-08");
  });

  it("computes bi-weekly next occurrence", () => {
    const result = computeNextOccurrence(
      "2026-01-01",
      "bi-weekly",
      "2026-01-01"
    );
    expect(result).toBe("2026-01-15");
  });

  it("computes monthly next occurrence", () => {
    const result = computeNextOccurrence("2026-01-15", "monthly", "2026-01-15");
    expect(result).toBe("2026-02-15");
  });

  it("handles month-end edge case: Jan 31 -> Feb 28", () => {
    const result = computeNextOccurrence("2026-01-31", "monthly", "2026-01-31");
    expect(result).toBe("2026-02-28");
  });

  it("computes quarterly next occurrence", () => {
    const result = computeNextOccurrence(
      "2026-01-01",
      "quarterly",
      "2026-01-01"
    );
    expect(result).toBe("2026-04-01");
  });

  it("computes annually next occurrence", () => {
    const result = computeNextOccurrence(
      "2026-01-01",
      "annually",
      "2026-01-01"
    );
    expect(result).toBe("2027-01-01");
  });

  it("skips multiple intervals when afterDate is far in the future", () => {
    const result = computeNextOccurrence("2026-01-01", "monthly", "2026-05-15");
    expect(result).toBe("2026-06-01");
  });

  it("returns null when next occurrence exceeds end date", () => {
    const result = computeNextOccurrence(
      "2026-01-01",
      "monthly",
      "2026-01-01",
      "2026-01-20"
    );
    expect(result).toBeNull();
  });

  it("returns date when it falls exactly on end date", () => {
    const result = computeNextOccurrence(
      "2026-01-01",
      "monthly",
      "2026-01-01",
      "2026-02-01"
    );
    expect(result).toBe("2026-02-01");
  });

  it("returns null when end date is null but effectively no constraint", () => {
    const result = computeNextOccurrence(
      "2026-01-01",
      "weekly",
      "2026-01-01",
      null
    );
    expect(result).toBe("2026-01-08");
  });
});

describe("computeInitialOccurrence", () => {
  it("returns startDate when no endDate", () => {
    expect(computeInitialOccurrence("2026-03-01")).toBe("2026-03-01");
  });

  it("returns startDate when endDate is after startDate", () => {
    expect(computeInitialOccurrence("2026-03-01", "2026-12-31")).toBe(
      "2026-03-01"
    );
  });

  it("returns startDate when endDate equals startDate", () => {
    expect(computeInitialOccurrence("2026-03-01", "2026-03-01")).toBe(
      "2026-03-01"
    );
  });

  it("returns null when endDate is before startDate", () => {
    expect(computeInitialOccurrence("2026-03-01", "2026-02-01")).toBeNull();
  });

  it("handles null endDate", () => {
    expect(computeInitialOccurrence("2026-03-01", null)).toBe("2026-03-01");
  });
});

describe("computeResumeOccurrence", () => {
  it("returns startDate when it is in the future", () => {
    const result = computeResumeOccurrence(
      "2026-06-01",
      "monthly",
      "2026-01-15"
    );
    expect(result).toBe("2026-06-01");
  });

  it("returns startDate when it equals today", () => {
    const result = computeResumeOccurrence(
      "2026-01-15",
      "monthly",
      "2026-01-15"
    );
    expect(result).toBe("2026-01-15");
  });

  it("finds next occurrence >= today when startDate is in the past", () => {
    const result = computeResumeOccurrence(
      "2026-01-01",
      "monthly",
      "2026-03-15"
    );
    expect(result).toBe("2026-04-01");
  });

  it("finds exact match when today falls on an occurrence", () => {
    const result = computeResumeOccurrence(
      "2026-01-01",
      "monthly",
      "2026-03-01"
    );
    expect(result).toBe("2026-03-01");
  });

  it("returns null when resume would exceed end date", () => {
    const result = computeResumeOccurrence(
      "2026-01-01",
      "monthly",
      "2026-06-15",
      "2026-06-01"
    );
    expect(result).toBeNull();
  });

  it("returns occurrence on end date", () => {
    const result = computeResumeOccurrence(
      "2026-01-01",
      "monthly",
      "2026-03-15",
      "2026-04-01"
    );
    expect(result).toBe("2026-04-01");
  });

  it("handles weekly resume", () => {
    const result = computeResumeOccurrence(
      "2026-01-06",
      "weekly",
      "2026-01-20"
    );
    expect(result).toBe("2026-01-20");
  });

  it("returns null when start is in future but past end date", () => {
    const result = computeResumeOccurrence(
      "2026-06-01",
      "monthly",
      "2026-01-01",
      "2026-05-01"
    );
    expect(result).toBeNull();
  });
});
