"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getReconciledBalance } from "@/lib/balances";
import {
  createReconciliationSchema,
  finishReconciliationSchema,
  cancelReconciliationSchema,
  quickTransactionSchema,
} from "@/lib/validations/reconciliation";

export async function createReconciliationSession(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    account_id: formData.get("account_id") as string,
    statement_date: formData.get("statement_date") as string,
    statement_ending_balance: formData.get("statement_ending_balance") as string,
  };

  const parsed = createReconciliationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify the account exists and get its organization
  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id, opening_balance, is_active")
    .eq("id", parsed.data.account_id)
    .eq("is_active", true)
    .single();

  if (!account) {
    return { error: "Account not found." };
  }

  // Verify the organization belongs to this user
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", account.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Check for existing in_progress session for this account
  const { data: existingSession } = await supabase
    .from("reconciliation_sessions")
    .select("id")
    .eq("account_id", parsed.data.account_id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (existingSession) {
    return { error: "An in-progress reconciliation session already exists for this account." };
  }

  // Compute starting balance: opening balance + net of reconciled transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, transaction_type, status")
    .eq("account_id", parsed.data.account_id);

  const startingBalance = getReconciledBalance(
    account.opening_balance ?? 0,
    transactions ?? []
  );

  const { data: session, error: sessionError } = await supabase
    .from("reconciliation_sessions")
    .insert({
      account_id: parsed.data.account_id,
      statement_date: parsed.data.statement_date,
      statement_ending_balance: parsed.data.statement_ending_balance,
      starting_balance: startingBalance,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return { error: "Failed to create reconciliation session. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${account.organization_id}/accounts/${parsed.data.account_id}/reconcile/${session.id}`
  );
}

export async function finishReconciliation(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    session_id: formData.get("session_id") as string,
    account_id: formData.get("account_id") as string,
    transaction_ids: formData.get("transaction_ids") as string,
  };

  const parsed = finishReconciliationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify the account and organization
  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id")
    .eq("id", parsed.data.account_id)
    .eq("is_active", true)
    .single();

  if (!account) {
    return { error: "Account not found." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", account.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Verify session exists and is in_progress
  const { data: session } = await supabase
    .from("reconciliation_sessions")
    .select("id, status")
    .eq("id", parsed.data.session_id)
    .eq("account_id", parsed.data.account_id)
    .single();

  if (!session) {
    return { error: "Reconciliation session not found." };
  }

  if (session.status !== "in_progress") {
    return { error: "This reconciliation session is no longer in progress." };
  }

  const transactionIds = parsed.data.transaction_ids.split(",").filter(Boolean);
  if (transactionIds.length === 0) {
    return { error: "No transactions selected." };
  }

  // Bulk update checked transactions to reconciled
  for (const txnId of transactionIds) {
    const { data: txn } = await supabase
      .from("transactions")
      .select("id, status, cleared_at")
      .eq("id", txnId)
      .eq("account_id", parsed.data.account_id)
      .single();

    if (!txn) continue;

    // Set cleared_at if null (was uncleared)
    const clearedAt = txn.cleared_at ?? new Date().toISOString();

    await supabase
      .from("transactions")
      .update({ status: "reconciled", cleared_at: clearedAt })
      .eq("id", txnId);
  }

  // Update session to completed
  const { error: updateError } = await supabase
    .from("reconciliation_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      transaction_count: transactionIds.length,
    })
    .eq("id", parsed.data.session_id);

  if (updateError) {
    return { error: "Failed to complete reconciliation session. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${account.organization_id}/accounts/${parsed.data.account_id}`
  );
}

export async function cancelReconciliation(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    session_id: formData.get("session_id") as string,
    account_id: formData.get("account_id") as string,
  };

  const parsed = cancelReconciliationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify the account and organization
  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id")
    .eq("id", parsed.data.account_id)
    .eq("is_active", true)
    .single();

  if (!account) {
    return { error: "Account not found." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", account.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Verify session exists and is in_progress
  const { data: session } = await supabase
    .from("reconciliation_sessions")
    .select("id, status")
    .eq("id", parsed.data.session_id)
    .eq("account_id", parsed.data.account_id)
    .single();

  if (!session) {
    return { error: "Reconciliation session not found." };
  }

  if (session.status !== "in_progress") {
    return { error: "This reconciliation session is no longer in progress." };
  }

  const { error: updateError } = await supabase
    .from("reconciliation_sessions")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.session_id);

  if (updateError) {
    return { error: "Failed to cancel reconciliation session. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${account.organization_id}/accounts/${parsed.data.account_id}`
  );
}

export async function createQuickTransaction(
  _prevState: { error: string; transaction_id?: string } | null,
  formData: FormData
): Promise<{ error: string; transaction_id?: string } | { error?: undefined; transaction_id: string }> {
  const raw = {
    account_id: formData.get("account_id") as string,
    session_id: formData.get("session_id") as string,
    transaction_date: formData.get("transaction_date") as string,
    description: formData.get("description") as string,
    amount: formData.get("amount") as string,
    transaction_type: formData.get("transaction_type") as string,
    category_id: formData.get("category_id") as string,
  };

  const parsed = quickTransactionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify the account and organization
  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id")
    .eq("id", parsed.data.account_id)
    .eq("is_active", true)
    .single();

  if (!account) {
    return { error: "Account not found." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", account.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Verify session exists and is in_progress
  const { data: session } = await supabase
    .from("reconciliation_sessions")
    .select("id, status")
    .eq("id", parsed.data.session_id)
    .eq("account_id", parsed.data.account_id)
    .single();

  if (!session) {
    return { error: "Reconciliation session not found." };
  }

  if (session.status !== "in_progress") {
    return { error: "This reconciliation session is no longer in progress." };
  }

  // Validate category
  const { data: category } = await supabase
    .from("categories")
    .select("id, category_type, organization_id, is_active")
    .eq("id", parsed.data.category_id)
    .single();

  if (!category) {
    return { error: "Category not found." };
  }

  if (!category.is_active) {
    return { error: "Category is inactive." };
  }

  if (category.organization_id !== account.organization_id) {
    return { error: "Category does not belong to this organization." };
  }

  if (category.category_type !== parsed.data.transaction_type) {
    return {
      error: `Category type must match transaction type (${parsed.data.transaction_type}).`,
    };
  }

  // Create the transaction with status uncleared
  const { data: transaction, error: txnError } = await supabase
    .from("transactions")
    .insert({
      account_id: parsed.data.account_id,
      transaction_date: parsed.data.transaction_date,
      amount: parsed.data.amount,
      transaction_type: parsed.data.transaction_type,
      description: parsed.data.description,
      status: "uncleared",
    })
    .select("id")
    .single();

  if (txnError || !transaction) {
    return { error: "Failed to create transaction. Please try again." };
  }

  // Create single line item
  const { error: liError } = await supabase
    .from("transaction_line_items")
    .insert({
      transaction_id: transaction.id,
      category_id: parsed.data.category_id,
      amount: parsed.data.amount,
    });

  if (liError) {
    await supabase.from("transactions").delete().eq("id", transaction.id);
    return { error: "Failed to create line item. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return { transaction_id: transaction.id };
}
