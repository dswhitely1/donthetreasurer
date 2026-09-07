/**
 * Letter templates serve two audiences: families who owe season fees, and
 * sponsors who need a 501(c)(3) acknowledgment. Each type gets its own
 * placeholder vocabulary so a token from one type can never silently render
 * blank on a letter of the other type — it is rejected at save time instead.
 */
export const LETTER_TEMPLATE_TYPES = [
  "season_balance",
  "sponsor_acknowledgment",
] as const;

export type LetterTemplateType = (typeof LETTER_TEMPLATE_TYPES)[number];

export const LETTER_TEMPLATE_TYPE_LABELS: Record<LetterTemplateType, string> = {
  season_balance: "Season Balance Notice",
  sponsor_acknowledgment: "Sponsor Acknowledgment",
};

export interface LetterPlaceholder {
  token: string;
  label: string;
  description: string;
}

const SHARED_PLACEHOLDERS = [
  {
    token: "organization_name",
    label: "Organization Name",
    description: "The organization's name",
  },
  {
    token: "organization_ein",
    label: "Organization EIN",
    description: "The organization's EIN, for tax acknowledgments",
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

const SEASON_PLACEHOLDERS = [
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
] as const;

const SPONSOR_PLACEHOLDERS = [
  {
    token: "sponsor_name",
    label: "Sponsor Name",
    description: "The sponsoring business or person",
  },
  {
    token: "contact_name",
    label: "Contact Name",
    description: "The sponsor's contact person, falling back to the sponsor name",
  },
  {
    token: "level_name",
    label: "Sponsorship Level",
    description: "The level the sponsor purchased, e.g. Gold",
  },
  {
    token: "sponsorship_amount",
    label: "Sponsorship Amount",
    description: "The amount received, formatted as currency",
  },
  {
    token: "received_date",
    label: "Date Received",
    description: "When the payment was received, MM/DD/YYYY",
  },
  {
    token: "payment_method",
    label: "Payment Method",
    description: "Cash, Check, PayPal, or Other",
  },
  {
    token: "term_start_date",
    label: "Term Start",
    description: "Sponsorship term start, MM/DD/YYYY",
  },
  {
    token: "term_end_date",
    label: "Term End",
    description: "Sponsorship term end, MM/DD/YYYY",
  },
  {
    token: "term_label",
    label: "Sponsorship Year",
    description: "The sponsorship year, e.g. 2026–27",
  },
] as const;

/**
 * The complete vocabulary of placeholders any letter template may use, across
 * both types. Consumed by the existing duplicate-token and label/description
 * tests; has no duplicates because each token is defined exactly once above.
 */
export const LETTER_PLACEHOLDERS = [
  ...SHARED_PLACEHOLDERS,
  ...SEASON_PLACEHOLDERS,
  ...SPONSOR_PLACEHOLDERS,
] as const;

export type PlaceholderToken = (typeof LETTER_PLACEHOLDERS)[number]["token"];

export const LETTER_PLACEHOLDERS_BY_TYPE: Record<
  LetterTemplateType,
  readonly LetterPlaceholder[]
> = {
  season_balance: [...SHARED_PLACEHOLDERS, ...SEASON_PLACEHOLDERS],
  sponsor_acknowledgment: [...SHARED_PLACEHOLDERS, ...SPONSOR_PLACEHOLDERS],
};

/** The placeholder vocabulary available to templates of the given type. */
export function getPlaceholders(
  type: LetterTemplateType
): readonly LetterPlaceholder[] {
  return LETTER_PLACEHOLDERS_BY_TYPE[type];
}

/**
 * Returns a NEW global regex on every call. A shared module-level `/g` regex
 * carries mutable `lastIndex` state between callers, which silently skips
 * matches; handing out a fresh instance makes that impossible.
 */
export function createPlaceholderPattern(): RegExp {
  return /\{\{\s*(\w+)\s*\}\}/g;
}

/**
 * Tokens present in `text` that are not part of the vocabulary for this
 * template type, de-duplicated. Scoping by type is what stops
 * `{{student_first_name}}` from silently rendering blank on every sponsor
 * letter — it fails at save time instead.
 */
export function findUnknownPlaceholders(
  text: string,
  type: LetterTemplateType = "season_balance"
): string[] {
  const known = new Set(getPlaceholders(type).map((p) => p.token));
  const unknown: string[] = [];
  for (const match of text.matchAll(createPlaceholderPattern())) {
    const token = match[1];
    if (!known.has(token) && !unknown.includes(token)) {
      unknown.push(token);
    }
  }
  return unknown;
}
