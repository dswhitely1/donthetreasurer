import { computePaymentStatus } from "./payment-status";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SeasonReportData, SeasonReportEnrollment } from "./types";

export async function fetchSeasonReport(
  supabase: SupabaseClient<Database>,
  seasonId: string
): Promise<SeasonReportData | null> {
  const { data: season } = await supabase
    .from("seasons")
    .select(
      "*, organizations(name)"
    )
    .eq("id", seasonId)
    .single();

  if (!season) return null;

  const { data: enrollments } = await supabase
    .from("season_enrollments")
    .select(
      "*, student:students(first_name, last_name, guardian_name, email, phone, guardian_email, guardian_phone), season_payments(id, payment_date, amount, payment_method, notes)"
    )
    .eq("season_id", seasonId)
    .order("enrolled_at", { ascending: true });

  const org = season.organizations as { name: string } | null;

  const reportEnrollments: SeasonReportEnrollment[] = (enrollments ?? []).map(
    (e) => {
      const student = e.student as {
        first_name: string;
        last_name: string;
        guardian_name: string | null;
        email: string | null;
        phone: string | null;
        guardian_email: string | null;
        guardian_phone: string | null;
      };
      const payments = (e.season_payments ?? []) as {
        id: string;
        payment_date: string;
        amount: number;
        payment_method: string | null;
        notes: string | null;
      }[];

      const totalPaid = payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      const balanceDue = Number(e.fee_amount) - totalPaid;
      const paymentStatus = computePaymentStatus(
        Number(e.fee_amount),
        totalPaid
      );

      return {
        id: e.id,
        studentName: `${student.last_name}, ${student.first_name}`,
        guardianName: student.guardian_name,
        contactEmail: student.email || student.guardian_email,
        contactPhone: student.phone || student.guardian_phone,
        feeAmount: Number(e.fee_amount),
        totalPaid,
        balanceDue,
        paymentStatus,
        enrollmentStatus: e.status,
        payments: payments.map((p) => ({
          id: p.id,
          payment_date: p.payment_date,
          amount: Number(p.amount),
          payment_method: p.payment_method,
          notes: p.notes,
        })),
      };
    }
  );

  const totalEnrolled = reportEnrollments.length;
  const totalFeesExpected = reportEnrollments.reduce(
    (sum, e) => sum + e.feeAmount,
    0
  );
  const totalCollected = reportEnrollments.reduce(
    (sum, e) => sum + e.totalPaid,
    0
  );
  const totalOutstanding = totalFeesExpected - totalCollected;
  const collectionRate =
    totalFeesExpected > 0
      ? (totalCollected / totalFeesExpected) * 100
      : totalEnrolled > 0
        ? 100
        : 0;

  return {
    organizationName: org?.name ?? "",
    seasonName: season.name,
    seasonDescription: season.description,
    startDate: season.start_date,
    endDate: season.end_date,
    feeAmount: Number(season.fee_amount),
    status: season.status,
    generatedAt: new Date().toISOString(),
    summary: {
      totalEnrolled,
      totalFeesExpected,
      totalCollected,
      totalOutstanding,
      collectionRate,
    },
    enrollments: reportEnrollments,
  };
}
