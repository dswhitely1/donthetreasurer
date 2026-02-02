import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { TemplateForm } from "../template-form";

export default async function NewTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: Promise<{ from_transaction?: string }>;
}) {
  const { orgId } = await params;
  const { from_transaction: fromTransactionId } = (await searchParams) ?? {};
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

  // Fetch accounts and categories
  const [accountsResult, categoriesResult] = await Promise.all([
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

  const accounts = accountsResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  // Pre-populate from existing transaction if provided
  let defaultValues: {
    id: string;
    account_id: string;
    transaction_type: string;
    amount: number;
    description: string;
    vendor: string | null;
    check_number: string | null;
    recurrence_rule: string;
    start_date: string;
    end_date: string | null;
    line_items: Array<{
      category_id: string;
      amount: number;
      memo: string | null;
    }>;
  } | undefined;

  if (fromTransactionId) {
    const { data: txn } = await supabase
      .from("transactions")
      .select(
        `
        *,
        accounts!inner(id, organization_id),
        transaction_line_items(
          category_id, amount, memo
        )
      `
      )
      .eq("id", fromTransactionId)
      .eq("accounts.organization_id", orgId)
      .single();

    if (txn) {
      defaultValues = {
        id: "",
        account_id: txn.account_id,
        transaction_type: txn.transaction_type,
        amount: txn.amount,
        description: txn.description,
        vendor: txn.vendor,
        check_number: txn.check_number,
        recurrence_rule: "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: null,
        line_items: (txn.transaction_line_items ?? []).map(
          (li: { category_id: string; amount: number; memo: string | null }) => ({
            category_id: li.category_id,
            amount: li.amount,
            memo: li.memo,
          })
        ),
      };
    }
  }

  return (
    <TemplateForm
      mode="create"
      accounts={accounts}
      categories={categories}
      orgId={orgId}
      defaultValues={defaultValues}
    />
  );
}
