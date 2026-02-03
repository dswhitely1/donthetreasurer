"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createBudgetSchema,
  updateBudgetSchema,
  duplicateBudgetSchema,
  updateBudgetStatusSchema,
  budgetLineItemsArraySchema,
} from "@/lib/validations/budget";

export async function createBudget(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string,
    status: formData.get("status") as string,
    notes: (formData.get("notes") as string) ?? "",
    line_items: formData.get("line_items") as string,
  };

  const parsed = createBudgetSchema.safeParse(raw);
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

  const parsedLineItems = budgetLineItemsArraySchema.safeParse(lineItems);
  if (!parsedLineItems.success) {
    return { error: parsedLineItems.error.issues[0].message };
  }

  // Check for duplicate category_ids
  const categoryIds = parsedLineItems.data.map((li) => li.category_id);
  if (new Set(categoryIds).size !== categoryIds.length) {
    return { error: "Each category can only appear once in a budget." };
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

  // Validate all category_ids belong to this org
  const { data: categories } = await supabase
    .from("categories")
    .select("id, organization_id, is_active, parent_id")
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
  }

  // Check for parent/child overlap: if a parent is budgeted, its children shouldn't be too
  const categoryIdSet = new Set(categoryIds);
  for (const cat of categories) {
    if (cat.parent_id && categoryIdSet.has(cat.parent_id)) {
      return {
        error:
          "A budget cannot include both a parent category and its subcategory. Budget at one level only.",
      };
    }
  }

  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (budgetError || !budget) {
    if (budgetError?.code === "23505") {
      return { error: "A budget with this name already exists for this organization." };
    }
    return { error: "Failed to create budget. Please try again." };
  }

  // Bulk insert line items
  const lineItemInserts = parsedLineItems.data.map((li) => ({
    budget_id: budget.id,
    category_id: li.category_id,
    amount: li.amount,
    notes: li.notes || null,
  }));

  const { error: liError } = await supabase
    .from("budget_line_items")
    .insert(lineItemInserts);

  if (liError) {
    const { error: cleanupError } = await supabase
      .from("budgets")
      .delete()
      .eq("id", budget.id);
    if (cleanupError) {
      console.error("Failed to clean up orphaned budget:", budget.id, cleanupError);
    }
    return { error: "Failed to create line items. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/budgets/${budget.id}`
  );
}

export async function updateBudget(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string,
    status: formData.get("status") as string,
    notes: (formData.get("notes") as string) ?? "",
    line_items: formData.get("line_items") as string,
  };

  const parsed = updateBudgetSchema.safeParse(raw);
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

  const parsedLineItems = budgetLineItemsArraySchema.safeParse(lineItems);
  if (!parsedLineItems.success) {
    return { error: parsedLineItems.error.issues[0].message };
  }

  // Check for duplicate category_ids
  const categoryIds = parsedLineItems.data.map((li) => li.category_id);
  if (new Set(categoryIds).size !== categoryIds.length) {
    return { error: "Each category can only appear once in a budget." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Fetch existing budget
  const { data: existing } = await supabase
    .from("budgets")
    .select("id, organization_id")
    .eq("id", parsed.data.id)
    .single();

  if (!existing) {
    return { error: "Budget not found." };
  }

  if (existing.organization_id !== parsed.data.organization_id) {
    return { error: "Budget does not belong to this organization." };
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
  const { data: categories } = await supabase
    .from("categories")
    .select("id, organization_id, is_active, parent_id")
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
  }

  // Check for parent/child overlap
  const categoryIdSet = new Set(categoryIds);
  for (const cat of categories) {
    if (cat.parent_id && categoryIdSet.has(cat.parent_id)) {
      return {
        error:
          "A budget cannot include both a parent category and its subcategory. Budget at one level only.",
      };
    }
  }

  const { error: updateError } = await supabase
    .from("budgets")
    .update({
      name: parsed.data.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (updateError) {
    if (updateError.code === "23505") {
      return { error: "A budget with this name already exists for this organization." };
    }
    return { error: "Failed to update budget. Please try again." };
  }

  // Delete existing line items and re-insert
  const { error: deleteError } = await supabase
    .from("budget_line_items")
    .delete()
    .eq("budget_id", parsed.data.id);

  if (deleteError) {
    return { error: "Failed to update line items. Please try again." };
  }

  const lineItemInserts = parsedLineItems.data.map((li) => ({
    budget_id: parsed.data.id,
    category_id: li.category_id,
    amount: li.amount,
    notes: li.notes || null,
  }));

  const { error: liError } = await supabase
    .from("budget_line_items")
    .insert(lineItemInserts);

  if (liError) {
    return { error: "Failed to update line items. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/budgets/${parsed.data.id}`
  );
}

export async function deleteBudget(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Budget ID and organization ID are required." };
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

  // Verify budget belongs to org
  const { data: budget } = await supabase
    .from("budgets")
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (!budget) {
    return { error: "Budget not found." };
  }

  // Delete budget (line items cascade)
  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: "Failed to delete budget. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/budgets`);
}

export async function duplicateBudget(
  _prevState: { error: string } | { newBudgetId: string } | null,
  formData: FormData
) {
  const raw = {
    source_budget_id: formData.get("source_budget_id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string,
  };

  const parsed = duplicateBudgetSchema.safeParse(raw);
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

  // Verify org
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", parsed.data.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch source budget with line items
  const { data: source } = await supabase
    .from("budgets")
    .select(
      `
      id,
      organization_id,
      budget_line_items(
        category_id, amount, notes
      )
    `
    )
    .eq("id", parsed.data.source_budget_id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!source) {
    return { error: "Source budget not found." };
  }

  // Create new budget as draft
  const { data: newBudget, error: budgetError } = await supabase
    .from("budgets")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      status: "draft",
    })
    .select("id")
    .single();

  if (budgetError || !newBudget) {
    if (budgetError?.code === "23505") {
      return { error: "A budget with this name already exists for this organization." };
    }
    return { error: "Failed to duplicate budget. Please try again." };
  }

  // Copy line items
  const sourceLineItems = source.budget_line_items ?? [];
  if (sourceLineItems.length > 0) {
    const lineItemInserts = sourceLineItems.map(
      (li: { category_id: string; amount: number; notes: string | null }) => ({
        budget_id: newBudget.id,
        category_id: li.category_id,
        amount: li.amount,
        notes: li.notes || null,
      })
    );

    const { error: liError } = await supabase
      .from("budget_line_items")
      .insert(lineItemInserts);

    if (liError) {
      const { error: cleanupError } = await supabase
        .from("budgets")
        .delete()
        .eq("id", newBudget.id);
      if (cleanupError) {
        console.error("Failed to clean up orphaned budget:", newBudget.id, cleanupError);
      }
      return { error: "Failed to copy line items. Please try again." };
    }
  }

  revalidatePath("/dashboard", "layout");
  return { newBudgetId: newBudget.id };
}

export async function updateBudgetStatus(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    status: formData.get("status") as string,
  };

  const parsed = updateBudgetStatusSchema.safeParse(raw);
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

  // Verify the budget exists and belongs to this org
  const { data: existing } = await supabase
    .from("budgets")
    .select("id")
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!existing) {
    return { error: "Budget not found." };
  }

  const { error } = await supabase
    .from("budgets")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    return { error: "Failed to update budget status. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}
