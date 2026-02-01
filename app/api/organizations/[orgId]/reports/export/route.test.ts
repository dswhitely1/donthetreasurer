import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/reports/fetch-report-data", () => ({
  fetchReportData: vi.fn(),
}));

vi.mock("@/lib/excel/generate-report", () => ({
  generateReportWorkbook: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { generateReportWorkbook } from "@/lib/excel/generate-report";
import { GET } from "./route";

const mockedCreateClient = vi.mocked(createClient);
const mockedFetchReportData = vi.mocked(fetchReportData);
const mockedGenerateWorkbook = vi.mocked(generateReportWorkbook);

const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";

describe("GET /api/organizations/[orgId]/reports/export", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
  });

  function makeRequest(params: Record<string, string>): Request {
    const url = new URL("http://localhost/api/organizations/" + orgId + "/reports/export");
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }
    return new Request(url.toString());
  }

  it("returns 401 when unauthenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const request = makeRequest({ start_date: "2025-01-01", end_date: "2025-12-31" });
    const response = await GET(request, { params: Promise.resolve({ orgId }) });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthenticated");
  });

  it("returns 400 for invalid params", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);

    const request = makeRequest({ start_date: "", end_date: "" });
    const response = await GET(request, { params: Promise.resolve({ orgId }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid parameters");
  });

  it("returns 404 when org not found", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
    mockSupabase.mockResult({ data: null, error: null });

    const request = makeRequest({ start_date: "2025-01-01", end_date: "2025-12-31" });
    const response = await GET(request, { params: Promise.resolve({ orgId }) });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Organization not found");
  });

  it("returns 200 with xlsx content-type and correct filename", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
    mockSupabase.mockResult({ data: { id: orgId, name: "Test Foundation" }, error: null });

    const reportData = {
      organizationName: "Test Foundation",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      generatedAt: "2025-06-15T10:00:00Z",
      transactions: [],
      summary: {
        totalIncome: 0,
        totalExpenses: 0,
        netChange: 0,
        balanceByStatus: { uncleared: 0, cleared: 0, reconciled: 0 },
        incomeByCategory: [],
        expensesByCategory: [],
      },
    };

    mockedFetchReportData.mockResolvedValue(reportData);
    mockedGenerateWorkbook.mockResolvedValue(Buffer.from("fake-xlsx"));

    const request = makeRequest({ start_date: "2025-01-01", end_date: "2025-12-31" });
    const response = await GET(request, { params: Promise.resolve({ orgId }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toContain("TestFoundation_Transactions_2025-01-01_to_2025-12-31.xlsx");
  });

  it("returns 500 when report generation fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
    mockSupabase.mockResult({ data: { id: orgId, name: "Test Org" }, error: null });

    mockedFetchReportData.mockRejectedValue(new Error("DB error"));

    const request = makeRequest({ start_date: "2025-01-01", end_date: "2025-12-31" });
    const response = await GET(request, { params: Promise.resolve({ orgId }) });

    expect(response.status).toBe(500);
  });
});
