"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase/server";
import {
  uploadReceiptSchema,
  deleteReceiptSchema,
  ALLOWED_RECEIPT_MIME_TYPES,
  ALLOWED_RECEIPT_EXTENSIONS,
  MAX_RECEIPT_FILE_SIZE,
} from "@/lib/validations/receipt";

export async function uploadReceipt(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    transaction_id: formData.get("transaction_id") as string,
    organization_id: formData.get("organization_id") as string,
  };

  const parsed = uploadReceiptSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File)) {
    return { error: "No file provided." };
  }

  if (file.size > MAX_RECEIPT_FILE_SIZE) {
    return { error: "File size must be 5 MB or less." };
  }

  if (
    !ALLOWED_RECEIPT_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number]
    )
  ) {
    return { error: "File type must be JPEG, PNG, WebP, or PDF." };
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
    .eq("id", parsed.data.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Verify the transaction exists and is not reconciled
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, status, account_id")
    .eq("id", parsed.data.transaction_id)
    .single();

  if (!transaction) {
    return { error: "Transaction not found." };
  }

  if (transaction.status === "reconciled") {
    return { error: "Cannot attach receipts to reconciled transactions." };
  }

  // Verify the account belongs to the organization
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", transaction.account_id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!account) {
    return { error: "Transaction does not belong to this organization." };
  }

  // Generate storage path
  const receiptId = randomUUID();
  const ext = ALLOWED_RECEIPT_EXTENSIONS[file.type] ?? "bin";
  const storagePath = `${parsed.data.organization_id}/${parsed.data.transaction_id}/${receiptId}.${ext}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { error: "Failed to upload file. Please try again." };
  }

  // Insert metadata row
  const { error: dbError } = await supabase.from("receipts").insert({
    id: receiptId,
    transaction_id: parsed.data.transaction_id,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
    storage_path: storagePath,
  });

  if (dbError) {
    // Rollback: remove uploaded file
    await supabase.storage.from("receipts").remove([storagePath]);
    return { error: "Failed to save receipt metadata. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function deleteReceipt(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    receipt_id: formData.get("receipt_id") as string,
    organization_id: formData.get("organization_id") as string,
  };

  const parsed = deleteReceiptSchema.safeParse(raw);
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

  // Verify the organization belongs to this user
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", parsed.data.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch receipt with its transaction status
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, storage_path, transaction_id")
    .eq("id", parsed.data.receipt_id)
    .single();

  if (!receipt) {
    return { error: "Receipt not found." };
  }

  // Verify the transaction is not reconciled
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, status, account_id")
    .eq("id", receipt.transaction_id)
    .single();

  if (!transaction) {
    return { error: "Transaction not found." };
  }

  if (transaction.status === "reconciled") {
    return { error: "Cannot delete receipts from reconciled transactions." };
  }

  // Verify the account belongs to the organization
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", transaction.account_id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!account) {
    return { error: "Receipt does not belong to this organization." };
  }

  // Remove from storage
  await supabase.storage.from("receipts").remove([receipt.storage_path]);

  // Delete metadata row
  const { error: dbError } = await supabase
    .from("receipts")
    .delete()
    .eq("id", parsed.data.receipt_id);

  if (dbError) {
    return { error: "Failed to delete receipt. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}
