import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Mail } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fetchSeasonReport } from "@/lib/seasons/fetch-season-report";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

import { GenerateLettersForm } from "./generate-letters-form";

export default async function GenerateLettersPage({
  params,
}: {
  params: Promise<{ orgId: string; seasonId: string }>;
}) {
  const { orgId, seasonId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled, director_name")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const report = await fetchSeasonReport(supabase, seasonId);
  if (!report) notFound();

  const { data: templates } = await supabase
    .from("letter_templates")
    .select("id, name, is_default, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });

  const templateRows = templates ?? [];

  // Withdrawn students never receive a letter, even when they still owe.
  const candidates = report.enrollments
    .filter(
      (enrollment) =>
        enrollment.enrollmentStatus === "enrolled" && enrollment.balanceDue > 0
    )
    .map((enrollment) => ({
      enrollmentId: enrollment.id,
      studentName: enrollment.studentName,
      feeAmount: enrollment.feeAmount,
      totalPaid: enrollment.totalPaid,
      balanceDue: enrollment.balanceDue,
    }));

  // Prefer the marked default; otherwise the most recently updated template,
  // so the common case is still a single click.
  const defaultTemplateId =
    templateRows.find((template) => template.is_default)?.id ??
    templateRows[0]?.id ??
    "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Generate Letters"
        description={`${report.seasonName} — families with an outstanding balance`}
      />

      {!org.director_name && (
        <div className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          No director is recorded, so these letters will be unsigned.{" "}
          <Link href={`/organizations/${orgId}`} className="underline">
            Add one in organization settings
          </Link>
          .
        </div>
      )}

      {templateRows.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No letter templates yet"
          description="Create a template before generating letters for this season."
          action={{
            label: "New Template",
            href: `/organizations/${orgId}/letter-templates/new`,
          }}
        />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Everyone is paid up for this season"
          description="No enrolled student has an outstanding balance."
        />
      ) : (
        <GenerateLettersForm
          orgId={orgId}
          seasonId={seasonId}
          candidates={candidates}
          templates={templateRows.map((template) => ({
            id: template.id,
            name: template.name,
          }))}
          defaultTemplateId={defaultTemplateId}
        />
      )}
    </div>
  );
}
