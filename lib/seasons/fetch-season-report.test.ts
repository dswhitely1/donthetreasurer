import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";
import { fetchSeasonReport } from "./fetch-season-report";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

const seasonId = "990e8400-e29b-41d4-a716-446655440000";

const seasonRow = {
  id: seasonId,
  name: "Fall 2026",
  description: null,
  start_date: "2026-08-01",
  end_date: "2026-12-15",
  fee_amount: 450,
  status: "active",
  organizations: { name: "Acme Band Boosters" },
};

const enrollmentRows = [
  {
    id: "880e8400-e29b-41d4-a716-446655440000",
    fee_amount: 450,
    status: "enrolled",
    student: {
      first_name: "Alex",
      last_name: "Rivera",
      guardian_name: "Maria Rivera",
      email: null,
      phone: null,
      guardian_email: "maria@example.org",
      guardian_phone: null,
    },
    season_payments: [
      {
        id: "aa0e8400-e29b-41d4-a716-446655440000",
        payment_date: "2026-09-01",
        amount: 200,
        payment_method: "Check",
        notes: null,
      },
    ],
  },
];

describe("fetchSeasonReport", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockSupabase.mockChain().sequence([
      { data: seasonRow, error: null },
      { data: enrollmentRows, error: null },
    ]);
  });

  it("exposes the student's first and last name separately", async () => {
    const report = await fetchSeasonReport(mockSupabase as never, seasonId);

    expect(report).not.toBeNull();
    expect(report?.enrollments[0].studentFirstName).toBe("Alex");
    expect(report?.enrollments[0].studentLastName).toBe("Rivera");
  });

  it("still exposes the combined display name", async () => {
    const report = await fetchSeasonReport(mockSupabase as never, seasonId);
    expect(report?.enrollments[0].studentName).toBe("Rivera, Alex");
  });

  it("still computes the balance due", async () => {
    const report = await fetchSeasonReport(mockSupabase as never, seasonId);
    expect(report?.enrollments[0].totalPaid).toBe(200);
    expect(report?.enrollments[0].balanceDue).toBe(250);
  });
});
