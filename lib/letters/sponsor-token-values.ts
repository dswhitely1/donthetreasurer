import { formatCurrency, formatDate } from "@/lib/utils";
import { formatTermLabel } from "@/lib/sponsors/sponsorship-year";
import { SPONSOR_PAYMENT_METHOD_LABELS } from "@/lib/validations/sponsor";

import type { SponsorPaymentMethod } from "@/lib/validations/sponsor";
import type { LetterDirector } from "./types";

export interface SponsorLetterContext {
  organizationName: string;
  organizationEin: string | null;
  director: LetterDirector;
  /** Date the batch is generated, as YYYY-MM-DD. */
  generatedOn: string;
  sponsorName: string;
  contactName: string | null;
  levelName: string | null;
  amount: number;
  receivedDate: string;
  paymentMethod: SponsorPaymentMethod;
  termStartDate: string;
  termEndDate: string;
}

export function buildSponsorTokenValues(
  context: SponsorLetterContext
): Record<string, string> {
  const contact = context.contactName?.trim();

  return {
    organization_name: context.organizationName,
    organization_ein: context.organizationEin ?? "",
    today: formatDate(context.generatedOn),
    director_name: context.director.name ?? "",
    director_title: context.director.title ?? "",
    director_email: context.director.email ?? "",
    director_phone: context.director.phone ?? "",
    sponsor_name: context.sponsorName,
    // A letter addressed to nobody is worse than one addressed to the sponsor.
    contact_name: contact ? contact : context.sponsorName,
    level_name: context.levelName ?? "",
    sponsorship_amount: formatCurrency(context.amount),
    received_date: formatDate(context.receivedDate),
    payment_method: SPONSOR_PAYMENT_METHOD_LABELS[context.paymentMethod],
    term_start_date: formatDate(context.termStartDate),
    term_end_date: formatDate(context.termEndDate),
    term_label: formatTermLabel(context.termStartDate, context.termEndDate),
  };
}
