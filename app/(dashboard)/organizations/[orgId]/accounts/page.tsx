import Link from "next/link";
import { notFound } from "next/navigation";
import { Circle, CircleCheck, Lock, Plus, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validations/account";
import { getAccountBalances } from "@/lib/balances";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  // Verify org exists and user has access (RLS)
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  const activeAccounts = accounts ?? [];
  const accountIds = activeAccounts.map((a) => a.id);

  // Fetch transactions for all active accounts to compute balances
  const { data: transactions } = accountIds.length > 0
    ? await supabase
        .from("transactions")
        .select("account_id, amount, transaction_type, status")
        .in("account_id", accountIds)
    : { data: [] };

  const balanceMap = getAccountBalances(activeAccounts, transactions ?? []);

  return (
    <div>
      <PageHeader title="Accounts" description={`Manage financial accounts for ${organization.name}.`}>
        <Button asChild>
          <Link href={`/organizations/${orgId}/accounts/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Account
          </Link>
        </Button>
      </PageHeader>

      {!accounts || accounts.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            description="Create your first account to start tracking transactions."
            action={{ label: "New Account", href: `/organizations/${orgId}/accounts/new` }}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/organizations/${orgId}/accounts/${account.id}`}
            >
              <Card className="rounded-xl shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base">{account.name}</CardTitle>
                  {account.description && (
                    <CardDescription>{account.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {ACCOUNT_TYPE_LABELS[
                        account.account_type as keyof typeof ACCOUNT_TYPE_LABELS
                      ] ?? account.account_type}
                    </Badge>
                    <div className="text-right">
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {formatCurrency(
                          balanceMap.get(account.id)?.currentBalance ?? 0
                        )}
                      </span>
                      {(account.opening_balance ?? 0) !== 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Opening: {formatCurrency(account.opening_balance ?? 0)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Circle className="h-3 w-3 text-uncleared" />
                      {formatCurrency(balanceMap.get(account.id)?.statusNet.uncleared ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CircleCheck className="h-3 w-3 text-cleared" />
                      {formatCurrency(balanceMap.get(account.id)?.statusNet.cleared ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Lock className="h-3 w-3 text-reconciled" />
                      {formatCurrency(balanceMap.get(account.id)?.statusNet.reconciled ?? 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
