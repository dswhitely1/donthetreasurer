import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import {
  formatTermLabel,
  getSponsorshipTerm,
} from "@/lib/sponsors/sponsorship-year";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

import { GenerateSponsorLettersForm } from "./generate-sponsor-letters-form";

export default async function SponsorLettersPage({
  params,
}: Readonly<{
  params: Promise<{ orgId: string }>;
}>) {
  const { orgId } = await params;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  const { data: director } = await supabase
    .from("organizations")
    .select("director_name")
    .eq("id", orgId)
    .single();

  // Every sponsorship in a term is a candidate regardless of deposit
  // state — a check in hand is money received whether or not the treasurer
  // has been to the bank. `transaction_id` is only used to show the
  // deposit marker, never to filter the list.
  const { data: sponsorshipRows } = await supabase
    .from("sponsorships")
    .select(
      "id, term_start_date, term_end_date, amount, transaction_id, sponsors!inner(name, organization_id), sponsor_levels(name)"
    )
    .eq("sponsors.organization_id", orgId)
    .order("term_start_date", { ascending: false });

  const sponsorships = sponsorshipRows ?? [];

  // Distinct terms, newest first.
  const uniqueTerms = [
    ...new Map(
      sponsorships.map((s) => [`${s.term_start_date}|${s.term_end_date}`, s])
    ).values(),
  ].map((t) => ({
    startDate: t.term_start_date,
    endDate: t.term_end_date,
    label: formatTermLabel(t.term_start_date, t.term_end_date),
  }));

  // Default to the org's current term when a sponsorship has actually been
  // logged for it; otherwise fall back to the newest term present, so a
  // future term logged ahead of time doesn't silently become the default.
  const currentTerm = getSponsorshipTerm(org.fiscal_year_start_month);
  const defaultTermKey = uniqueTerms.some(
    (t) => t.startDate === currentTerm.startDate && t.endDate === currentTerm.endDate
  )
    ? `${currentTerm.startDate}|${currentTerm.endDate}`
    : uniqueTerms[0]
      ? `${uniqueTerms[0].startDate}|${uniqueTerms[0].endDate}`
      : "";

  // A plain object, not a Map: Server Component props cross the RSC
  // boundary as serialized data, and a Map instance doesn't survive that.
  const candidatesByTerm: Record<
    string,
    {
      sponsorshipId: string;
      sponsorName: string;
      levelName: string | null;
      amount: number;
      isDeposited: boolean;
    }[]
  > = {};
  for (const s of sponsorships) {
    const key = `${s.term_start_date}|${s.term_end_date}`;
    const list = candidatesByTerm[key] ?? [];
    list.push({
      sponsorshipId: s.id,
      sponsorName: s.sponsors.name,
      levelName: s.sponsor_levels?.name ?? null,
      amount: s.amount,
      isDeposited: s.transaction_id !== null,
    });
    candidatesByTerm[key] = list;
  }

  // Sponsor acknowledgment letters use a disjoint placeholder vocabulary;
  // generating one from a season template would render every placeholder
  // blank with no validation error, so exclude those here.
  const { data: templates } = await supabase
    .from("letter_templates")
    .select("id, name, is_default, updated_at")
    .eq("organization_id", orgId)
    .eq("template_type", "sponsor_acknowledgment")
    .order("updated_at", { ascending: false });

  const templateRows = templates ?? [];

  // Prefer the marked default; otherwise the most recently updated template,
  // so the common case is still a single click.
  const defaultTemplateId =
    templateRows.find((template) => template.is_default)?.id ??
    templateRows[0]?.id ??
    "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sponsor Letters"
        description="Generate 501(c)(3) acknowledgment letters for a sponsorship year."
      />

      {!director?.director_name && (
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
          title="No sponsor letter templates yet"
          description="Create a sponsor acknowledgment template before generating letters."
          action={{
            label: "New Template",
            href: `/organizations/${orgId}/letter-templates/new`,
          }}
        />
      ) : uniqueTerms.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No sponsorships recorded yet"
          description="Log a sponsorship before generating acknowledgment letters."
        />
      ) : (
        <GenerateSponsorLettersForm
          orgId={orgId}
          terms={uniqueTerms}
          defaultTermKey={defaultTermKey}
          candidatesByTerm={candidatesByTerm}
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
