"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createTemplateSchema,
  updateTemplateSchema,
  generateFromTemplateSchema,
  templateLineItemsArraySchema,
} from "@/lib/validations/recurring-template";
import {
  computeInitialOccurrence,
  computeNextOccurrence,
  computeResumeOccurrence,
} from "@/lib/recurrence";
import { calculateFee } from "@/lib/validations/account";

import type { RecurrenceRule } from "@/lib/recurrence";

export async function createTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    account_id: formData.get("account_id") as string,
    organization_id: formData.get("organization_id") as string,
    transaction_type: formData.get("transaction_type") as string,
    amount: formData.get("amount") as string,
    description: formData.get("description") as string,
    vendor: (formData.get("vendor") as string) ?? "",
    check_number: (formData.get("check_number") as string) ?? "",
    recurrence_rule: formData.get("recurrence_rule") as string,
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) ?? "",
    line_items: formData.get("line_items") as string,
  };

  const parsed = createTemplateSchema.safeParse(raw);
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

  const parsedLineItems = templateLineItemsArraySchema.safeParse(lineItems);
  if (!parsedLineItems.success) {
    return { error: parsedLineItems.error.issues[0].message };
  }

  // Verify line item sum equals template amount
  const lineItemSum = parsedLineItems.data.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  if (Math.abs(lineItemSum - parsed.data.amount) > 0.01) {
    return {
      error: `Line item amounts ($${lineItemSum.toFixed(2)}) must equal template total ($${parsed.data.amount.toFixed(2)}).`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Verify the account exists and belongs to the org
  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id")
    .eq("id", parsed.data.account_id)
    .eq("is_active", true)
    .single();

  if (!account) {
    return { error: "Account not found." };
  }

  if (account.organization_id !== parsed.data.organization_id) {
    return { error: "Account does not belong to this organization." };
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
    if (cat.organization_id !== parsed.data.organization_id) {
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

  // Compute initial next_occurrence_date
  const nextOccurrence = computeInitialOccurrence(
    parsed.data.start_date,
    parsed.data.end_date || null
  );

  const { data: template, error: templateError } = await supabase
    .from("recurring_templates")
    .insert({
      account_id: parsed.data.account_id,
      organization_id: parsed.data.organization_id,
      transaction_type: parsed.data.transaction_type,
      amount: parsed.data.amount,
      description: parsed.data.description,
      vendor: parsed.data.vendor || null,
      check_number: parsed.data.check_number || null,
      recurrence_rule: parsed.data.recurrence_rule,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date || null,
      next_occurrence_date: nextOccurrence,
      is_active: true,
    })
    .select("id")
    .single();

  if (templateError || !template) {
    return { error: "Failed to create template. Please try again." };
  }

  // Bulk insert line items
  const lineItemInserts = parsedLineItems.data.map((li) => ({
    template_id: template.id,
    category_id: li.category_id,
    amount: li.amount,
    memo: li.memo || null,
  }));

  const { error: liError } = await supabase
    .from("recurring_template_line_items")
    .insert(lineItemInserts);

  if (liError) {
    await supabase.from("recurring_templates").delete().eq("id", template.id);
    return { error: "Failed to create line items. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/templates/${template.id}`
  );
}

export async function updateTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    account_id: formData.get("account_id") as string,
    organization_id: formData.get("organization_id") as string,
    transaction_type: formData.get("transaction_type") as string,
    amount: formData.get("amount") as string,
    description: formData.get("description") as string,
    vendor: (formData.get("vendor") as string) ?? "",
    check_number: (formData.get("check_number") as string) ?? "",
    recurrence_rule: formData.get("recurrence_rule") as string,
    start_date: formData.get("start_date") as string,
    end_date: (formData.get("end_date") as string) ?? "",
    line_items: formData.get("line_items") as string,
  };

  const parsed = updateTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Parse and validate line items
  let lineItems: unknown;
  try {
    lineItems = JSON.parse(parsed.data.line_items);
  } catch {
    return { error: "Invalid line items data." };
  }

  const parsedLineItems = templateLineItemsArraySchema.safeParse(lineItems);
  if (!parsedLineItems.success) {
    return { error: parsedLineItems.error.issues[0].message };
  }

  const lineItemSum = parsedLineItems.data.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  if (Math.abs(lineItemSum - parsed.data.amount) > 0.01) {
    return {
      error: `Line item amounts ($${lineItemSum.toFixed(2)}) must equal template total ($${parsed.data.amount.toFixed(2)}).`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Fetch existing template
  const { data: existing } = await supabase
    .from("recurring_templates")
    .select("id, organization_id, recurrence_rule, start_date, end_date, next_occurrence_date")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) {
    return { error: "Template not found." };
  }

  if (existing.organization_id !== parsed.data.organization_id) {
    return { error: "Template does not belong to this organization." };
  }

  // Verify account
  const { data: account } = await supabase
    .from("accounts")
    .select("id, organization_id")
    .eq("id", parsed.data.account_id)
    .eq("is_active", true)
    .single();

  if (!account) {
    return { error: "Account not found." };
  }

  if (account.organization_id !== parsed.data.organization_id) {
    return { error: "Account does not belong to this organization." };
  }

  // Verify org
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", parsed.data.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Validate categories
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
    if (cat.organization_id !== parsed.data.organization_id) {
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

  // Recompute next_occurrence_date if rule/dates changed
  let nextOccurrence = existing.next_occurrence_date;
  const ruleChanged = existing.recurrence_rule !== parsed.data.recurrence_rule;
  const startChanged = existing.start_date !== parsed.data.start_date;
  const endChanged = (existing.end_date ?? "") !== (parsed.data.end_date ?? "");

  if (ruleChanged || startChanged || endChanged) {
    const today = new Date().toISOString().split("T")[0];
    nextOccurrence = computeResumeOccurrence(
      parsed.data.start_date,
      parsed.data.recurrence_rule as RecurrenceRule,
      today,
      parsed.data.end_date || null
    );
  }

  const { error: updateError } = await supabase
    .from("recurring_templates")
    .update({
      account_id: parsed.data.account_id,
      transaction_type: parsed.data.transaction_type,
      amount: parsed.data.amount,
      description: parsed.data.description,
      vendor: parsed.data.vendor || null,
      check_number: parsed.data.check_number || null,
      recurrence_rule: parsed.data.recurrence_rule,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date || null,
      next_occurrence_date: nextOccurrence,
    })
    .eq("id", parsed.data.id);

  if (updateError) {
    return { error: "Failed to update template. Please try again." };
  }

  // Delete existing line items and re-insert
  await supabase
    .from("recurring_template_line_items")
    .delete()
    .eq("template_id", parsed.data.id);

  const lineItemInserts = parsedLineItems.data.map((li) => ({
    template_id: parsed.data.id,
    category_id: li.category_id,
    amount: li.amount,
    memo: li.memo || null,
  }));

  const { error: liError } = await supabase
    .from("recurring_template_line_items")
    .insert(lineItemInserts);

  if (liError) {
    return { error: "Failed to update line items. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/templates/${parsed.data.id}`
  );
}

export async function deleteTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Template ID and organization ID are required." };
  }

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
    .eq("id", organizationId)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Verify template belongs to org
  const { data: template } = await supabase
    .from("recurring_templates")
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (!template) {
    return { error: "Template not found." };
  }

  // Delete template (line items cascade, transactions keep data via SET NULL)
  const { error } = await supabase
    .from("recurring_templates")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: "Failed to delete template. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/templates`);
}

export async function pauseTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Template ID and organization ID are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  const { error } = await supabase
    .from("recurring_templates")
    .update({ is_active: false, next_occurrence_date: null })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    return { error: "Failed to pause template. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function resumeTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Template ID and organization ID are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch template to compute next occurrence
  const { data: template } = await supabase
    .from("recurring_templates")
    .select("id, start_date, end_date, recurrence_rule")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (!template) {
    return { error: "Template not found." };
  }

  const today = new Date().toISOString().split("T")[0];
  const nextOccurrence = computeResumeOccurrence(
    template.start_date,
    template.recurrence_rule as RecurrenceRule,
    today,
    template.end_date
  );

  if (!nextOccurrence) {
    return { error: "Cannot resume: template has ended (end date has passed)." };
  }

  const { error } = await supabase
    .from("recurring_templates")
    .update({ is_active: true, next_occurrence_date: nextOccurrence })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    return { error: "Failed to resume template. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function generateFromTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    template_id: formData.get("template_id") as string,
    organization_id: formData.get("organization_id") as string,
  };

  const parsed = generateFromTemplateSchema.safeParse(raw);
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

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", parsed.data.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch template with line items
  const { data: template } = await supabase
    .from("recurring_templates")
    .select(
      `
      *,
      recurring_template_line_items(
        id, category_id, amount, memo
      )
    `
    )
    .eq("id", parsed.data.template_id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!template) {
    return { error: "Template not found." };
  }

  if (!template.is_active) {
    return { error: "Template is paused. Resume it before generating." };
  }

  if (!template.next_occurrence_date) {
    return { error: "Template has no upcoming occurrence." };
  }

  // Fetch account for fee config
  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id, organization_id, fee_percentage, fee_flat_amount, fee_category_id"
    )
    .eq("id", template.account_id)
    .eq("is_active", true)
    .single();

  if (!account) {
    return { error: "Template account not found or inactive." };
  }

  // Create the transaction
  const { data: transaction, error: txnError } = await supabase
    .from("transactions")
    .insert({
      account_id: template.account_id,
      transaction_date: template.next_occurrence_date,
      amount: template.amount,
      transaction_type: template.transaction_type,
      description: template.description,
      check_number: template.check_number || null,
      vendor: template.vendor || null,
      status: "uncleared",
      template_id: template.id,
    })
    .select("id")
    .single();

  if (txnError || !transaction) {
    return { error: "Failed to create transaction. Please try again." };
  }

  // Insert line items
  const templateLineItems = template.recurring_template_line_items ?? [];
  const lineItemInserts = templateLineItems.map(
    (li: { category_id: string; amount: number; memo: string | null }) => ({
      transaction_id: transaction.id,
      category_id: li.category_id,
      amount: li.amount,
      memo: li.memo || null,
    })
  );

  const { error: liError } = await supabase
    .from("transaction_line_items")
    .insert(lineItemInserts);

  if (liError) {
    await supabase.from("transactions").delete().eq("id", transaction.id);
    return { error: "Failed to create line items. Please try again." };
  }

  // Apply processing fees if account has fee config and it's income
  if (
    template.transaction_type === "income" &&
    account.fee_category_id &&
    (account.fee_percentage || account.fee_flat_amount)
  ) {
    const feeAmount = calculateFee(
      template.amount,
      account.fee_percentage,
      account.fee_flat_amount
    );

    if (feeAmount > 0) {
      const { data: feeCat } = await supabase
        .from("categories")
        .select("id, is_active")
        .eq("id", account.fee_category_id)
        .single();

      if (feeCat?.is_active) {
        const { data: feeTxn } = await supabase
          .from("transactions")
          .insert({
            account_id: template.account_id,
            transaction_date: template.next_occurrence_date,
            amount: feeAmount,
            transaction_type: "expense",
            description: `Processing fee: ${template.description}`,
            status: "uncleared",
            template_id: template.id,
          })
          .select("id")
          .single();

        if (feeTxn) {
          await supabase.from("transaction_line_items").insert({
            transaction_id: feeTxn.id,
            category_id: account.fee_category_id,
            amount: feeAmount,
          });
        }
      }
    }
  }

  // Advance next_occurrence_date
  const nextOccurrence = computeNextOccurrence(
    template.start_date,
    template.recurrence_rule as RecurrenceRule,
    template.next_occurrence_date,
    template.end_date
  );

  await supabase
    .from("recurring_templates")
    .update({
      next_occurrence_date: nextOccurrence,
      is_active: nextOccurrence !== null,
    })
    .eq("id", template.id);

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function createTemplateFromTransaction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const transactionId = formData.get("transaction_id") as string;
  const organizationId = formData.get("organization_id") as string;
  const recurrenceRule = formData.get("recurrence_rule") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) ?? "";

  if (!transactionId || !organizationId || !recurrenceRule || !startDate) {
    return { error: "Missing required fields." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch the transaction with line items
  const { data: txn } = await supabase
    .from("transactions")
    .select(
      `
      *,
      accounts!inner(id, organization_id),
      transaction_line_items(
        category_id, amount, memo
      )
    `
    )
    .eq("id", transactionId)
    .eq("accounts.organization_id", organizationId)
    .single();

  if (!txn) {
    return { error: "Transaction not found." };
  }

  const nextOccurrence = computeInitialOccurrence(
    startDate,
    endDate || null
  );

  const { data: template, error: templateError } = await supabase
    .from("recurring_templates")
    .insert({
      account_id: txn.account_id,
      organization_id: organizationId,
      transaction_type: txn.transaction_type,
      amount: txn.amount,
      description: txn.description,
      vendor: txn.vendor || null,
      check_number: txn.check_number || null,
      recurrence_rule: recurrenceRule,
      start_date: startDate,
      end_date: endDate || null,
      next_occurrence_date: nextOccurrence,
      is_active: true,
    })
    .select("id")
    .single();

  if (templateError || !template) {
    return { error: "Failed to create template. Please try again." };
  }

  // Copy line items
  const txnLineItems = txn.transaction_line_items ?? [];
  if (txnLineItems.length > 0) {
    const lineItemInserts = txnLineItems.map(
      (li: { category_id: string; amount: number; memo: string | null }) => ({
        template_id: template.id,
        category_id: li.category_id,
        amount: li.amount,
        memo: li.memo || null,
      })
    );

    const { error: liError } = await supabase
      .from("recurring_template_line_items")
      .insert(lineItemInserts);

    if (liError) {
      await supabase
        .from("recurring_templates")
        .delete()
        .eq("id", template.id);
      return { error: "Failed to create line items. Please try again." };
    }
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/templates/${template.id}`);
}
