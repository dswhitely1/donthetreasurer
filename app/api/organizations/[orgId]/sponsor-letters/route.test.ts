import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/pdf/generate-letters", () => ({
  generateLettersPdf: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { generateLettersPdf } from "@/lib/pdf/generate-letters";
import { POST } from "./route";

import type { LetterBatchData } from "@/lib/letters/types";

const mockedCreateClient = vi.mocked(createClient);
const mockedGenerateLettersPdf = vi.mocked(generateLettersPdf);

const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const templateId = "770e8400-e29b-41d4-a716-446655440000";
const sponsorshipId = "880e8400-e29b-41d4-a716-446655440001";
const foreignId = "880e8400-e29b-41d4-a716-446655440009";

const orgRow = {
  id: orgId,
  name: "CCV Band Boosters",
  ein: "12-3456789",
  fiscal_year_start_month: 7,
  sponsors_enabled: true,
  director_name: "Jane Doe",
  director_title: "Band Director",
  director_email: "jane@ccv.org",
  director_phone: "555-0100",
};

const templateRow = {
  id: templateId,
  heading: "Thank You For Your Sponsorship",
  body: "Dear {{contact_name}}, thank you for your {{sponsorship_amount}} gift.",
  closing: "Sincerely,",
  template_type: "sponsor_acknowledgment",
};

function makeSponsorshipRow(
  id: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    amount: 500,
    payment_method: "check",
    received_date: "2026-08-14",
    term_start_date: "2026-07-01",
    term_end_date: "2027-06-30",
    sponsors: {
      name: "Acme Hardware",
      contact_name: "Dale Cooper",
      organization_id: orgId,
    },
    sponsor_levels: { name: "Gold" },
    ...overrides,
  };
}

const defaultSponsorshipRows = [makeSponsorshipRow(sponsorshipId)];

/**
 * A chain object where every non-terminal method returns itself, so it works
 * regardless of exactly how many `.eq()`/`.in()`/`.order()` calls the route
 * chains before resolving — the same trick the shared Supabase mock uses.
 */
function chainFor(result: { data: unknown; error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  Object.defineProperty(chain, "then", {
    value: (
      resolve?: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
    writable: true,
    configurable: true,
  });
  return chain;
}

/**
 * Configures `from()` per table, so each test fails for the reason it names
 * instead of the shared mock's single terminal result silently satisfying
 * every query in the route.
 */
function setupTables(overrides: {
  org?: unknown;
  template?: unknown;
  sponsorships?: unknown;
}) {
  const org = "org" in overrides ? overrides.org : orgRow;
  const template = "template" in overrides ? overrides.template : templateRow;
  const sponsorships =
    "sponsorships" in overrides ? overrides.sponsorships : defaultSponsorshipRows;

  mockSupabase.from.mockImplementation(((table: string) => {
    if (table === "organizations") {
      return chainFor({ data: org, error: null });
    }
    if (table === "letter_templates") {
      return chainFor({ data: template, error: null });
    }
    if (table === "sponsorships") {
      return chainFor({ data: sponsorships, error: null });
    }
    return chainFor({ data: null, error: null });
  }) as never);
}

function makeRequest(body: unknown): Request {
  return new Request(
    `http://localhost/api/organizations/${orgId}/sponsor-letters`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const routeParams = { params: Promise.resolve({ orgId }) };

let mockSupabase: MockSupabaseClient;

describe("POST /api/organizations/[orgId]/sponsor-letters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
    mockedGenerateLettersPdf.mockReturnValue(Buffer.from("%PDF-1.4 fake"));
    setupTables({});
  });

  it("returns 401 when no user is signed in", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const response = await POST(
      makeRequest({ template_id: templateId, sponsorship_ids: [sponsorshipId] }),
      routeParams
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when sponsor tracking is disabled for the org", async () => {
    setupTables({ org: { ...orgRow, sponsors_enabled: false } });

    const response = await POST(
      makeRequest({ template_id: templateId, sponsorship_ids: [sponsorshipId] }),
      routeParams
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for a template belonging to another organization", async () => {
    setupTables({ template: null });

    const response = await POST(
      makeRequest({ template_id: templateId, sponsorship_ids: [sponsorshipId] }),
      routeParams
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for a season template used as a sponsor letter", async () => {
    setupTables({
      template: { ...templateRow, template_type: "season_balance" },
    });

    const response = await POST(
      makeRequest({ template_id: templateId, sponsorship_ids: [sponsorshipId] }),
      routeParams
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error.toLowerCase()).toContain("sponsor");
  });

  it("ignores sponsorship ids outside the organization", async () => {
    // Two ids requested; the org-scoped query only ever returns one row —
    // the client can narrow the set, never widen it.
    setupTables({ sponsorships: [makeSponsorshipRow(sponsorshipId)] });

    const response = await POST(
      makeRequest({
        template_id: templateId,
        sponsorship_ids: [sponsorshipId, foreignId],
      }),
      routeParams
    );

    expect(response.status).toBe(200);
    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    expect(batch.recipients).toHaveLength(1);
    expect(batch.recipients[0].id).toBe(sponsorshipId);
  });

  it("returns 400 when no requested sponsorship survives the filter", async () => {
    setupTables({ sponsorships: [] });

    const response = await POST(
      makeRequest({ template_id: templateId, sponsorship_ids: [sponsorshipId] }),
      routeParams
    );

    expect(response.status).toBe(400);
  });

  it("returns a PDF with the expected content type", async () => {
    const response = await POST(
      makeRequest({ template_id: templateId, sponsorship_ids: [sponsorshipId] }),
      routeParams
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });
});
