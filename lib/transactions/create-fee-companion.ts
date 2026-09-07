import { calculateFee } from "@/lib/validations/account";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface FeeAccountConfig {
  id: string;
  fee_percentage: number | null;
  fee_flat_amount: number | null;
  fee_category_id: string | null;
}

export interface FeeCompanionInput {
  account: FeeAccountConfig;
  /** Gross amount of the income transaction the fee is charged against. */
  amount: number;
  transactionDate: string;
  description: string;
  status: "uncleared" | "cleared" | "reconciled";
  clearedAt: string | null;
}

/**
 * Creates the companion expense transaction for a processing fee.
 *
 * Returns null both when no fee applies and when the companion is written
 * successfully — the caller only needs to react to `{ error }`, which means
 * the income transaction stands but the fee did not, and the treasurer has to
 * add it by hand.
 *
 * Shared by the transaction form and the sponsorship deposit builder so the
 * two cannot drift apart on money handling.
 */
export async function createFeeCompanionTransaction(
  supabase: SupabaseClient<Database>,
  { account, amount, transactionDate, description, status, clearedAt }: FeeCompanionInput
): Promise<{ error: string } | null> {
  if (!account.fee_category_id) return null;
  if (!account.fee_percentage && !account.fee_flat_amount) return null;

  const feeAmount = calculateFee(
    amount,
    account.fee_percentage,
    account.fee_flat_amount
  );
  if (feeAmount <= 0) return null;

  const { data: feeCat } = await supabase
    .from("categories")
    .select("id, is_active")
    .eq("id", account.fee_category_id)
    .single();

  if (!feeCat?.is_active) return null;

  const { data: feeTxn, error: feeTxnError } = await supabase
    .from("transactions")
    .insert({
      account_id: account.id,
      transaction_date: transactionDate,
      amount: feeAmount,
      transaction_type: "expense",
      description: `Processing fee: ${description}`,
      status,
      cleared_at: clearedAt,
    })
    .select("id")
    .single();

  if (feeTxnError || !feeTxn) {
    return {
      error:
        "Income transaction was created, but the processing fee could not be created. Please add the fee manually.",
    };
  }

  const { error: feeLiError } = await supabase
    .from("transaction_line_items")
    .insert({
      transaction_id: feeTxn.id,
      category_id: account.fee_category_id,
      amount: feeAmount,
    });

  if (feeLiError) {
    await supabase.from("transactions").delete().eq("id", feeTxn.id);
    return {
      error:
        "Income transaction was created, but the processing fee line item failed. Please add the fee manually.",
    };
  }

  return null;
}
