import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import {
  getSponsorshipTerm,
  getNextSponsorshipTerm,
} from "@/lib/sponsors/sponsorship-year";
import { PageHeader } from "@/components/layout/page-header";

import { SponsorshipForm } from "../sponsorship-form";

export default async function NewSponsorshipPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ sponsor_id?: string; renew_from?: string }>;
}>) {
  const { orgId } = await params;
  const { sponsor_id: sponsorIdParam, renew_from: renewFrom } =
    await searchParams;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  let defaultTerm = getSponsorshipTerm(org.fiscal_year_start_month);
  let defaultLevelId: string | undefined;
  let defaultSponsorId =
    typeof sponsorIdParam === "string" ? sponsorIdParam : undefined;

  if (typeof renewFrom === "string") {
    const { data: previous } = await supabase
      .from("sponsorships")
      .select(
        "id, sponsor_id, level_id, term_start_date, term_end_date, sponsors!inner(organization_id)"
      )
      .eq("id", renewFrom)
      .eq("sponsors.organization_id", orgId)
      .single();

    if (previous) {
      // A renewal is a prefill, not a copy: nothing is written until the
      // treasurer submits, so a renewal that never gets paid leaves no row.
      defaultTerm = getNextSponsorshipTerm(
        previous.term_start_date,
        previous.term_end_date
      );
      defaultLevelId = previous.level_id;
      defaultSponsorId = previous.sponsor_id;
    }
  }

  const [{ data: sponsors }, { data: levels }] = await Promise.all([
    supabase
      .from("sponsors")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("sponsor_levels")
      .select("id, name, default_amount")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <div>
      <PageHeader title="Log Sponsorship Payment" />
      <div className="mt-6 max-w-2xl">
        <SponsorshipForm
          mode="create"
          orgId={orgId}
          sponsors={sponsors ?? []}
          levels={levels ?? []}
          defaultTerm={defaultTerm}
          defaultSponsorId={defaultSponsorId}
          defaultLevelId={defaultLevelId}
        />
      </div>
    </div>
  );
}
