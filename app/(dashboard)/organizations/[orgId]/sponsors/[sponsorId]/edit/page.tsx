import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { PageHeader } from "@/components/layout/page-header";

import { SponsorForm } from "../../sponsor-form";

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
      <div className="mt-6 max-w-2xl">
        <SponsorForm mode="edit" orgId={orgId} defaultValues={sponsor} />
      </div>
    </div>
  );
}
