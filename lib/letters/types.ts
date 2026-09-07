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
 */
export interface LetterDetailTable {
  title?: string;
  rows: string[][];
  emptyMessage?: string;
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
