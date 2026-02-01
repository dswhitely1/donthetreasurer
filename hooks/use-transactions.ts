import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  bulkUpdateStatus,
  bulkDeleteTransactions,
} from "@/app/(dashboard)/organizations/[orgId]/transactions/actions";
import { transactionKeys, accountKeys, reportKeys } from "./query-keys";

import type { TransactionFilters } from "./query-keys";

export interface TransactionLineItem {
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
}

export interface TransactionWithLineItems {
  id: string;
  transaction_date: string;
  created_at: string | null;
  amount: number;
  transaction_type: string;
  description: string;
  check_number: string | null;
  status: string;
  cleared_at: string | null;
  account_id: string;
  accounts: { id: string; name: string } | null;
  transaction_line_items: TransactionLineItem[];
}

export function useTransactions(orgId: string, filters?: TransactionFilters) {
  return useQuery({
    queryKey: transactionKeys.list(orgId, filters),
    queryFn: async (): Promise<TransactionWithLineItems[]> => {
      const supabase = createClient();

      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          accounts!inner(id, name, organization_id),
          transaction_line_items(
            id,
            amount,
            category_id,
            memo,
            categories(id, name, parent_id, category_type)
          )
        `
        )
        .eq("accounts.organization_id", orgId);

      if (filters?.accountId) {
        query = query.eq("account_id", filters.accountId);
      }
      if (filters?.startDate) {
        query = query.gte("transaction_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("transaction_date", filters.endDate);
      }
      if (filters?.status && filters.status !== "all") {
        const statuses = filters.status.split(",").filter(Boolean);
        query = query.in("status", statuses);
      }

      const sortField = filters?.sort ?? "transaction_date";
      const ascending = filters?.order === "asc";
      query = query.order(sortField, { ascending });
      if (sortField !== "created_at") {
        query = query.order("created_at", { ascending });
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = (data ?? []) as TransactionWithLineItems[];

      // Post-fetch category filter
      if (filters?.categoryId) {
        result = result.filter((txn) =>
          txn.transaction_line_items.some(
            (li) => li.category_id === filters.categoryId
          )
        );
      }

      return result;
    },
  });
}

export function useBulkUpdateStatus(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      ids,
      status,
    }: {
      ids: string[];
      status: string;
    }) => {
      const formData = new FormData();
      formData.set("ids", ids.join(","));
      formData.set("status", status);
      formData.set("org_id", orgId);

      const result = await bulkUpdateStatus(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
      router.refresh();
    },
  });
}

export function useBulkDeleteTransactions(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const formData = new FormData();
      formData.set("ids", ids.join(","));
      formData.set("org_id", orgId);

      const result = await bulkDeleteTransactions(null, formData);
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
      router.refresh();
    },
  });
}
