import { describe, it, expect } from "vitest";

import {
  getFiscalYearRange,
  getPreviousFiscalYearRange,
  getFiscalQuarterRange,
  getPreviousFiscalQuarterRange,
  getFiscalYTDRange,
  getCalendarYearRange,
  getFiscalYearLabel,
  getPresetDateRange,
} from "./fiscal-year";

function ref(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

describe("getFiscalYearLabel", () => {
  it("returns single year when fiscal year starts in January", () => {
    expect(getFiscalYearLabel(1, "2026-01-01")).toBe("FY 2026");
  });

  it("returns spanning years for non-January start", () => {
    expect(getFiscalYearLabel(7, "2025-07-01")).toBe("FY 2025-2026");
  });

  it("returns spanning years for October start", () => {
    expect(getFiscalYearLabel(10, "2025-10-01")).toBe("FY 2025-2026");
  });
});

describe("getFiscalYearRange", () => {
  it("handles January start (same as calendar year)", () => {
    const result = getFiscalYearRange(1, ref("2026-06-15"));
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-12-31");
    expect(result.label).toContain("FY 2026");
  });

  it("handles July start (common nonprofit)", () => {
    const result = getFiscalYearRange(7, ref("2025-11-15"));
    expect(result.start).toBe("2025-07-01");
    expect(result.end).toBe("2026-06-30");
    expect(result.label).toContain("FY 2025-2026");
  });

  it("handles October start (US federal)", () => {
    const result = getFiscalYearRange(10, ref("2026-02-01"));
    expect(result.start).toBe("2025-10-01");
    expect(result.end).toBe("2026-09-30");
    expect(result.label).toContain("FY 2025-2026");
  });

  it("handles April start", () => {
    const result = getFiscalYearRange(4, ref("2026-04-01"));
    expect(result.start).toBe("2026-04-01");
    expect(result.end).toBe("2027-03-31");
    expect(result.label).toContain("FY 2026-2027");
  });

  it("handles reference date on first day of fiscal year", () => {
    const result = getFiscalYearRange(7, ref("2025-07-01"));
    expect(result.start).toBe("2025-07-01");
    expect(result.end).toBe("2026-06-30");
  });

  it("handles reference date on last day of fiscal year", () => {
    const result = getFiscalYearRange(7, ref("2026-06-30"));
    expect(result.start).toBe("2025-07-01");
    expect(result.end).toBe("2026-06-30");
  });

  it("handles February start with leap year ending", () => {
    // FY starting Feb 2023 ends Jan 2024 (2024 is leap year, but Feb not in range)
    const result = getFiscalYearRange(2, ref("2023-06-15"));
    expect(result.start).toBe("2023-02-01");
    expect(result.end).toBe("2024-01-31");
  });

  it("handles all 12 start months", () => {
    for (let month = 1; month <= 12; month++) {
      const result = getFiscalYearRange(month, ref("2026-06-15"));
      // Should always return a valid date range
      expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.start < result.end).toBe(true);
    }
  });
});

describe("getPreviousFiscalYearRange", () => {
  it("returns previous fiscal year for January start", () => {
    const result = getPreviousFiscalYearRange(1, ref("2026-06-15"));
    expect(result.start).toBe("2025-01-01");
    expect(result.end).toBe("2025-12-31");
    expect(result.label).toContain("FY 2025");
  });

  it("returns previous fiscal year for July start", () => {
    const result = getPreviousFiscalYearRange(7, ref("2025-11-15"));
    expect(result.start).toBe("2024-07-01");
    expect(result.end).toBe("2025-06-30");
    expect(result.label).toContain("FY 2024-2025");
  });

  it("returns previous fiscal year for October start", () => {
    const result = getPreviousFiscalYearRange(10, ref("2026-02-01"));
    expect(result.start).toBe("2024-10-01");
    expect(result.end).toBe("2025-09-30");
    expect(result.label).toContain("FY 2024-2025");
  });
});

describe("getFiscalQuarterRange", () => {
  it("returns Q1 for January start in January", () => {
    const result = getFiscalQuarterRange(1, ref("2026-02-15"));
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-03-31");
    expect(result.label).toContain("Q1");
  });

  it("returns Q2 for January start in April", () => {
    const result = getFiscalQuarterRange(1, ref("2026-05-15"));
    expect(result.start).toBe("2026-04-01");
    expect(result.end).toBe("2026-06-30");
    expect(result.label).toContain("Q2");
  });

  it("returns Q3 for January start in August", () => {
    const result = getFiscalQuarterRange(1, ref("2026-08-15"));
    expect(result.start).toBe("2026-07-01");
    expect(result.end).toBe("2026-09-30");
    expect(result.label).toContain("Q3");
  });

  it("returns Q4 for January start in November", () => {
    const result = getFiscalQuarterRange(1, ref("2026-11-15"));
    expect(result.start).toBe("2026-10-01");
    expect(result.end).toBe("2026-12-31");
    expect(result.label).toContain("Q4");
  });

  it("returns Q1 for July start in September", () => {
    const result = getFiscalQuarterRange(7, ref("2025-09-15"));
    expect(result.start).toBe("2025-07-01");
    expect(result.end).toBe("2025-09-30");
    expect(result.label).toContain("Q1");
  });

  it("returns Q2 for July start in December", () => {
    const result = getFiscalQuarterRange(7, ref("2025-12-15"));
    expect(result.start).toBe("2025-10-01");
    expect(result.end).toBe("2025-12-31");
    expect(result.label).toContain("Q2");
  });

  it("returns Q3 for July start in March", () => {
    const result = getFiscalQuarterRange(7, ref("2026-03-15"));
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-03-31");
    expect(result.label).toContain("Q3");
  });

  it("returns Q4 for July start in May", () => {
    const result = getFiscalQuarterRange(7, ref("2026-05-15"));
    expect(result.start).toBe("2026-04-01");
    expect(result.end).toBe("2026-06-30");
    expect(result.label).toContain("Q4");
  });

  it("handles quarter boundary (first day of quarter)", () => {
    const result = getFiscalQuarterRange(1, ref("2026-04-01"));
    expect(result.start).toBe("2026-04-01");
    expect(result.end).toBe("2026-06-30");
    expect(result.label).toContain("Q2");
  });

  it("handles quarter boundary (last day of quarter)", () => {
    const result = getFiscalQuarterRange(1, ref("2026-03-31"));
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-03-31");
    expect(result.label).toContain("Q1");
  });
});

