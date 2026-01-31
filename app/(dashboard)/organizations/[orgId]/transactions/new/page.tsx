import { notFound } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "../transaction-form";

export default async function NewTransactionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
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
    .select("id, name, account_type")
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground">
            No accounts yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an account before adding transactions.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/organizations/${orgId}/accounts/new`}>
              Create Account
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TransactionForm
      mode="create"
      accounts={accounts}
      categories={categories ?? []}
    />
  );
}
