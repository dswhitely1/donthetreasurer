import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";

import { LetterTemplateForm } from "../../letter-template-form";

export default async function EditLetterTemplatePage({
  params,
}: {
  params: Promise<{ orgId: string; templateId: string }>;
}) {
  const { orgId, templateId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled) redirect(`/organizations/${orgId}`);

  const { data: template } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("id", templateId)
    .eq("organization_id", orgId)
    .single();

  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Edit Letter Template" description={template.name} />
      <LetterTemplateForm
        mode="edit"
        orgId={orgId}
        defaultValues={{
          id: template.id,
          name: template.name,
          heading: template.heading,
          body: template.body,
          closing: template.closing,
          is_default: template.is_default,
        }}
      />
    </div>
  );
}
