import { format, endOfMonth, subMonths, addMonths, subYears } from "date-fns";

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export const PRESET_OPTIONS = [
  { value: "current_fy", label: "Current Fiscal Year" },
  { value: "previous_fy", label: "Previous Fiscal Year" },
  { value: "current_quarter", label: "Current Quarter" },
  { value: "previous_quarter", label: "Previous Quarter" },
  { value: "fiscal_ytd", label: "Fiscal Year to Date" },
  { value: "calendar_year", label: "Calendar Year" },
  { value: "custom", label: "Custom Range" },
] as const;

export type PresetKey = (typeof PRESET_OPTIONS)[number]["value"];

function fmt(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatLabelDate(date: Date): string {
  return format(date, "MMM d, yyyy");
}

/**
 * Returns the fiscal year label. If the fiscal year starts in January,
 * it's a single year (e.g., "FY 2026"). Otherwise it spans two years
 * (e.g., "FY 2025-2026").
 */
export function getFiscalYearLabel(
  fiscalStartMonth: number,
  startDate: string
): string {
  const year = parseInt(startDate.slice(0, 4), 10);
  if (fiscalStartMonth === 1) {
    return `FY ${year}`;
  }
  return `FY ${year}-${year + 1}`;
}

/**
 * Get the start date of the fiscal year containing the reference date.
 */
function getFiscalYearStart(
  fiscalStartMonth: number,
  referenceDate: Date
): Date {
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1; // 1-based

  let fyStartYear: number;
  if (refMonth >= fiscalStartMonth) {
    fyStartYear = refYear;
  } else {
    fyStartYear = refYear - 1;
  }

  return new Date(fyStartYear, fiscalStartMonth - 1, 1);
}

export function getFiscalYearRange(
  fiscalStartMonth: number,
  referenceDate: Date = new Date()
): DateRange {
  const start = getFiscalYearStart(fiscalStartMonth, referenceDate);
  const end = endOfMonth(subMonths(addMonths(start, 12), 1));

  const startStr = fmt(start);
  const label = getFiscalYearLabel(fiscalStartMonth, startStr);

  return {
    start: startStr,
    end: fmt(end),
    label: `${label} (${formatLabelDate(start)} – ${formatLabelDate(end)})`,
  };
}

export function getPreviousFiscalYearRange(
  fiscalStartMonth: number,
  referenceDate: Date = new Date()
): DateRange {
  const currentStart = getFiscalYearStart(fiscalStartMonth, referenceDate);
  const previousStart = subYears(currentStart, 1);
  const previousEnd = endOfMonth(subMonths(currentStart, 1));

  const startStr = fmt(previousStart);
  const label = getFiscalYearLabel(fiscalStartMonth, startStr);

  return {
    start: startStr,
    end: fmt(previousEnd),
    label: `${label} (${formatLabelDate(previousStart)} – ${formatLabelDate(previousEnd)})`,
  };
}

/**
 * Get the fiscal quarter containing the reference date.
 * Quarters are 3-month periods starting from the fiscal year start month.
 */
export function getFiscalQuarterRange(
  fiscalStartMonth: number,
  referenceDate: Date = new Date()
): DateRange {
  const fyStart = getFiscalYearStart(fiscalStartMonth, referenceDate);
  const refTime = referenceDate.getTime();

  // Find which quarter we're in (Q1-Q4)
  let quarterStart = fyStart;
  let quarterNum = 1;
  for (let q = 0; q < 4; q++) {
    const nextQuarter = addMonths(fyStart, (q + 1) * 3);
    if (refTime < nextQuarter.getTime()) {
      quarterStart = addMonths(fyStart, q * 3);
      quarterNum = q + 1;
      break;
    }
  }

  const quarterEnd = endOfMonth(addMonths(quarterStart, 2));

  return {
    start: fmt(quarterStart),
    end: fmt(quarterEnd),
    label: `Q${quarterNum} (${formatLabelDate(quarterStart)} – ${formatLabelDate(quarterEnd)})`,
  };
}

export function getPreviousFiscalQuarterRange(
  fiscalStartMonth: number,
  referenceDate: Date = new Date()
): DateRange {
  const current = getFiscalQuarterRange(fiscalStartMonth, referenceDate);
  const currentStart = new Date(current.start + "T00:00:00");
  const previousStart = subMonths(currentStart, 3);
  const previousEnd = endOfMonth(addMonths(previousStart, 2));

  // Determine quarter number by checking which quarter previousStart falls in
  const fyStart = getFiscalYearStart(fiscalStartMonth, previousStart);
  const monthsFromFYStart =
    (previousStart.getFullYear() - fyStart.getFullYear()) * 12 +
    (previousStart.getMonth() - fyStart.getMonth());
  const quarterNum = Math.floor(monthsFromFYStart / 3) + 1;

  return {
    start: fmt(previousStart),
    end: fmt(previousEnd),
    label: `Q${quarterNum} (${formatLabelDate(previousStart)} – ${formatLabelDate(previousEnd)})`,
  };
}

export function getFiscalYTDRange(
  fiscalStartMonth: number,
  referenceDate: Date = new Date()
): DateRange {
  const start = getFiscalYearStart(fiscalStartMonth, referenceDate);

  return {
    start: fmt(start),
    end: fmt(referenceDate),
    label: `YTD (${formatLabelDate(start)} – ${formatLabelDate(referenceDate)})`,
  };
}

export function getCalendarYearRange(
  referenceDate: Date = new Date()
): DateRange {
  const year = referenceDate.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  return {
    start: fmt(start),
    end: fmt(end),
    label: `Calendar Year ${year} (${formatLabelDate(start)} – ${formatLabelDate(end)})`,
  };
}

export function getPresetDateRange(
  presetKey: string,
  fiscalStartMonth: number,
  referenceDate: Date = new Date()
): DateRange | null {
  switch (presetKey) {
    case "current_fy":
      return getFiscalYearRange(fiscalStartMonth, referenceDate);
    case "previous_fy":
      return getPreviousFiscalYearRange(fiscalStartMonth, referenceDate);
    case "current_quarter":
      return getFiscalQuarterRange(fiscalStartMonth, referenceDate);
    case "previous_quarter":
      return getPreviousFiscalQuarterRange(fiscalStartMonth, referenceDate);
    case "fiscal_ytd":
      return getFiscalYTDRange(fiscalStartMonth, referenceDate);
    case "calendar_year":
      return getCalendarYearRange(referenceDate);
    default:
      return null;
  }
}
