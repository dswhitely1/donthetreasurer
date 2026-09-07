import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import { PageHeader } from "@/components/layout/page-header";

import { SponsorForm } from "../sponsor-form";

export default async function NewSponsorPage({
  params,
}: Readonly<{
  params: Promise<{ orgId: string }>;
}>) {
  const { orgId } = await params;
  const supabase = await createClient();

  const org = await fetchSponsorsOrg(supabase, orgId);
  if (!org) notFound();

  return (
    <div>
      <PageHeader title="Add Sponsor" />
      <div className="mt-6 max-w-2xl">
        <SponsorForm mode="create" orgId={orgId} />
      </div>
    </div>
  );
}
