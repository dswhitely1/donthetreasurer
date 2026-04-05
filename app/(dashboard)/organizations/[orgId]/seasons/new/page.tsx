import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SeasonForm } from "../season-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewSeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { orgId } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  return (
    <div>
      <PageHeader title="New Season" />
      <div className="mt-6 max-w-2xl">
        <SeasonForm mode="create" orgId={orgId} showSaved={saved === "true"} />
      </div>
    </div>
  );
}
