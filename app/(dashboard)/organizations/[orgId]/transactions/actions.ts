 "use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createTransactionSchema,
  updateTransactionSchema,
  lineItemsArraySchema,
  inlineUpdateTransactionSchema,
  TRANSACTION_STATUSES,
} from "@/lib/validations/transaction";

export async function createTransaction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    account_id: formData.get("account_id") as string,
    transaction_date: formData.get("transaction_date") as string,
    amount: formData.get("amount") as string,
    transaction_type: formData.get("transaction_type") as string,
    description: formData.get("description") as string,
    check_number: formData.get("check_number") as string,
    vendor: formData.get("vendor") as string,
    status: formData.get("status") as string,
    line_items: formData.get("line_items") as string,
  };

  const parsed = createTransactionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Parse and validate line items JSON
  let lineItems: unknown;
  try {
    lineItems = JSON.parse(parsed.data.line_items);
  } catch {
    return { error: "Invalid line items data." };
  }

  const parsedLineItems = lineItemsArraySchema.safeParse(lineItems);
  if (!parsedLineItems.success) {
    return { error: parsedLineItems.error.issues[0].message };
  }

  // Verify line item sum equals transaction amount
  const lineItemSum = parsedLineItems.data.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  if (Math.abs(lineItemSum - parsed.data.amount) > 0.01) {
    return {
      error: `Line item amounts ($${lineItemSum.toFixed(2)}) must equal transaction total ($${parsed.data.amount.toFixed(2)}).`,
    };
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
    .select("id, organization_id, account_type")
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

  // Validate all category_ids: exist, active, same org, type matches
  const categoryIds = parsedLineItems.data.map((li) => li.category_id);
  const { data: categories } = await supabase
    .from("categories")
    .select("id, category_type, organization_id, is_active")
    .in("id", categoryIds);

  if (!categories || categories.length !== new Set(categoryIds).size) {
    return { error: "One or more categories not found." };
  }

  for (const cat of categories) {
    if (!cat.is_active) {
      return { error: "One or more categories are inactive." };
    }
    if (cat.organization_id !== account.organization_id) {
      return {
        error: "All categories must belong to the same organization.",
      };
    }
    if (cat.category_type !== parsed.data.transaction_type) {
      return {
        error: `Category type must match transaction type (${parsed.data.transaction_type}).`,
      };
    }
  }

  // Set cleared_at if status is cleared or reconciled
  const clearedAt =
    parsed.data.status === "cleared" || parsed.data.status === "reconciled"
      ? new Date().toISOString()
      : null;

  const { data: transaction, error: txnError } = await supabase
    .from("transactions")
    .insert({
      account_id: parsed.data.account_id,
      transaction_date: parsed.data.transaction_date,
      amount: parsed.data.amount,
      transaction_type: parsed.data.transaction_type,
      description: parsed.data.description,
      check_number: parsed.data.check_number || null,
      vendor: parsed.data.vendor || null,
      status: parsed.data.status,
      cleared_at: clearedAt,
    })
    .select("id")
    .single();

  if (txnError || !transaction) {
    return { error: "Failed to create transaction. Please try again." };
  }

  // Bulk insert line items
  const lineItemInserts = parsedLineItems.data.map((li) => ({
    transaction_id: transaction.id,
    category_id: li.category_id,
    amount: li.amount,
    memo: li.memo || null,
  }));

  const { error: liError } = await supabase
    .from("transaction_line_items")
    .insert(lineItemInserts);

  if (liError) {
    // Clean up the transaction if line items fail
    await supabase.from("transactions").delete().eq("id", transaction.id);
    return {
      error: "Failed to create line items. Please try again.",
    };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${account.organization_id}/transactions/${transaction.id}`
  );
}

export async function updateTransaction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    account_id: formData.get("account_id") as string,
    transaction_date: formData.get("transaction_date") as string,
    amount: formData.get("amount") as string,
    transaction_type: formData.get("transaction_type") as string,
    description: formData.get("description") as string,
    check_number: formData.get("check_number") as string,
    vendor: formData.get("vendor") as string,
    status: formData.get("status") as string,
    line_items: formData.get("line_items") as string,
  };

  const parsed = updateTransactionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Parse and validate line items JSON
  let lineItems: unknown;
  try {
    lineItems = JSON.parse(parsed.data.line_items);
  } catch {
    return { error: "Invalid line items data." };
  }

  const parsedLineItems = lineItemsArraySchema.safeParse(lineItems);
  if (!parsedLineItems.success) {
    return { error: parsedLineItems.error.issues[0].message };
  }

  // Verify line item sum equals transaction amount
  const lineItemSum = parsedLineItems.data.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  if (Math.abs(lineItemSum - parsed.data.amount) > 0.01) {
    return {
      error: `Line item amounts ($${lineItemSum.toFixed(2)}) must equal transaction total ($${parsed.data.amount.toFixed(2)}).`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Fetch existing transaction
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, status, account_id, cleared_at")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) {
    return { error: "Transaction not found." };
  }

  // Block editing reconciled transactions
  if (existing.status === "reconciled") {
    return { error: "Reconciled transactions cannot be edited." };
  }

  // Verify the account exists and get its organization
  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id")
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

  // Validate all category_ids
  const categoryIds = parsedLineItems.data.map((li) => li.category_id);
  const { data: categories } = await supabase
    .from("categories")
    .select("id, category_type, organization_id, is_active")
    .in("id", categoryIds);

  if (!categories || categories.length !== new Set(categoryIds).size) {
    return { error: "One or more categories not found." };
  }

  for (const cat of categories) {
    if (!cat.is_active) {
      return { error: "One or more categories are inactive." };
    }
    if (cat.organization_id !== account.organization_id) {
      return {
        error: "All categories must belong to the same organization.",
      };
    }
    if (cat.category_type !== parsed.data.transaction_type) {
      return {
        error: `Category type must match transaction type (${parsed.data.transaction_type}).`,
      };
    }
  }

  // Handle cleared_at transitions
  let clearedAt: string | null = existing.cleared_at;
  const oldStatus = existing.status;
  const newStatus = parsed.data.status;

  if (oldStatus === "uncleared" && (newStatus === "cleared" || newStatus === "reconciled")) {
    clearedAt = new Date().toISOString();
  } else if (newStatus === "uncleared") {
    clearedAt = null;
  }

  const { error: txnError } = await supabase
    .from("transactions")
    .update({
      account_id: parsed.data.account_id,
      transaction_date: parsed.data.transaction_date,
      amount: parsed.data.amount,
      transaction_type: parsed.data.transaction_type,
      description: parsed.data.description,
      check_number: parsed.data.check_number || null,
      vendor: parsed.data.vendor || null,
      status: parsed.data.status,
      cleared_at: clearedAt,
    })
    .eq("id", parsed.data.id);

  if (txnError) {
    return { error: "Failed to update transaction. Please try again." };
  }

  // Delete existing line items and re-insert
  await supabase
    .from("transaction_line_items")
    .delete()
    .eq("transaction_id", parsed.data.id);

  const lineItemInserts = parsedLineItems.data.map((li) => ({
    transaction_id: parsed.data.id,
    category_id: li.category_id,
    amount: li.amount,
    memo: li.memo || null,
  }));

  const { error: liError } = await supabase
    .from("transaction_line_items")
    .insert(lineItemInserts);

  if (liError) {
    return { error: "Failed to update line items. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${account.organization_id}/transactions/${parsed.data.id}`
  );
}

