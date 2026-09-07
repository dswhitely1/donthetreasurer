import { buildSeasonTokenValues } from "./render-template";
import { buildSponsorTokenValues } from "./sponsor-token-values";

import type { SeasonTokenContext } from "./render-template";
import type { SponsorLetterContext } from "./sponsor-token-values";

const SAMPLE_SEASON_CONTEXT: SeasonTokenContext = {
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

const SAMPLE_SPONSOR_CONTEXT: SponsorLetterContext = {
  organizationName: "Your Organization",
  organizationEin: "12-3456789",
  director: {
    name: "Jane Doe",
    title: "Band Director",
    email: "director@example.org",
    phone: "555-0100",
  },
  generatedOn: "2026-08-20",
  sponsorName: "Acme Hardware",
  contactName: "Sam Rivera",
  levelName: "Gold",
  amount: 500,
  receivedDate: "2026-08-14",
  paymentMethod: "check",
  termStartDate: "2026-07-01",
  termEndDate: "2027-06-30",
};

/**
 * Fixed values powering the template form's live preview for a season
 * balance letter. Deliberately static (including the date) so the preview
 * never changes under the treasurer while they type. Sponsor-only
 * placeholders are absent here, which is fine — `renderTemplate` prints
 * unknown tokens as empty strings.
 */
export const SAMPLE_SEASON_TOKEN_VALUES: Record<string, string> =
  buildSeasonTokenValues(SAMPLE_SEASON_CONTEXT);

/**
 * Fixed values powering the template form's live preview for a sponsor
 * acknowledgment letter. Season-only placeholders are absent here, which is
 * fine — `renderTemplate` prints unknown tokens as empty strings.
 */
export const SAMPLE_SPONSOR_TOKEN_VALUES: Record<string, string> =
  buildSponsorTokenValues(SAMPLE_SPONSOR_CONTEXT);
