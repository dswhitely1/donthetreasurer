import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { getSponsorshipTerm } from "@/lib/sponsors/sponsorship-year";
import { PageHeader } from "@/components/layout/page-header";

import { SponsorshipForm } from "../../sponsorship-form";

export default async function EditSponsorshipPage({
  params,
}: Readonly<{
  params: Promise<{ orgId: string; sponsorshipId: string }>;
}>) {
  const { orgId, sponsorshipId } = await params;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  const { data: sponsorship } = await supabase
    .from("sponsorships")
    .select(
      "*, sponsors!inner(organization_id), transactions(transaction_date)"
    )
    .eq("id", sponsorshipId)
    .eq("sponsors.organization_id", orgId)
    .single();

  if (!sponsorship) notFound();

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
      // Include the sponsorship's current level even if it has since been
      // deactivated, so the select always has a match for its value.
      .or(`is_active.eq.true,id.eq.${sponsorship.level_id}`)
      .order("sort_order"),
  ]);

  return (
    <div>
      <PageHeader title="Edit Sponsorship" />
      <div className="mt-6 max-w-2xl">
        <SponsorshipForm
          mode="edit"
          orgId={orgId}
          sponsors={sponsors ?? []}
          levels={levels ?? []}
          defaultTerm={getSponsorshipTerm(org.fiscal_year_start_month)}
          defaultValues={sponsorship}
          depositDate={sponsorship.transactions?.transaction_date}
        />
      </div>
    </div>
  );
}
