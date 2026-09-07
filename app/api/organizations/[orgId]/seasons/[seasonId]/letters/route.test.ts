import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/seasons/fetch-season-report", () => ({
  fetchSeasonReport: vi.fn(),
}));
vi.mock("@/lib/pdf/generate-letters", () => ({
  generateLettersPdf: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { fetchSeasonReport } from "@/lib/seasons/fetch-season-report";
import { generateLettersPdf } from "@/lib/pdf/generate-letters";
import { POST } from "./route";

import type { SeasonReportData } from "@/lib/seasons/types";
import type { LetterBatchData } from "@/lib/letters/types";

const mockedCreateClient = vi.mocked(createClient);
const mockedFetchSeasonReport = vi.mocked(fetchSeasonReport);
const mockedGenerateLettersPdf = vi.mocked(generateLettersPdf);

const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const seasonId = "990e8400-e29b-41d4-a716-446655440000";
const templateId = "770e8400-e29b-41d4-a716-446655440000";
const owingId = "880e8400-e29b-41d4-a716-446655440001";
const paidId = "880e8400-e29b-41d4-a716-446655440002";
const withdrawnId = "880e8400-e29b-41d4-a716-446655440003";
const foreignId = "880e8400-e29b-41d4-a716-446655440009";

const orgRow = {
  id: orgId,
  name: "Acme Band Boosters",
  ein: "12-3456789",
  seasons_enabled: true,
  director_name: "Jane Doe",
  director_title: "Band Director",
  director_email: "jane@band.org",
  director_phone: "555-0100",
};

const templateRow = {
  id: templateId,
  heading: "Outstanding Balance Notice",
  body: "Dear {{guardian_name}}, you owe {{balance_due}}.",
  closing: "Sincerely,",
};

function makeEnrollment(
  id: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    studentName: "Rivera, Alex",
    studentFirstName: "Alex",
    studentLastName: "Rivera",
    guardianName: "Maria Rivera",
    contactEmail: null,
    contactPhone: null,
    feeAmount: 450,
    totalPaid: 200,
    balanceDue: 250,
    paymentStatus: "partial",
    enrollmentStatus: "enrolled",
    payments: [],
    ...overrides,
  };
}

const reportData = {
  organizationName: "Acme Band Boosters",
  seasonName: "Fall 2026",
  seasonDescription: null,
  startDate: "2026-08-01",
  endDate: "2026-12-15",
  feeAmount: 450,
  status: "active",
  generatedAt: "2026-08-20T10:00:00Z",
  summary: {
    totalEnrolled: 3,
    totalFeesExpected: 1350,
    totalCollected: 1100,
    totalOutstanding: 250,
    collectionRate: 81.5,
  },
  enrollments: [
    makeEnrollment(owingId),
    makeEnrollment(paidId, { totalPaid: 450, balanceDue: 0, paymentStatus: "paid" }),
    makeEnrollment(withdrawnId, { enrollmentStatus: "withdrawn" }),
  ],
} as unknown as SeasonReportData;

function makeRequest(body: unknown): Request {
  return new Request(
    `http://localhost/api/organizations/${orgId}/seasons/${seasonId}/letters`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const routeParams = { params: Promise.resolve({ orgId, seasonId }) };

describe("POST /api/organizations/[orgId]/seasons/[seasonId]/letters", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
    mockedFetchSeasonReport.mockResolvedValue(reportData);
    mockedGenerateLettersPdf.mockReturnValue(Buffer.from("%PDF-1.4 fake"));
  });

  it("returns 401 when unauthenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the organization is not found", async () => {
    mockSupabase.mockResult({ data: null, error: null });

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when season tracking is disabled", async () => {
    mockSupabase.mockResult({
      data: { ...orgRow, seasons_enabled: false },
      error: null,
    });

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed body", async () => {
    mockSupabase.mockChain().sequence([{ data: orgRow, error: null }]);

    const response = await POST(
      makeRequest({ template_id: "not-a-uuid", enrollment_ids: [] }),
      routeParams
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when the template does not belong to the org", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: null, error: null },
    ]);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(404);
  });

  it("returns a PDF for a valid request", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(".pdf");
  });

  it("uses the same local date for the printed letter and the filename", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filenameDate = disposition.match(/_(\d{4}-\d{2}-\d{2})\.pdf"$/)?.[1];

    // Local YYYY-MM-DD (via toLocaleDateString("en-CA")), not a UTC-derived
    // date — and the same value in both places so the letter and the
    // filename can never disagree.
    expect(batch.generatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filenameDate).toBe(batch.generatedOn);
  });

  it("includes only the requested enrollment", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    expect(batch.recipients).toHaveLength(1);
    expect(batch.recipients[0].id).toBe(owingId);
  });

  it("prints the production wording for a recipient with no payments on record", async () => {
    // Reads the actual string the route builds, not a hand-copied literal —
    // this is what would have caught the route drifting from
    // "No payments received to date." to some other wording, since the
    // renderer's own tests only exercise fixtures typed by hand.
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    const paymentsTable = batch.recipients[0].detailTables?.[1];
    expect(paymentsTable?.rows).toEqual([]);
    expect(paymentsTable?.emptyMessage).toBe(
      "No payments received to date."
    );
  });

  it("drops ids that are not in this season", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    await POST(
      makeRequest({
        template_id: templateId,
        enrollment_ids: [owingId, foreignId],
      }),
      routeParams
    );

    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    expect(batch.recipients.map((r) => r.id)).toEqual([owingId]);
  });

  it("excludes withdrawn enrollments even when explicitly requested", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    const response = await POST(
      makeRequest({
        template_id: templateId,
        enrollment_ids: [withdrawnId],
      }),
      routeParams
    );

    expect(response.status).toBe(400);
  });

  it("excludes paid-up enrollments even when explicitly requested", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    const response = await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [paidId] }),
      routeParams
    );

    expect(response.status).toBe(400);
  });

  it("passes the organization's director onto the batch", async () => {
    mockSupabase.mockChain().sequence([
      { data: orgRow, error: null },
      { data: templateRow, error: null },
    ]);

    await POST(
      makeRequest({ template_id: templateId, enrollment_ids: [owingId] }),
      routeParams
    );

    const batch = mockedGenerateLettersPdf.mock.calls[0][0] as LetterBatchData;
    expect(batch.director.name).toBe("Jane Doe");
    expect(batch.director.title).toBe("Band Director");
  });
});
