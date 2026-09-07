import { buildSeasonTokenValues } from "./render-template";

import type { SeasonTokenContext } from "./render-template";

const SAMPLE_CONTEXT: SeasonTokenContext = {
  organizationName: "Your Organization",
  organizationEin: "12-3456789",
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
  enrollment: {
    studentFirstName: "Alex",
    studentLastName: "Rivera",
    guardianName: "Maria Rivera",
    feeAmount: 450,
    totalPaid: 200,
    balanceDue: 250,
  },
};

/**
 * Fixed values powering the template form's live preview. Deliberately static
 * (including the date) so the preview never changes under the treasurer while
 * they type. Sponsor-only placeholders are absent here, which is fine —
 * `renderTemplate` prints unknown tokens as empty strings.
 */
export const SAMPLE_TOKEN_VALUES: Record<string, string> =
  buildSeasonTokenValues(SAMPLE_CONTEXT);
