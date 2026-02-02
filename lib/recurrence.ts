import {
  addWeeks,
  addMonths,
  addYears,
  parseISO,
  format,
  isBefore,
  isEqual,
} from "date-fns";

export const RECURRENCE_RULES = [
  "weekly",
  "bi-weekly",
  "monthly",
  "quarterly",
  "annually",
] as const;

export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

export const RECURRENCE_RULE_LABELS: Record<RecurrenceRule, string> = {
  weekly: "Weekly",
  "bi-weekly": "Bi-Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

function addInterval(date: Date, rule: RecurrenceRule): Date {
  switch (rule) {
    case "weekly":
      return addWeeks(date, 1);
    case "bi-weekly":
      return addWeeks(date, 2);
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addMonths(date, 3);
    case "annually":
      return addYears(date, 1);
  }
}

/**
 * Walks forward from startDate by rule intervals until finding the first
 * occurrence strictly after afterDate. Returns null if past endDate.
 */
export function computeNextOccurrence(
  startDate: string,
  rule: RecurrenceRule,
  afterDate: string,
  endDate?: string | null
): string | null {
  const start = parseISO(startDate);
  const after = parseISO(afterDate);
  const end = endDate ? parseISO(endDate) : null;

  let current = start;

  // Walk forward until we find a date strictly after afterDate
  while (isBefore(current, after) || isEqual(current, after)) {
    current = addInterval(current, rule);
  }

  // Check if we've exceeded end date
  if (end && isBefore(end, current)) {
    return null;
  }

  return format(current, "yyyy-MM-dd");
}

/**
 * Returns startDate as the initial occurrence, or null if endDate < startDate.
 */
export function computeInitialOccurrence(
  startDate: string,
  endDate?: string | null
): string | null {
  if (endDate) {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (isBefore(end, start)) {
      return null;
    }
  }
  return startDate;
}

/**
 * Finds the first occurrence >= today. Used when resuming a paused template.
 */
export function computeResumeOccurrence(
  startDate: string,
  rule: RecurrenceRule,
  today: string,
  endDate?: string | null
): string | null {
  const start = parseISO(startDate);
  const todayDate = parseISO(today);
  const end = endDate ? parseISO(endDate) : null;

  // If start date is today or in the future, use it
  if (!isBefore(start, todayDate)) {
    if (end && isBefore(end, start)) {
      return null;
    }
    return startDate;
  }

  // Walk forward from start until we find a date >= today
  let current = start;
  while (isBefore(current, todayDate)) {
    current = addInterval(current, rule);
  }

  // Check if we've exceeded end date
  if (end && isBefore(end, current)) {
    return null;
  }

  return format(current, "yyyy-MM-dd");
}
