import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { getAccountBalances } from "@/lib/balances";
import { accountKeys } from "./query-keys";

import type { Tables } from "@/types/database";
import type { AccountBalance } from "@/lib/balances";

type Account = Tables<"accounts">;

export function useAccounts(orgId: string) {
  return useQuery({
    queryKey: accountKeys.list(orgId),
    queryFn: async (): Promise<Account[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useAccountBalances(orgId: string) {
  return useQuery({
    queryKey: accountKeys.balances(orgId),
    queryFn: async (): Promise<Map<string, AccountBalance>> => {
      const supabase = createClient();

      const { data: accounts, error: accErr } = await supabase
        .from("accounts")
        .select("id, opening_balance")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      if (accErr) throw accErr;

      const { data: transactions, error: txnErr } = await supabase
        .from("transactions")
        .select("account_id, amount, transaction_type")
        .in(
          "account_id",
          (accounts ?? []).map((a) => a.id)
        );

      if (txnErr) throw txnErr;

      return getAccountBalances(accounts ?? [], transactions ?? []);
    },
  });
}
