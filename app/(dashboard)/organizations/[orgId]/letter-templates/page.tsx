import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Mail } from "lucide-react";

import {
  LETTER_TEMPLATE_TYPES,
  LETTER_TEMPLATE_TYPE_LABELS,
} from "@/lib/letters/placeholders";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { TemplateActions } from "./template-actions";

import type { LetterTemplateType } from "@/lib/letters/placeholders";
import type { Database } from "@/types/database";

type LetterTemplateRow = Database["public"]["Tables"]["letter_templates"]["Row"];

function TemplateTable({
  rows,
  orgId,
}: Readonly<{ rows: LetterTemplateRow[]; orgId: string }>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Heading</th>
            <th className="px-4 py-2 text-left font-medium">Updated</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((template) => (
            <tr key={template.id} className="border-t border-border">
              <td className="px-4 py-2">
                <Link
                  href={`/organizations/${orgId}/letter-templates/${template.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {template.name}
                </Link>
                {template.is_default && (
                  <Badge variant="default" className="ml-2">
                    Default
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {template.heading ?? "—"}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {template.updated_at ? formatDateTime(template.updated_at) : "—"}
              </td>
              <td className="px-4 py-2">
                <TemplateActions
                  templateId={template.id}
                  orgId={orgId}
                  isDefault={template.is_default}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function LetterTemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, seasons_enabled, sponsors_enabled, director_name")
    .eq("id", orgId)
    .single();

  if (!org) notFound();
  if (!org.seasons_enabled && !org.sponsors_enabled) {
    redirect(`/organizations/${orgId}`);
  }

  const { data: templates } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  const rows = templates ?? [];

  const pageDescription =
    org.seasons_enabled && org.sponsors_enabled
      ? "Reusable letters for families with an outstanding season balance and sponsors who need a 501(c)(3) acknowledgment."
      : org.sponsors_enabled
        ? "Reusable 501(c)(3) acknowledgment letters for sponsors."
        : "Reusable letters for families with an outstanding season balance.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Letter Templates" description={pageDescription}>
        <Button asChild>
          <Link href={`/organizations/${orgId}/letter-templates/new`}>
            New Template
          </Link>
        </Button>
      </PageHeader>

      {!org.director_name && (
        <div className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          No director is recorded for this organization, so letters will be
          unsigned.{" "}
          <Link href={`/organizations/${orgId}`} className="underline">
            Add one in organization settings
          </Link>
          .
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No letter templates yet"
          description="Create a template to generate letters."
        />
      ) : (
        LETTER_TEMPLATE_TYPES.map((type: LetterTemplateType) => {
          const typeRows = rows.filter(
            (template) => template.template_type === type
          );
          if (typeRows.length === 0) return null;

          return (
            <div key={type} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">
                {LETTER_TEMPLATE_TYPE_LABELS[type]}
              </h2>
              <TemplateTable rows={typeRows} orgId={orgId} />
            </div>
          );
        })
      )}
    </div>
  );
}
