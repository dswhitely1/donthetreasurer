import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { SeasonSummaryLine, SeasonsReportData } from "./types";

function computeCollectionRate(collected: number, expected: number): number {
  return expected > 0 ? (collected / expected) * 100 : 0;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function fetchSeasonsReportData(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<SeasonsReportData | null> {
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

  const seasonIds = seasons.map((s) => s.id);

  // Single query for all enrolled enrollments across all active seasons
  const { data: enrollments, error: enrollError } = await supabase
    .from("season_enrollments")
    .select("season_id, fee_amount, season_payments(amount)")
    .in("season_id", seasonIds)
    .eq("status", "enrolled");

  if (enrollError) {
    throw new Error(`Failed to fetch enrollments: ${enrollError.message}`);
  }

  // Group enrollments by season_id
  const enrollmentsBySeason = new Map<
    string,
    typeof enrollments
  >();
  for (const enrollment of enrollments ?? []) {
    const group = enrollmentsBySeason.get(enrollment.season_id) ?? [];
    group.push(enrollment);
    enrollmentsBySeason.set(enrollment.season_id, group);
  }

  const seasonLines: SeasonSummaryLine[] = seasons.map((season) => {
    const seasonEnrollments = enrollmentsBySeason.get(season.id) ?? [];

    let totalExpected = 0;
    let totalCollected = 0;

    for (const enrollment of seasonEnrollments) {
      totalExpected += Number(enrollment.fee_amount);
      for (const payment of enrollment.season_payments ?? []) {
        totalCollected += Number(payment.amount);
      }
    }

    totalExpected = roundCents(totalExpected);
    totalCollected = roundCents(totalCollected);

    return {
      seasonId: season.id,
      seasonName: season.name,
      startDate: season.start_date,
      endDate: season.end_date,
      baseFee: roundCents(Number(season.fee_amount)),
      enrolledCount: seasonEnrollments.length,
      totalExpected,
      totalCollected,
      totalOutstanding: roundCents(Math.max(0, totalExpected - totalCollected)),
      collectionRate: computeCollectionRate(totalCollected, totalExpected),
    };
  });

  const grandTotalExpected = seasonLines.reduce((s, l) => s + l.totalExpected, 0);
  const grandTotalCollected = seasonLines.reduce((s, l) => s + l.totalCollected, 0);

  const grandTotals = {
    enrolledCount: seasonLines.reduce((s, l) => s + l.enrolledCount, 0),
    totalExpected: grandTotalExpected,
    totalCollected: grandTotalCollected,
    totalOutstanding: seasonLines.reduce((s, l) => s + l.totalOutstanding, 0),
    collectionRate: computeCollectionRate(grandTotalCollected, grandTotalExpected),
  };

  return { seasons: seasonLines, grandTotals };
}
