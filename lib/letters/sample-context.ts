import { buildTokenValues } from "./render-template";

import type { LetterBatchData, LetterRecipient, TokenValues } from "./types";

const SAMPLE_RECIPIENT: LetterRecipient = {
  enrollmentId: "00000000-0000-0000-0000-000000000000",
  studentFirstName: "Alex",
  studentLastName: "Rivera",
  guardianName: "Maria Rivera",
  feeAmount: 450,
  totalPaid: 200,
  balanceDue: 250,
  payments: [],
};

const SAMPLE_BATCH: LetterBatchData = {
  organizationName: "Your Organization",
  director: {
    name: "Jane Doe",
    title: "Band Director",
    email: "director@example.org",
    phone: "555-0100",
  },
  seasonName: "Fall 2026",
  seasonStartDate: "2026-08-01",
  seasonEndDate: "2026-12-15",
  generatedOn: "2026-08-20",
  template: { heading: null, body: "", closing: null },
  recipients: [SAMPLE_RECIPIENT],
};

/**
 * Fixed values powering the template form's live preview. Deliberately static
 * (including the date) so the preview never changes under the treasurer while
 * they type.
 */
export const SAMPLE_TOKEN_VALUES: TokenValues = buildTokenValues(
  SAMPLE_BATCH,
  SAMPLE_RECIPIENT
);
