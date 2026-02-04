import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computePaymentStatus } from "@/lib/seasons/payment-status";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUSES } from "@/lib/validations/season";
import { SeasonActions } from "./season-actions";
import { EnrollStudentsDialog } from "./enroll-students-dialog";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { PaymentHistoryDialog } from "./payment-history-dialog";
import { EnrollmentActions } from "./enrollment-actions";

import type { Tables } from "@/types/database";

function PaymentStatusBadge({ status }: Readonly<{ status: string }>) {
  const variant =
    status === "paid"
      ? "default"
      : status === "overpaid"
        ? "destructive"
        : status === "partial"
          ? "outline"
          : "secondary";
  return (
    <Badge variant={variant}>
      {PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS] ??
        status}
    </Badge>
  );
}

const SORT_OPTIONS = ["name", "status", "balance"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

export default async function SeasonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; seasonId: string }>;
  searchParams: Promise<{ sort?: string; filter?: string }>;
}) {
  const { orgId, seasonId } = await params;
  const { sort: sortParam, filter: filterParam } = await searchParams;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId)
    .single();

  if (!season) notFound();

  // Fetch enrollments with full payment details for history dialogs
  const { data: enrollments } = await supabase
    .from("season_enrollments")
    .select(
      "*, student:students(first_name, last_name), season_payments(id, enrollment_id, payment_date, amount, payment_method, notes, created_at, updated_at)"
    )
    .eq("season_id", seasonId)
    .order("enrolled_at", { ascending: true });

  // Fetch active students not already enrolled for the enroll dialog
  const enrolledStudentIds = (enrollments ?? []).map((e) => e.student_id);
  const { data: availableStudents } = await supabase
    .from("students")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("last_name")
    .order("first_name");

  const filteredAvailable = (availableStudents ?? []).filter(
    (s) => !enrolledStudentIds.includes(s.id)
  );

  const enrollmentRows = (enrollments ?? []).map((e) => {
    const payments = (e.season_payments ?? []) as Tables<"season_payments">[];
    const totalPaid = payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const balance = Number(e.fee_amount) - totalPaid;
    const paymentStatus = computePaymentStatus(Number(e.fee_amount), totalPaid);
    return { ...e, payments, totalPaid, balance, paymentStatus };
  });

  const hasEnrollments = enrollmentRows.length > 0;
  const totalEnrolled = enrollmentRows.length;
  const totalFees = enrollmentRows.reduce(
    (sum, e) => sum + Number(e.fee_amount),
    0
  );
  const totalCollected = enrollmentRows.reduce(
    (sum, e) => sum + e.totalPaid,
    0
  );
  const totalOutstanding = totalFees - totalCollected;

  // Sorting and filtering
  const sort: SortOption = SORT_OPTIONS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : "name";
  const statusFilter = PAYMENT_STATUSES.includes(filterParam as typeof PAYMENT_STATUSES[number])
    ? filterParam
    : undefined;

  let displayRows = [...enrollmentRows];

  if (statusFilter) {
    displayRows = displayRows.filter((e) => e.paymentStatus === statusFilter);
  }

  displayRows.sort((a, b) => {
    if (sort === "status") {
      return a.paymentStatus.localeCompare(b.paymentStatus);
    }
    if (sort === "balance") {
      return b.balance - a.balance;
    }
    // default: name
    const aStudent = a.student as { first_name: string; last_name: string };
    const bStudent = b.student as { first_name: string; last_name: string };
    const nameA = `${aStudent.last_name}, ${aStudent.first_name}`;
    const nameB = `${bStudent.last_name}, ${bStudent.first_name}`;
    return nameA.localeCompare(nameB);
  });

  const basePath = `/organizations/${orgId}/seasons/${seasonId}`;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {season.name}
            </h1>
            <Badge
              variant={season.status === "active" ? "default" : "secondary"}
            >
              {season.status === "active" ? "Active" : "Archived"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(season.start_date)} &ndash;{" "}
            {formatDate(season.end_date)}
            {season.description && ` \u2014 ${season.description}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link
              href={`/organizations/${orgId}/seasons/${seasonId}/edit`}
            >
              Edit
            </Link>
          </Button>
          <EnrollStudentsDialog
            seasonId={seasonId}
            defaultFee={Number(season.fee_amount)}
            availableStudents={filteredAvailable}
          />
        </div>
      </div>

      <div className="mt-4">
        <SeasonActions
          season={season}
          orgId={orgId}
          hasEnrollments={hasEnrollments}
        />
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Enrolled Students</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {totalEnrolled}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Fees Expected</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {formatCurrency(totalFees)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Collected</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
            {formatCurrency(totalCollected)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
      </div>

      {/* Enrollment Table */}
      <div className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Enrollments</h2>
          {hasEnrollments && (
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 rounded-md border border-border p-0.5 text-sm">
                <Link
                  href={`${basePath}?sort=name${statusFilter ? `&filter=${statusFilter}` : ""}`}
                  className={`rounded px-2 py-1 ${sort === "name" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  Name
                </Link>
                <Link
                  href={`${basePath}?sort=status${statusFilter ? `&filter=${statusFilter}` : ""}`}
                  className={`rounded px-2 py-1 ${sort === "status" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  Status
                </Link>
                <Link
                  href={`${basePath}?sort=balance${statusFilter ? `&filter=${statusFilter}` : ""}`}
                  className={`rounded px-2 py-1 ${sort === "balance" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  Balance
                </Link>
              </div>
              <div className="flex gap-1 rounded-md border border-border p-0.5 text-sm">
                <Link
                  href={`${basePath}?sort=${sort}`}
                  className={`rounded px-2 py-1 ${!statusFilter ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  All
                </Link>
                {PAYMENT_STATUSES.map((status) => (
                  <Link
                    key={status}
                    href={`${basePath}?sort=${sort}&filter=${status}`}
                    className={`rounded px-2 py-1 ${statusFilter === status ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                  >
                    {PAYMENT_STATUS_LABELS[status]}
                  </Link>
                ))}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/organizations/${orgId}/seasons/${seasonId}/export`}>
                    Export Excel
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/organizations/${orgId}/seasons/${seasonId}/export/pdf`}>
                    Export PDF
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>

        {!hasEnrollments ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              No students enrolled yet. Use the &ldquo;Enroll Students&rdquo;
              button to add students to this season.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2.5 text-left font-medium">
                    Student Name
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">Fee</th>
                  <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Balance
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((enrollment) => {
                  const student = enrollment.student as {
                    first_name: string;
                    last_name: string;
                  };
                  const studentName = `${student.last_name}, ${student.first_name}`;
                  const isOverridden =
                    Number(enrollment.fee_amount) !==
                    Number(season.fee_amount);
                  const hasPayments = enrollment.payments.length > 0;

                  return (
                    <tr
                      key={enrollment.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-3 py-2.5 font-medium">
                        {studentName}
                        {enrollment.status === "withdrawn" && (
                          <Badge variant="secondary" className="ml-2">
                            Withdrawn
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrency(Number(enrollment.fee_amount))}
                        {isOverridden && (
                          <span
                            className="ml-1 text-xs text-muted-foreground"
                            title={
                              enrollment.fee_override_reason ?? "Fee overridden"
                            }
                          >
                            *
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrency(enrollment.totalPaid)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCurrency(enrollment.balance)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <PaymentStatusBadge
                          status={enrollment.paymentStatus}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <RecordPaymentDialog
                            enrollmentId={enrollment.id}
                            studentName={studentName}
                            balance={enrollment.balance}
                          />
                          <PaymentHistoryDialog
                            studentName={studentName}
                            payments={enrollment.payments}
                          />
                          <EnrollmentActions
                            enrollmentId={enrollment.id}
                            enrollmentStatus={enrollment.status}
                            hasPayments={hasPayments}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
