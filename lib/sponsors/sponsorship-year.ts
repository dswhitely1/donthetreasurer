import { addYears, format, parseISO } from "date-fns";

import { getFiscalYearRange } from "@/lib/fiscal-year";

export interface SponsorshipTerm {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** Display label, e.g. "2026–27" */
  label: string;
}

/**
 * A term spanning two calendar years reads "2026–27"; one inside a single
 * calendar year is just that year. Uses an en dash, matching the date ranges
 * the reports already print.
 */
export function formatTermLabel(startDate: string, endDate: string): string {
  const startYear = startDate.slice(0, 4);
  const endYear = endDate.slice(0, 4);
  if (startYear === endYear) return startYear;
  return `${startYear}–${endYear.slice(2)}`;
}

/**
 * The sponsorship term containing `referenceDate`, derived from the
 * organization's fiscal year so a July–June org gets July–June sponsorships
 * without a second configuration knob.
 */
export function getSponsorshipTerm(
  fiscalYearStartMonth: number,
  referenceDate: Date = new Date()
): SponsorshipTerm {
  const range = getFiscalYearRange(fiscalYearStartMonth, referenceDate);
  return {
    startDate: range.start,
    endDate: range.end,
    label: formatTermLabel(range.start, range.end),
  };
}

/**
 * The same term one year later, for renewals. Shifts both endpoints rather
 * than recomputing from the fiscal year, so a sponsorship sold on a
 * non-standard term renews on that same non-standard term.
 */
export function getNextSponsorshipTerm(
  startDate: string,
  endDate: string
): SponsorshipTerm {
  const nextStart = format(addYears(parseISO(startDate), 1), "yyyy-MM-dd");
  const nextEnd = format(addYears(parseISO(endDate), 1), "yyyy-MM-dd");
  return {
    startDate: nextStart,
    endDate: nextEnd,
    label: formatTermLabel(nextStart, nextEnd),
  };
}
