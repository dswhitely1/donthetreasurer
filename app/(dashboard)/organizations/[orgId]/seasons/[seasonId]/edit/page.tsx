import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SeasonForm } from "../../season-form";

export default async function EditSeasonPage({
  params,
}: {
  params: Promise<{ orgId: string; seasonId: string }>;
}) {
  const { orgId, seasonId } = await params;
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

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Edit Season</h1>
      <div className="mt-6 max-w-2xl">
        <SeasonForm mode="edit" orgId={orgId} defaultValues={season} />
      </div>
    </div>
  );
}
