import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  RECURRENCE_RULE_LABELS,
} from "@/lib/validations/recurring-template";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemplateRowActions } from "./[templateId]/template-actions";

import type { RecurrenceRule } from "@/lib/recurrence";

function getTemplateStatus(
  isActive: boolean,
  nextOccurrenceDate: string | null
): { label: string; variant: "default" | "secondary" | "outline" } {
  if (!isActive) {
    return { label: "Paused", variant: "secondary" };
  }
  if (!nextOccurrenceDate) {
    return { label: "Ended", variant: "outline" };
  }
  return { label: "Active", variant: "default" };
}

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  const { data: templates } = await supabase
    .from("recurring_templates")
    .select(
      `
      *,
      accounts!inner(id, name, organization_id),
      recurring_template_line_items(id)
    `
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const templateList = templates ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Recurring Templates
        </h2>
        <Button asChild>
          <Link href={`/organizations/${orgId}/templates/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Link>
        </Button>
      </div>

      {templateList.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No recurring templates yet. Create a template to automate
            transaction entry.
          </p>
          <Button asChild className="mt-3" size="sm">
            <Link href={`/organizations/${orgId}/templates/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Description
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Account
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Frequency
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Next Occurrence
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {templateList.map((tmpl) => {
                const isIncome = tmpl.transaction_type === "income";
                const accountName =
                  (tmpl.accounts as { id: string; name: string } | null)
                    ?.name ?? "Unknown";
                const status = getTemplateStatus(
                  tmpl.is_active,
                  tmpl.next_occurrence_date
                );
                const ruleLabel =
                  RECURRENCE_RULE_LABELS[
                    tmpl.recurrence_rule as RecurrenceRule
                  ] ?? tmpl.recurrence_rule;

                return (
                  <tr
                    key={tmpl.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/organizations/${orgId}/templates/${tmpl.id}`}
                        className="font-medium hover:underline"
                      >
                        {tmpl.description}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {accountName}
                    </td>
                    <td
                      className={`px-3 py-2.5 whitespace-nowrap text-right font-medium tabular-nums ${
                        isIncome
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {formatCurrency(tmpl.amount)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {ruleLabel}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {tmpl.next_occurrence_date
                        ? formatDate(tmpl.next_occurrence_date)
                        : "\u2014"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <TemplateRowActions
                        templateId={tmpl.id}
                        orgId={orgId}
                        isActive={tmpl.is_active}
                        hasNextOccurrence={!!tmpl.next_occurrence_date}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
