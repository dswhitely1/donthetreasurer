import type { PlaceholderToken } from "./placeholders";

export interface LetterDirector {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface LetterPayment {
  payment_date: string;
  amount: number;
  payment_method: string | null;
}

export interface LetterRecipient {
  enrollmentId: string;
  studentFirstName: string;
  studentLastName: string;
  guardianName: string | null;
  feeAmount: number;
  totalPaid: number;
  balanceDue: number;
  payments: LetterPayment[];
}

export interface LetterTemplateContent {
  heading: string | null;
  body: string;
  closing: string | null;
}

export interface LetterBatchData {
  organizationName: string;
  director: LetterDirector;
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  /** Date the batch is generated, as YYYY-MM-DD. */
  generatedOn: string;
  template: LetterTemplateContent;
  recipients: LetterRecipient[];
}

export type TokenValues = Record<PlaceholderToken, string>;
