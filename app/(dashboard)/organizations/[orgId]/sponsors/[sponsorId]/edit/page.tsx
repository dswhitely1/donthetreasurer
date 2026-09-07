import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { PageHeader } from "@/components/layout/page-header";

import { DeleteSponsorButton, SponsorForm } from "../../sponsor-form";

export default async function EditSponsorPage({
  params,
}: Readonly<{
  params: Promise<{ orgId: string; sponsorId: string }>;
}>) {
  const { orgId, sponsorId } = await params;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("*")
    .eq("id", sponsorId)
    .eq("organization_id", orgId)
    .single();

  if (!sponsor) notFound();

  return (
    <div>
      <PageHeader title="Edit Sponsor" />
      <div className="mt-6 flex max-w-2xl flex-col gap-6">
        <SponsorForm mode="edit" orgId={orgId} defaultValues={sponsor} />
        <div className="flex flex-col gap-2 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Deleting a sponsor with sponsorship history is blocked — mark
            them inactive instead.
          </p>
          <div>
            <DeleteSponsorButton sponsorId={sponsorId} orgId={orgId} />
          </div>
        </div>
      </div>
    </div>
  );
}
