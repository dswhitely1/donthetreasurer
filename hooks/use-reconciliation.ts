import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  finishReconciliation,
  cancelReconciliation,
  createQuickTransaction,
} from "@/app/(dashboard)/organizations/[orgId]/accounts/[accountId]/reconcile/actions";
import {
  reconciliationKeys,
  transactionKeys,
  accountKeys,
  reportKeys,
} from "./query-keys";

export interface ReconciliationTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  transaction_type: string;
  description: string;
  check_number: string | null;
  status: string;
  cleared_at: string | null;
  account_id: string;
  transaction_line_items: {
    id: string;
    amount: number;
    category_id: string;
    memo: string | null;
    categories: {
      id: string;
      name: string;
      parent_id: string | null;
      category_type: string;
    } | null;
  }[];
}

export function useReconciliationTransactions(
  accountId: string,
  statementDate: string
) {
  return useQuery({
    queryKey: reconciliationKeys.list(accountId),
    queryFn: async (): Promise<ReconciliationTransaction[]> => {
      const supabase = createClient();

      // Fetch uncleared + cleared transactions for this account up to statement date
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id,
          transaction_date,
          amount,
          transaction_type,
          description,
          check_number,
          status,
          cleared_at,
          account_id,
          transaction_line_items(
            id,
            amount,
            category_id,
            memo,
            categories(id, name, parent_id, category_type)
          )
        `
        )
        .eq("account_id", accountId)
        .in("status", ["uncleared", "cleared"])
        .lte("transaction_date", statementDate)
        .order("transaction_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ReconciliationTransaction[];
    },
  });
}

export function useFinishReconciliation(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      sessionId,
      accountId,
      transactionIds,
    }: {
      sessionId: string;
      accountId: string;
      transactionIds: string[];
    }) => {
      const formData = new FormData();
      formData.set("session_id", sessionId);
      formData.set("account_id", accountId);
      formData.set("transaction_ids", transactionIds.join(","));

      const result = await finishReconciliation(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({
        queryKey: accountKeys.balances(orgId),
      });
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
      router.refresh();
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useCancelReconciliation(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      sessionId,
      accountId,
    }: {
      sessionId: string;
      accountId: string;
    }) => {
      const formData = new FormData();
      formData.set("session_id", sessionId);
      formData.set("account_id", accountId);

      const result = await cancelReconciliation(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
      router.refresh();
    },
  });
}

export function useCreateQuickTransaction(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      accountId: string;
      sessionId: string;
      transactionDate: string;
      description: string;
      amount: number;
      transactionType: string;
      categoryId: string;
    }) => {
      const formData = new FormData();
      formData.set("account_id", input.accountId);
      formData.set("session_id", input.sessionId);
      formData.set("transaction_date", input.transactionDate);
      formData.set("description", input.description);
      formData.set("amount", String(input.amount));
      formData.set("transaction_type", input.transactionType);
      formData.set("category_id", input.categoryId);

      const result = await createQuickTransaction(null, formData);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.transaction_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({
        queryKey: accountKeys.balances(orgId),
      });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}
