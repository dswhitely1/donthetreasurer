import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ReconcileMatchingView } from "./reconcile-matching-view";

export default async function ReconcileMatchingPage({
  params,
}: {
  params: Promise<{ orgId: string; accountId: string; sessionId: string }>;
}) {
  const { orgId, accountId, sessionId } = await params;
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
    .select("id, name, organization_id")
    .eq("id", accountId)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .single();

  if (!account) {
    notFound();
  }

  // Fetch the session
  const { data: session } = await supabase
    .from("reconciliation_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("account_id", accountId)
    .single();

  if (!session) {
    notFound();
  }

  // Redirect away if session is no longer in_progress
  if (session.status !== "in_progress") {
    redirect(`/organizations/${orgId}/accounts/${accountId}`);
  }

  // Fetch categories for quick transaction dialog
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent_id, category_type")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  return (
    <ReconcileMatchingView
      session={{
        id: session.id,
        accountId: session.account_id,
        statementDate: session.statement_date,
        statementEndingBalance: Number(session.statement_ending_balance),
        startingBalance: Number(session.starting_balance),
      }}
      account={{ id: account.id, name: account.name }}
      orgId={orgId}
      categories={categories ?? []}
    />
  );
}
