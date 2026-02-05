import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { SeasonsReportData, SeasonSummaryLine } from "./types";

export async function fetchSeasonsReportData(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SeasonsReportData | null> {
  // Fetch active seasons for this organization
  const { data: seasons, error: seasonsError } = await supabase
    .from("seasons")
    .select("id, name, start_date, end_date, fee_amount")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("start_date");

  if (seasonsError) {
    throw new Error(`Failed to fetch seasons: ${seasonsError.message}`);
  }

  if (!seasons || seasons.length === 0) {
    return null;
  }

  const seasonLines: SeasonSummaryLine[] = [];

  for (const season of seasons) {
    // Fetch enrolled enrollments with their payments — no student join
    const { data: enrollments, error: enrollError } = await supabase
      .from("season_enrollments")
      .select("fee_amount, status, season_payments(amount)")
      .eq("season_id", season.id)
      .eq("status", "enrolled");

    if (enrollError) {
      throw new Error(`Failed to fetch enrollments: ${enrollError.message}`);
    }

    const enrolledCount = enrollments?.length ?? 0;
    let totalExpected = 0;
    let totalCollected = 0;

    for (const enrollment of enrollments ?? []) {
      totalExpected += Number(enrollment.fee_amount);
      const payments = enrollment.season_payments ?? [];
      for (const payment of payments) {
        totalCollected += Number(payment.amount);
      }
    }

    const totalOutstanding = Math.max(0, totalExpected - totalCollected);
    const collectionRate =
      totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    seasonLines.push({
      seasonName: season.name,
      startDate: season.start_date,
      endDate: season.end_date,
      baseFee: Number(season.fee_amount),
      enrolledCount,
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate,
    });
  }

  const grandTotals = {
    enrolledCount: seasonLines.reduce((s, l) => s + l.enrolledCount, 0),
    totalExpected: seasonLines.reduce((s, l) => s + l.totalExpected, 0),
    totalCollected: seasonLines.reduce((s, l) => s + l.totalCollected, 0),
    totalOutstanding: seasonLines.reduce((s, l) => s + l.totalOutstanding, 0),
    collectionRate: 0,
  };
  grandTotals.collectionRate =
    grandTotals.totalExpected > 0
      ? (grandTotals.totalCollected / grandTotals.totalExpected) * 100
      : 0;

  return { seasons: seasonLines, grandTotals };
}
