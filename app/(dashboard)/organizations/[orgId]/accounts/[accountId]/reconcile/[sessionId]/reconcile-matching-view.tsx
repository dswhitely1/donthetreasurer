"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, AlertTriangle } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useReconciliationTransactions,
  useFinishReconciliation,
  useCancelReconciliation,
} from "@/hooks/use-reconciliation";
import { QuickTransactionDialog } from "./quick-transaction-dialog";

interface SessionData {
  id: string;
  accountId: string;
  statementDate: string;
  statementEndingBalance: number;
  startingBalance: number;
}

interface AccountData {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  category_type: string;
}

interface ReconcileMatchingViewProps {
  session: SessionData;
  account: AccountData;
  orgId: string;
  categories: Category[];
}

export function ReconcileMatchingView({
  session,
  account,
  orgId,
  categories,
}: ReconcileMatchingViewProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { data: transactions, isLoading } = useReconciliationTransactions(
    session.accountId,
    session.statementDate
  );

  const finishMutation = useFinishReconciliation(orgId);
  const cancelMutation = useCancelReconciliation(orgId);

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!transactions) return;
    setCheckedIds((prev) => {
      if (prev.size === transactions.length) {
        return new Set();
      }
      return new Set(transactions.map((t) => t.id));
    });
  }, [transactions]);

  const { clearedBalance, difference, isBalanced } = useMemo(() => {
    if (!transactions) {
      return { clearedBalance: session.startingBalance, difference: session.startingBalance - session.statementEndingBalance, isBalanced: false };
    }

    let checkedTotal = 0;
    for (const txn of transactions) {
      if (!checkedIds.has(txn.id)) continue;
      if (txn.transaction_type === "income") {
        checkedTotal += txn.amount;
      } else {
        checkedTotal -= txn.amount;
      }
    }

    const cleared = session.startingBalance + checkedTotal;
    const diff = cleared - session.statementEndingBalance;
    return {
      clearedBalance: cleared,
      difference: diff,
      isBalanced: Math.abs(diff) < 0.01,
    };
  }, [transactions, checkedIds, session.startingBalance, session.statementEndingBalance]);

  const handleFinish = () => {
    finishMutation.mutate({
      sessionId: session.id,
      accountId: session.accountId,
      transactionIds: Array.from(checkedIds),
    });
  };

  const handleCancel = () => {
    cancelMutation.mutate({
      sessionId: session.id,
      accountId: session.accountId,
    });
  };

  const handleQuickTransactionCreated = (txnId: string) => {
    setCheckedIds((prev) => new Set(prev).add(txnId));
    setShowQuickAdd(false);
  };

  const allChecked = transactions ? checkedIds.size === transactions.length && transactions.length > 0 : false;

  return (
    <div>
      <Link
        href={`/organizations/${orgId}/accounts/${account.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to account
      </Link>

      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Reconcile: {account.name}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Statement date: {formatDate(session.statementDate)}
      </p>

      {/* Summary panel */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Starting Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(session.startingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cleared Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(clearedBalance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {checkedIds.size} item{checkedIds.size !== 1 ? "s" : ""} checked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Statement Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(session.statementEndingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-xl font-bold tabular-nums ${
                isBalanced
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(difference)}
            </p>
            {isBalanced && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                Balanced
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions bar */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          onClick={handleFinish}
          disabled={!isBalanced || checkedIds.size === 0 || finishMutation.isPending}
        >
          {finishMutation.isPending ? "Finishing..." : "Finish Reconciliation"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowQuickAdd(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Transaction
        </Button>
        {!showCancelConfirm ? (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => setShowCancelConfirm(true)}
          >
            Cancel Reconciliation
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Are you sure?</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCancelConfirm(false)}
            >
              No
            </Button>
          </div>
        )}
      </div>

      {finishMutation.error && (
        <p className="mt-2 text-sm text-destructive">
          {finishMutation.error.message}
        </p>
      )}
      {cancelMutation.error && (
        <p className="mt-2 text-sm text-destructive">
          {cancelMutation.error.message}
        </p>
      )}

      {/* Transaction list */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Transactions</CardTitle>
            {transactions && transactions.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-sm text-primary hover:underline"
              >
                {allChecked ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading transactions...
            </p>
          ) : !transactions || transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No uncleared or cleared transactions found for this period.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((txn) => {
                const isChecked = checkedIds.has(txn.id);
                const isIncome = txn.transaction_type === "income";

                return (
                  <label
                    key={txn.id}
                    className="flex cursor-pointer items-center gap-3 px-1 py-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleCheck(txn.id)}
                    />
                    <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatDate(txn.transaction_date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {txn.description}
                    </span>
                    {txn.check_number && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        #{txn.check_number}
                      </span>
                    )}
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-xs"
                    >
                      {txn.status}
                    </Badge>
                    <span
                      className={`w-28 shrink-0 text-right text-sm font-medium tabular-nums ${
                        isIncome
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {formatCurrency(txn.amount)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick transaction dialog */}
      <QuickTransactionDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        accountId={session.accountId}
        sessionId={session.id}
        orgId={orgId}
        statementDate={session.statementDate}
        categories={categories}
        onCreated={handleQuickTransactionCreated}
      />
    </div>
  );
}
