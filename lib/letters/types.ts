export interface LetterDirector {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface LetterTemplateContent {
  heading: string | null;
  body: string;
  closing: string | null;
}

/**
 * One table of rows printed below the letter body — e.g. a balance summary
 * box or a payment history. `emptyMessage` prints in place of the table when
 * `rows` is empty, so a recipient with no history still gets a line saying
 * so instead of a blank gap.
 *
 * `head` and `variant` are optional precisely because a sponsor letter has
 * no use for either — a single sponsorship needs no header row and no
 * summary box. Season letters use both to reproduce their pre-existing
 * appearance: an untitled `"summary"` box for the balance figures, and a
 * headered `"list"` (the default) for payment history.
 */
export interface LetterDetailTable {
  title?: string;
  /** Column header row, rendered shaded. Omit for a table with no header. */
  head?: string[];
  rows: string[][];
  emptyMessage?: string;
  /**
   * `"summary"` renders a narrow, two-column label/value box with its final
   * row emphasized (e.g. a balance box ending in "Balance Due"). `"list"`
   * (the default) renders a normal full-width table.
   */
  variant?: "summary" | "list";
}

/**
 * A single letter recipient, described entirely by precomputed token values
 * plus optional detail tables. Neither the renderer nor this type knows
 * whether the recipient is a family or a sponsor — that's resolved upstream
 * by whichever `build*TokenValues` function produced `tokenValues`.
 */
export interface LetterRecipient {
  id: string;
  tokenValues: Record<string, string>;
  detailTables?: LetterDetailTable[];
}

export interface LetterBatchData {
  organizationName: string;
  director: LetterDirector;
  /** Date the batch is generated, as YYYY-MM-DD. */
  generatedOn: string;
  template: LetterTemplateContent;
  recipients: LetterRecipient[];
}
