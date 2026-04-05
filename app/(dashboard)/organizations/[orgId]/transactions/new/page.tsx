import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "../transaction-form";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NewTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { orgId } = await params;
  const { saved } = await searchParams;
  const supabase = await createClient();

  // Verify org exists and user has access
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  // Fetch active accounts for this org
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, account_type, fee_percentage, fee_flat_amount, fee_category_id")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  // Fetch active categories for this org
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, category_type, parent_id")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (!accounts || accounts.length === 0) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Create an account before adding transactions."
          action={{ label: "Create Account", href: `/organizations/${orgId}/accounts/new` }}
        />
      </div>
    );
  }

  return (
    <TransactionForm
      mode="create"
      accounts={accounts}
      categories={categories ?? []}
      showSaved={saved === "true"}
    />
  );
}