export async function deleteTransaction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Transaction ID and organization ID are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify the organization belongs to this user
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch the transaction to check status
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, status, account_id")
    .eq("id", id)
    .single();

  if (!transaction) {
    return { error: "Transaction not found." };
  }

  if (transaction.status === "reconciled") {
    return { error: "Reconciled transactions cannot be deleted." };
  }

  // Verify the account belongs to this organization
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", transaction.account_id)
    .eq("organization_id", organizationId)
    .single();

  if (!account) {
    return { error: "Transaction does not belong to this organization." };
  }

  // Delete transaction (line items cascade via ON DELETE CASCADE)
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: "Failed to delete transaction. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/transactions`);
}

export async function bulkUpdateStatus(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const idsRaw = formData.get("ids") as string;
  const newStatus = formData.get("status") as string;
  const orgId = formData.get("org_id") as string;

  if (!idsRaw || !newStatus || !orgId) {
    return { error: "Missing required fields." };
  }

  if (!["uncleared", "cleared", "reconciled"].includes(newStatus)) {
    return { error: "Invalid status." };
  }

  const ids = idsRaw.split(",").filter(Boolean);
  if (ids.length === 0) {
    return { error: "No transactions selected." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify the organization belongs to this user
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch all selected transactions
  const { data: txns } = await supabase
    .from("transactions")
    .select("id, status, cleared_at, account_id")
    .in("id", ids);

  if (!txns || txns.length === 0) {
    return { error: "No transactions found." };
  }

  // Block updating reconciled transactions (unless explicitly unreconciling)
  const reconciledIds = txns
    .filter((t) => t.status === "reconciled")
    .map((t) => t.id);
  if (reconciledIds.length > 0) {
    return {
      error: `${reconciledIds.length} reconciled transaction(s) cannot be bulk-updated. Deselect them and try again.`,
    };
  }

  // Verify all accounts belong to this organization
  const accountIds = [...new Set(txns.map((t) => t.account_id))];
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .in("id", accountIds)
    .eq("organization_id", orgId);

  if (!accounts || accounts.length !== accountIds.length) {
    return { error: "Some transactions do not belong to this organization." };
  }

  // Update each transaction with proper cleared_at handling
  for (const txn of txns) {
    let clearedAt: string | null = txn.cleared_at;

    if (
      txn.status === "uncleared" &&
      (newStatus === "cleared" || newStatus === "reconciled")
    ) {
      clearedAt = new Date().toISOString();
    } else if (newStatus === "uncleared") {
      clearedAt = null;
    }

    await supabase
      .from("transactions")
      .update({ status: newStatus, cleared_at: clearedAt })
      .eq("id", txn.id);
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function bulkDeleteTransactions(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const idsRaw = formData.get("ids") as string;
  const orgId = formData.get("org_id") as string;

  if (!idsRaw || !orgId) {
    return { error: "Missing required fields." };
  }

  const ids = idsRaw.split(",").filter(Boolean);
  if (ids.length === 0) {
    return { error: "No transactions selected." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify the organization belongs to this user
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch all selected transactions to check status
  const { data: txns } = await supabase
    .from("transactions")
    .select("id, status, account_id")
    .in("id", ids);

  if (!txns || txns.length === 0) {
    return { error: "No transactions found." };
  }

  // Block deletion of reconciled transactions
  const reconciledIds = txns
    .filter((t) => t.status === "reconciled")
    .map((t) => t.id);
  if (reconciledIds.length > 0) {
    return {
      error: `${reconciledIds.length} reconciled transaction(s) cannot be deleted. Deselect them and try again.`,
    };
  }

  // Verify all accounts belong to this organization
  const accountIds = [...new Set(txns.map((t) => t.account_id))];
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .in("id", accountIds)
    .eq("organization_id", orgId);

  if (!accounts || accounts.length !== accountIds.length) {
    return { error: "Some transactions do not belong to this organization." };
  }

  // Delete (line items cascade via ON DELETE CASCADE)
  const { error } = await supabase
    .from("transactions")
    .delete()
    .in("id", ids);

  if (error) {
    return { error: "Failed to delete transactions. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function inlineUpdateTransaction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    org_id: formData.get("org_id") as string,
    field: formData.get("field") as string,
    value: formData.get("value") as string,
  };

  const parsed = inlineUpdateTransactionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { id, org_id, field, value } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify org belongs to user
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", org_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch existing transaction with line items count
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, status, account_id, cleared_at, amount, transaction_line_items(id)")
    .eq("id", id)
    .single();

  if (!existing) {
    return { error: "Transaction not found." };
  }

  if (existing.status === "reconciled") {
    return { error: "Reconciled transactions cannot be edited." };
  }

  // Verify account belongs to the org
  const { data: currentAccount } = await supabase
    .from("accounts")
    .select("id, organization_id")
    .eq("id", existing.account_id)
    .single();

  if (!currentAccount || currentAccount.organization_id !== org_id) {
    return { error: "Transaction does not belong to this organization." };
  }

  // Build partial update based on field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};

  switch (field) {
    case "transaction_date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { error: "Invalid date format. Use YYYY-MM-DD." };
      }
      const dateObj = new Date(value + "T00:00:00");
      if (isNaN(dateObj.getTime())) {
        return { error: "Invalid date." };
      }
      update.transaction_date = value;
      break;
    }
    case "description": {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return { error: "Description is required." };
      }
      if (trimmed.length > 255) {
        return { error: "Description must be 255 characters or fewer." };
      }
      update.description = trimmed;
      break;
    }
    case "check_number": {
      const trimmed = value.trim();
      if (trimmed.length > 20) {
        return { error: "Check number must be 20 characters or fewer." };
      }
      update.check_number = trimmed || null;
      break;
    }
    case "vendor": {
      const trimmedVendor = value.trim();
      if (trimmedVendor.length > 255) {
        return { error: "Vendor must be 255 characters or fewer." };
      }
      update.vendor = trimmedVendor || null;
      break;
    }
    case "status": {
      if (
        !TRANSACTION_STATUSES.includes(
          value as (typeof TRANSACTION_STATUSES)[number]
        )
      ) {
        return { error: "Invalid status." };
      }

      const oldStatus = existing.status;
      const newStatus = value;

      let clearedAt: string | null = existing.cleared_at;

      if (
        oldStatus === "uncleared" &&
        (newStatus === "cleared" || newStatus === "reconciled")
      ) {
        clearedAt = new Date().toISOString();
      } else if (newStatus === "uncleared") {
        clearedAt = null;
      }

      update.status = newStatus;
      update.cleared_at = clearedAt;
      break;
    }
    case "amount": {
      const lineItemCount = existing.transaction_line_items?.length ?? 0;
      if (lineItemCount > 1) {
        return {
          error:
            "Cannot edit amount for split transactions. Edit on the detail page.",
        };
      }

      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue <= 0) {
        return { error: "Amount must be greater than zero." };
      }

      update.amount = numValue;

      // Also update the single line item amount
      if (lineItemCount === 1) {
        const { error: liError } = await supabase
          .from("transaction_line_items")
          .update({ amount: numValue })
          .eq("transaction_id", id);

        if (liError) {
          return { error: "Failed to update line item amount." };
        }
      }
      break;
    }
    case "account_id": {
      const { data: newAccount } = await supabase
        .from("accounts")
        .select("id, organization_id, is_active")
        .eq("id", value)
        .single();

      if (!newAccount) {
        return { error: "Account not found." };
      }
      if (!newAccount.is_active) {
        return { error: "Account is inactive." };
      }
      if (newAccount.organization_id !== org_id) {
        return { error: "Account does not belong to this organization." };
      }

      update.account_id = value;
      break;
    }
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update(update)
    .eq("id", id);

  if (updateError) {
    return { error: "Failed to update transaction. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}
