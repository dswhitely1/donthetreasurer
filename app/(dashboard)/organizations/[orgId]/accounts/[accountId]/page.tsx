import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validations/account";
import { getAccountBalances } from "@/lib/balances";
import { formatCurrency } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountActions } from "./account-actions";

export default async function AccountDetailPage({
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
    .select("*")
    .eq("id", accountId)
    .eq("organization_id", orgId)
    .single();

  if (!account) {
    notFound();
  }

  // Fetch transactions to compute balance
  const { data: transactions } = await supabase
    .from("transactions")
    .select("account_id, amount, transaction_type")
    .eq("account_id", accountId);

  const balanceMap = getAccountBalances([account], transactions ?? []);
  const balance = balanceMap.get(account.id);
  const currentBalance = balance?.currentBalance ?? (account.opening_balance ?? 0);
  const totalIncome = balance?.totalIncome ?? 0;
  const totalExpense = balance?.totalExpense ?? 0;

  const typeLabel =
    ACCOUNT_TYPE_LABELS[
      account.account_type as keyof typeof ACCOUNT_TYPE_LABELS
    ] ?? account.account_type;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/organizations/${orgId}/accounts`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to accounts
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle>{account.name}</CardTitle>
            <Badge variant="secondary">{typeLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {account.description && (
              <div className="col-span-2">
                <dt className="font-medium text-muted-foreground">
                  Description
                </dt>
                <dd className="mt-1 text-foreground">{account.description}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-muted-foreground">
                Opening Balance
              </dt>
              <dd className="mt-1 text-foreground">
                {formatCurrency(account.opening_balance ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Current Balance
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {formatCurrency(currentBalance)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Total Income
              </dt>
              <dd className="mt-1 tabular-nums text-green-600 dark:text-green-400">
                {formatCurrency(totalIncome)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Total Expenses
              </dt>
              <dd className="mt-1 tabular-nums text-red-600 dark:text-red-400">
                {formatCurrency(totalExpense)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1 text-foreground">
                {account.created_at
                  ? new Date(account.created_at).toLocaleDateString()
                  : "N/A"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Last Updated
              </dt>
              <dd className="mt-1 text-foreground">
                {account.updated_at
                  ? new Date(account.updated_at).toLocaleDateString()
                  : "N/A"}
              </dd>
            </div>
          </dl>

          <AccountActions account={account} orgId={orgId} />
        </CardContent>
      </Card>
    </div>
  );
}
