import { formatCurrency, formatDate } from "@/lib/utils";

import { createPlaceholderPattern } from "./placeholders";

import type { LetterBatchData, LetterRecipient, TokenValues } from "./types";

export function buildTokenValues(
  batch: LetterBatchData,
  recipient: LetterRecipient
): TokenValues {
  const fullName =
    `${recipient.studentFirstName} ${recipient.studentLastName}`.trim();
  const guardian = recipient.guardianName?.trim();

  return {
    organization_name: batch.organizationName,
    season_name: batch.seasonName,
    season_start_date: formatDate(batch.seasonStartDate),
    season_end_date: formatDate(batch.seasonEndDate),
    student_first_name: recipient.studentFirstName,
    student_last_name: recipient.studentLastName,
    student_full_name: fullName,
    // A letter addressed to nobody is worse than one addressed to the student.
    guardian_name: guardian ? guardian : fullName,
    fee_amount: formatCurrency(recipient.feeAmount),
    total_paid: formatCurrency(recipient.totalPaid),
    balance_due: formatCurrency(recipient.balanceDue),
    today: formatDate(batch.generatedOn),
    director_name: batch.director.name ?? "",
    director_title: batch.director.title ?? "",
    director_email: batch.director.email ?? "",
    director_phone: batch.director.phone ?? "",
  };
}

/**
 * Substitutes placeholders in a single pass.
 *
 * The replacement is a FUNCTION rather than a string on purpose: it makes the
 * pass non-recursive (a value containing `{{token}}` is never re-expanded) and
 * stops `$&` / `$1` inside a student's name from being read as a regex
 * back-reference. Unknown tokens render empty — save-time validation is the
 * real guard against typos.
 */
export function renderTemplate(text: string, values: TokenValues): string {
  return text.replace(createPlaceholderPattern(), (_match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token)
      ? values[token as keyof TokenValues]
      : ""
  );
}
