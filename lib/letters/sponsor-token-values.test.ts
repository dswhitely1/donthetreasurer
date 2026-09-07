import { describe, it, expect } from "vitest";

import { buildSponsorTokenValues } from "./sponsor-token-values";

function context(overrides: Record<string, unknown> = {}) {
  return {
    organizationName: "CCV Band Boosters",
    organizationEin: "12-3456789",
    director: { name: "Jane Doe", title: "Band Director", email: "jane@ccv.org", phone: "555-0100" },
    generatedOn: "2026-09-06",
    sponsorName: "Acme Hardware",
    contactName: "Dale Cooper",
    levelName: "Gold",
    amount: 500,
    receivedDate: "2026-08-14",
    paymentMethod: "check" as const,
    termStartDate: "2026-07-01",
    termEndDate: "2027-06-30",
    ...overrides,
  };
}

describe("buildSponsorTokenValues", () => {
  it("formats the amount as currency", () => {
    expect(buildSponsorTokenValues(context()).sponsorship_amount).toBe("$500.00");
  });

  it("formats dates as MM/DD/YYYY", () => {
    const values = buildSponsorTokenValues(context());
    expect(values.received_date).toBe("08/14/2026");
    expect(values.term_start_date).toBe("07/01/2026");
    expect(values.term_end_date).toBe("06/30/2027");
  });

  it("labels the sponsorship year across the boundary", () => {
    expect(buildSponsorTokenValues(context()).term_label).toBe("2026–27");
  });

  it("prints a human label for the payment method", () => {
    expect(buildSponsorTokenValues(context()).payment_method).toBe("Check");
  });

  it("falls back to the sponsor name when no contact is recorded", () => {
    const values = buildSponsorTokenValues(context({ contactName: null }));
    expect(values.contact_name).toBe("Acme Hardware");
  });

  it("renders a missing EIN and missing director fields as empty strings", () => {
    const values = buildSponsorTokenValues(
      context({ organizationEin: null, director: { name: null, title: null, email: null, phone: null } })
    );
    expect(values.organization_ein).toBe("");
    expect(values.director_name).toBe("");
  });
});
