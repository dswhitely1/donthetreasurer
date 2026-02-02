import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TRANSACTION_TYPE_LABELS } from "@/lib/validations/transaction";
import {
  RECURRENCE_RULE_LABELS,
} from "@/lib/validations/recurring-template";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TemplateDetailActions } from "./template-actions";

import type { RecurrenceRule } from "@/lib/recurrence";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; templateId: string }>;
}) {
  const { orgId, templateId } = await params;
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

  // Fetch template with line items
  const { data: template } = await supabase
    .from("recurring_templates")
    .select(
      `
      *,
      accounts!inner(id, name, account_type, organization_id),
      recurring_template_line_items(
        id,
        amount,
        memo,
        category_id,
        categories(id, name, parent_id, category_type)
      )
    `
    )
    .eq("id", templateId)
    .eq("organization_id", orgId)
    .single();

  if (!template) {
    notFound();
  }

  // Fetch all categories for parent name resolution
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, category_type, parent_id")
    .eq("organization_id", orgId);

  const categoryNameMap = new Map(
    (allCategories ?? []).map((c) => [c.id, c.name])
  );

  // Fetch accounts and active categories for edit form
  const [accountsResult, activeCategoriesResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, account_type")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name, category_type, parent_id")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  // Fetch generated transactions
  const { data: generatedTransactions } = await supabase
    .from("transactions")
    .select("id, transaction_date, amount, transaction_type, description, status")
    .eq("template_id", templateId)
    .order("transaction_date", { ascending: false })
    .limit(20);

  const lineItems = template.recurring_template_line_items ?? [];

  const typeLabel =
    TRANSACTION_TYPE_LABELS[
      template.transaction_type as keyof typeof TRANSACTION_TYPE_LABELS
    ] ?? template.transaction_type;

  const ruleLabel =
    RECURRENCE_RULE_LABELS[template.recurrence_rule as RecurrenceRule] ??
    template.recurrence_rule;

  const isIncome = template.transaction_type === "income";

  const statusLabel = !template.is_active
    ? "Paused"
    : template.next_occurrence_date
      ? "Active"
      : "Ended";
  const statusVariant = !template.is_active
    ? ("secondary" as const)
    : template.next_occurrence_date
      ? ("default" as const)
      : ("outline" as const);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/organizations/${orgId}/templates`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to templates
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle>{template.description}</CardTitle>
            <div className="flex gap-2">
              <Badge
                variant="secondary"
                className={
                  isIncome
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }
              >
                {typeLabel}
              </Badge>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">Amount</dt>
              <dd
                className={`mt-1 text-lg font-semibold tabular-nums ${
                  isIncome
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {isIncome ? "+" : "-"}
                {formatCurrency(template.amount)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Frequency</dt>
              <dd className="mt-1 text-foreground">{ruleLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Account</dt>
              <dd className="mt-1 text-foreground">
                {template.accounts.name}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Next Occurrence
              </dt>
              <dd className="mt-1 text-foreground">
                {template.next_occurrence_date
                  ? formatDate(template.next_occurrence_date)
                  : "\u2014"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Start Date</dt>
              <dd className="mt-1 text-foreground">
                {formatDate(template.start_date)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">End Date</dt>
              <dd className="mt-1 text-foreground">
                {template.end_date
                  ? formatDate(template.end_date)
                  : "No end date"}
              </dd>
            </div>
            {template.vendor && (
              <div>
                <dt className="font-medium text-muted-foreground">Vendor</dt>
                <dd className="mt-1 text-foreground">{template.vendor}</dd>
              </div>
            )}
            {template.check_number && (
              <div>
                <dt className="font-medium text-muted-foreground">Check #</dt>
                <dd className="mt-1 text-foreground">
                  {template.check_number}
                </dd>
              </div>
            )}
          </dl>

          {/* Line Items Table */}
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Line Items
            </h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Category
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Memo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => {
                    const cat = li.categories;
                    let categoryDisplay: string;
                    if (cat && cat.parent_id) {
                      const parentName =
                        categoryNameMap.get(cat.parent_id) ?? "";
                      categoryDisplay = parentName
                        ? `${parentName} \u2192 ${cat.name}`
                        : cat.name;
                    } else if (cat) {
                      categoryDisplay = cat.name;
                    } else {
                      categoryDisplay = "Unknown";
                    }

                    return (
                      <tr
                        key={li.id}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2">{categoryDisplay}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(li.amount)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {li.memo || "\u2014"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-medium">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(template.amount)}
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <TemplateDetailActions
            template={{
              id: template.id,
              account_id: template.account_id,
              transaction_type: template.transaction_type,
              amount: template.amount,
              description: template.description,
              vendor: template.vendor,
              check_number: template.check_number,
              recurrence_rule: template.recurrence_rule,
              start_date: template.start_date,
              end_date: template.end_date,
              is_active: template.is_active,
              next_occurrence_date: template.next_occurrence_date,
            }}
            lineItems={lineItems.map((li) => ({
              category_id: li.category_id,
              amount: li.amount,
              memo: li.memo,
            }))}
            orgId={orgId}
            accounts={accountsResult.data ?? []}
            categories={activeCategoriesResult.data ?? []}
          />

          {/* Generated Transactions */}
          {generatedTransactions && generatedTransactions.length > 0 && (
            <div className="mt-6 border-t border-border pt-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Generated Transactions
              </h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedTransactions.map((txn) => (
                      <tr
                        key={txn.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(txn.transaction_date)}
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/organizations/${orgId}/transactions/${txn.id}`}
                            className="font-medium hover:underline"
                          >
                            {txn.description}
                          </Link>
                        </td>
                        <td
                          className={`px-3 py-2 whitespace-nowrap text-right tabular-nums ${
                            txn.transaction_type === "income"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {txn.transaction_type === "income" ? "+" : "-"}
                          {formatCurrency(txn.amount)}
                        </td>
                        <td className="px-3 py-2 capitalize text-muted-foreground">
                          {txn.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