describe("getPreviousFiscalQuarterRange", () => {
  it("returns Q4 of prev FY when in Q1 of current FY", () => {
    const result = getPreviousFiscalQuarterRange(1, ref("2026-02-15"));
    expect(result.start).toBe("2025-10-01");
    expect(result.end).toBe("2025-12-31");
    expect(result.label).toContain("Q4");
  });

  it("returns Q1 when in Q2", () => {
    const result = getPreviousFiscalQuarterRange(1, ref("2026-05-15"));
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-03-31");
    expect(result.label).toContain("Q1");
  });

  it("returns previous quarter for July FY start", () => {
    const result = getPreviousFiscalQuarterRange(7, ref("2025-12-15"));
    expect(result.start).toBe("2025-07-01");
    expect(result.end).toBe("2025-09-30");
    expect(result.label).toContain("Q1");
  });
});

describe("getFiscalYTDRange", () => {
  it("returns from fiscal year start to reference date for January start", () => {
    const result = getFiscalYTDRange(1, ref("2026-06-15"));
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-06-15");
    expect(result.label).toContain("YTD");
  });

  it("returns from fiscal year start to reference date for July start", () => {
    const result = getFiscalYTDRange(7, ref("2025-11-15"));
    expect(result.start).toBe("2025-07-01");
    expect(result.end).toBe("2025-11-15");
  });

  it("handles reference date on first day of fiscal year", () => {
    const result = getFiscalYTDRange(7, ref("2025-07-01"));
    expect(result.start).toBe("2025-07-01");
    expect(result.end).toBe("2025-07-01");
  });

  it("returns from previous year start when ref is before fiscal start month", () => {
    const result = getFiscalYTDRange(7, ref("2026-03-15"));
    expect(result.start).toBe("2025-07-01");
    expect(result.end).toBe("2026-03-15");
  });
});

describe("getCalendarYearRange", () => {
  it("returns full calendar year for reference date", () => {
    const result = getCalendarYearRange(ref("2026-06-15"));
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-12-31");
    expect(result.label).toContain("Calendar Year 2026");
  });

  it("returns correct year for January 1st", () => {
    const result = getCalendarYearRange(ref("2026-01-01"));
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-12-31");
  });

  it("returns correct year for December 31st", () => {
    const result = getCalendarYearRange(ref("2025-12-31"));
    expect(result.start).toBe("2025-01-01");
    expect(result.end).toBe("2025-12-31");
  });
});

describe("getPresetDateRange", () => {
  it("dispatches current_fy correctly", () => {
    const result = getPresetDateRange("current_fy", 7, ref("2025-11-15"));
    expect(result).not.toBeNull();
    expect(result!.start).toBe("2025-07-01");
    expect(result!.end).toBe("2026-06-30");
  });

  it("dispatches previous_fy correctly", () => {
    const result = getPresetDateRange("previous_fy", 7, ref("2025-11-15"));
    expect(result).not.toBeNull();
    expect(result!.start).toBe("2024-07-01");
    expect(result!.end).toBe("2025-06-30");
  });

  it("dispatches current_quarter correctly", () => {
    const result = getPresetDateRange("current_quarter", 1, ref("2026-02-15"));
    expect(result).not.toBeNull();
    expect(result!.start).toBe("2026-01-01");
    expect(result!.end).toBe("2026-03-31");
  });

  it("dispatches previous_quarter correctly", () => {
    const result = getPresetDateRange("previous_quarter", 1, ref("2026-05-15"));
    expect(result).not.toBeNull();
    expect(result!.start).toBe("2026-01-01");
    expect(result!.end).toBe("2026-03-31");
  });

  it("dispatches fiscal_ytd correctly", () => {
    const result = getPresetDateRange("fiscal_ytd", 7, ref("2025-11-15"));
    expect(result).not.toBeNull();
    expect(result!.start).toBe("2025-07-01");
    expect(result!.end).toBe("2025-11-15");
  });

  it("dispatches calendar_year correctly", () => {
    const result = getPresetDateRange("calendar_year", 7, ref("2026-06-15"));
    expect(result).not.toBeNull();
    expect(result!.start).toBe("2026-01-01");
    expect(result!.end).toBe("2026-12-31");
  });

  it("returns null for custom preset", () => {
    const result = getPresetDateRange("custom", 1, ref("2026-06-15"));
    expect(result).toBeNull();
  });

  it("returns null for unknown preset", () => {
    const result = getPresetDateRange("unknown", 1, ref("2026-06-15"));
    expect(result).toBeNull();
  });
});
