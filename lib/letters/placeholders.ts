/**
 * The complete vocabulary of placeholders a letter template may use.
 * Single source of truth: consumed by the click-to-insert palette in the
 * template form, by save-time validation, and by the renderer.
 */
export const LETTER_PLACEHOLDERS = [
  {
    token: "organization_name",
    label: "Organization Name",
    description: "The organization's name",
  },
  {
    token: "season_name",
    label: "Season Name",
    description: "Name of the season the letter is generated for",
  },
  {
    token: "season_start_date",
    label: "Season Start",
    description: "Season start date, MM/DD/YYYY",
  },
  {
    token: "season_end_date",
    label: "Season End",
    description: "Season end date, MM/DD/YYYY",
  },
  {
    token: "student_first_name",
    label: "Student First Name",
    description: "The student's first name",
  },
  {
    token: "student_last_name",
    label: "Student Last Name",
    description: "The student's last name",
  },
  {
    token: "student_full_name",
    label: "Student Full Name",
    description: "The student's first and last name",
  },
  {
    token: "guardian_name",
    label: "Guardian Name",
    description:
      "The guardian's name, falling back to the student's full name when no guardian is recorded",
  },
  {
    token: "fee_amount",
    label: "Season Fee",
    description: "The student's season fee, formatted as currency",
  },
  {
    token: "total_paid",
    label: "Total Paid",
    description: "Everything paid so far, formatted as currency",
  },
  {
    token: "balance_due",
    label: "Balance Due",
    description: "The amount still owed, formatted as currency",
  },
  {
    token: "today",
    label: "Today's Date",
    description: "The date the letter is generated, MM/DD/YYYY",
  },
  {
    token: "director_name",
    label: "Director Name",
    description: "Director name from organization settings",
  },
  {
    token: "director_title",
    label: "Director Title",
    description: "Director title from organization settings",
  },
  {
    token: "director_email",
    label: "Director Email",
    description: "Director email from organization settings",
  },
  {
    token: "director_phone",
    label: "Director Phone",
    description: "Director phone from organization settings",
  },
] as const;

export type PlaceholderToken = (typeof LETTER_PLACEHOLDERS)[number]["token"];

const KNOWN_TOKENS: ReadonlySet<string> = new Set(
  LETTER_PLACEHOLDERS.map((placeholder) => placeholder.token)
);

/**
 * Returns a NEW global regex on every call. A shared module-level `/g` regex
 * carries mutable `lastIndex` state between callers, which silently skips
 * matches; handing out a fresh instance makes that impossible.
 */
export function createPlaceholderPattern(): RegExp {
  return /\{\{\s*(\w+)\s*\}\}/g;
}

/** Tokens present in `text` that are not part of the vocabulary, de-duplicated. */
export function findUnknownPlaceholders(text: string): string[] {
  const unknown: string[] = [];
  for (const match of text.matchAll(createPlaceholderPattern())) {
    const token = match[1];
    if (!KNOWN_TOKENS.has(token) && !unknown.includes(token)) {
      unknown.push(token);
    }
  }
  return unknown;
}
