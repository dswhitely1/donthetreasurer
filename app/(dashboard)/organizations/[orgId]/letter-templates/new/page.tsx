import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";

import { LetterTemplateForm } from "../letter-template-form";

export default async function NewLetterTemplatePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Letter Template"
        description="Write the letter once, then generate it for every family who owes."
      />
      <LetterTemplateForm mode="create" orgId={orgId} />
    </div>
  );
}
