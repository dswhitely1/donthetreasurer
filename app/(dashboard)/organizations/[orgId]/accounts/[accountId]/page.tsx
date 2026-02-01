import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Circle, CircleCheck, Lock } from "lucide-react";

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

  // Fetch active expense categories for fee config
  const { data: expenseCategories } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("organization_id", orgId)
    .eq("category_type", "expense")
    .eq("is_active", true)
    .order("name");

  // Fetch transactions to compute balance
  const { data: transactions } = await supabase
    .from("transactions")
    .select("account_id, amount, transaction_type, status")
    .eq("account_id", accountId);

  const balanceMap = getAccountBalances([account], transactions ?? []);
  const balance = balanceMap.get(account.id);
  const currentBalance = balance?.currentBalance ?? (account.opening_balance ?? 0);
  const totalIncome = balance?.totalIncome ?? 0;
  const totalExpense = balance?.totalExpense ?? 0;
  const statusNet = balance?.statusNet ?? { uncleared: 0, cleared: 0, reconciled: 0 };

  const typeLabel =
    ACCOUNT_TYPE_LABELS[
      account.account_type as keyof typeof ACCOUNT_TYPE_LABELS
    ] ?? account.account_type;

  return (
    <div>
      <Link
        href={`/organizations/${orgId}/accounts`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to accounts
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {account.name}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{typeLabel}</Badge>
            {account.description && (
              <span className="text-sm text-muted-foreground">
                {account.description}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status balance cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(currentBalance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Opening: {formatCurrency(account.opening_balance ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Circle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                Uncleared
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(statusNet.uncleared)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CircleCheck className="h-3 w-3 text-green-600 dark:text-green-400" />
                Cleared
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(statusNet.cleared)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                Reconciled
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(statusNet.reconciled)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account details */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-4">
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

            {/* Fee configuration */}
            {(account.fee_percentage || account.fee_flat_amount) && (
              <div className="mt-4 border-t border-border pt-4">
                <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                  Processing Fee Configuration
                </h4>
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  {account.fee_percentage != null && account.fee_percentage > 0 && (
                    <div>
                      <dt className="font-medium text-muted-foreground">Percentage</dt>
                      <dd className="mt-1 text-foreground">{account.fee_percentage}%</dd>
                    </div>
                  )}
                  {account.fee_flat_amount != null && account.fee_flat_amount > 0 && (
                    <div>
                      <dt className="font-medium text-muted-foreground">Flat Amount</dt>
                      <dd className="mt-1 text-foreground">{formatCurrency(account.fee_flat_amount)}</dd>
                    </div>
                  )}
                  {account.fee_category_id && (
                    <div>
                      <dt className="font-medium text-muted-foreground">Fee Category</dt>
                      <dd className="mt-1 text-foreground">
                        {(() => {
                          const cat = (expenseCategories ?? []).find((c) => c.id === account.fee_category_id);
                          if (!cat) return "Unknown";
                          if (cat.parent_id) {
                            const parent = (expenseCategories ?? []).find((c) => c.id === cat.parent_id);
                            return parent ? `${parent.name} → ${cat.name}` : cat.name;
                          }
                          return cat.name;
                        })()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <AccountActions
              account={account}
              orgId={orgId}
              expenseCategories={expenseCategories ?? []}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
