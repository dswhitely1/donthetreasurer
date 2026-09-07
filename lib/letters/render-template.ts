import { formatCurrency, formatDate } from "@/lib/utils";

import { createPlaceholderPattern } from "./placeholders";

import type { LetterDirector } from "./types";

/** The season-fee facts a season balance letter is addressed around. */
export interface SeasonTokenEnrollment {
  studentFirstName: string;
  studentLastName: string;
  guardianName: string | null;
  feeAmount: number;
  totalPaid: number;
  balanceDue: number;
}

export interface SeasonTokenContext {
  organizationName: string;
  organizationEin: string | null;
  director: LetterDirector;
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  /** Date the batch is generated, as YYYY-MM-DD. */
  generatedOn: string;
  enrollment: SeasonTokenEnrollment;
}

export function buildSeasonTokenValues(
  context: SeasonTokenContext
): Record<string, string> {
  const { enrollment } = context;
  const fullName =
    `${enrollment.studentFirstName} ${enrollment.studentLastName}`.trim();
  const guardian = enrollment.guardianName?.trim();

  return {
    organization_name: context.organizationName,
    organization_ein: context.organizationEin ?? "",
    season_name: context.seasonName,
    season_start_date: formatDate(context.seasonStartDate),
    season_end_date: formatDate(context.seasonEndDate),
    student_first_name: enrollment.studentFirstName,
    student_last_name: enrollment.studentLastName,
    student_full_name: fullName,
    // A letter addressed to nobody is worse than one addressed to the student.
    guardian_name: guardian ? guardian : fullName,
    fee_amount: formatCurrency(enrollment.feeAmount),
    total_paid: formatCurrency(enrollment.totalPaid),
    balance_due: formatCurrency(enrollment.balanceDue),
    today: formatDate(context.generatedOn),
    director_name: context.director.name ?? "",
    director_title: context.director.title ?? "",
    director_email: context.director.email ?? "",
    director_phone: context.director.phone ?? "",
  };
}

/**
 * Substitutes placeholders in a single pass.
 *
 * The replacement is a FUNCTION rather than a string on purpose: it makes the
 * pass non-recursive (a value containing `{{token}}` is never re-expanded) and
 * stops `$&` / `$1` inside a recipient's name from being read as a regex
 * back-reference. Unknown tokens render empty — save-time validation is the
 * real guard against typos.
 */
export function renderTemplate(
  text: string,
  values: Record<string, string>
): string {
  return text.replace(createPlaceholderPattern(), (_match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token) ? values[token] : ""
  );
}
