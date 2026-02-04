import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { seasonKeys } from "./query-keys";

import type { Tables } from "@/types/database";

type Season = Tables<"seasons">;
type SeasonEnrollment = Tables<"season_enrollments">;
type SeasonPayment = Tables<"season_payments">;

export function useSeasons(orgId: string) {
  return useQuery({
    queryKey: seasonKeys.list(orgId),
    queryFn: async (): Promise<Season[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("organization_id", orgId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useSeason(orgId: string, seasonId: string) {
  return useQuery({
    queryKey: seasonKeys.detail(orgId, seasonId),
    queryFn: async (): Promise<Season> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("id", seasonId)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useSeasonEnrollments(orgId: string, seasonId: string) {
  return useQuery({
    queryKey: seasonKeys.enrollments(orgId, seasonId),
    queryFn: async (): Promise<
      (SeasonEnrollment & {
        student: { first_name: string; last_name: string };
        season_payments: { amount: number }[];
      })[]
    > => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("season_enrollments")
        .select(
          "*, student:students(first_name, last_name), season_payments(amount)"
        )
        .eq("season_id", seasonId)
        .order("enrolled_at", { ascending: true });

      if (error) throw error;
      return data as (SeasonEnrollment & {
        student: { first_name: string; last_name: string };
        season_payments: { amount: number }[];
      })[];
    },
  });
}

export function useEnrollmentPayments(
  orgId: string,
  seasonId: string,
  enrollmentId: string
) {
  return useQuery({
    queryKey: [...seasonKeys.enrollments(orgId, seasonId), enrollmentId],
    queryFn: async (): Promise<SeasonPayment[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("season_payments")
        .select("*")
        .eq("enrollment_id", enrollmentId)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
