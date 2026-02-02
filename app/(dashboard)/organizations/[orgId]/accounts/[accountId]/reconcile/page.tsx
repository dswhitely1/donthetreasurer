import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getReconciledBalance } from "@/lib/balances";
import { ReconcileSetupForm } from "./reconcile-setup-form";

export default async function ReconcileSetupPage({
  params,
}: {
  params: Promise<{ orgId: string; accountId: string }>;
}) {
  const { orgId, accountId } = await params;
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

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, opening_balance")
    .eq("id", accountId)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .single();

  if (!account) {
    notFound();
  }

  // Check for existing in_progress session — redirect to it
  const { data: existingSession } = await supabase
    .from("reconciliation_sessions")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "in_progress")
    .maybeSingle();

  if (existingSession) {
    redirect(
      `/organizations/${orgId}/accounts/${accountId}/reconcile/${existingSession.id}`
    );
  }

  // Compute last reconciled balance
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, transaction_type, status")
    .eq("account_id", accountId);

  const lastReconciledBalance = getReconciledBalance(
    account.opening_balance ?? 0,
    transactions ?? []
  );

  return (
    <div>
      <Link
        href={`/organizations/${orgId}/accounts/${accountId}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to account
      </Link>

      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Reconcile: {account.name}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your bank statement details to begin reconciliation.
      </p>

      <ReconcileSetupForm
        accountId={accountId}
        lastReconciledBalance={lastReconciledBalance}
      />
    </div>
  );
}
