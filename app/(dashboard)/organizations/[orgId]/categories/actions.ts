"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createCategorySchema,
  updateCategorySchema,
  mergeCategorySchema,
  reassignCategorySchema,
} from "@/lib/validations/category";

/**
 * The partial unique index added by 20260826000001_untyped_categories.sql:
 * (organization_id, parent_id, lower(trim(name))) NULLS NOT DISTINCT
 * WHERE is_active.
 */
const UNIQUE_ACTIVE_NAME_INDEX = "idx_categories_unique_active_name";
const DUPLICATE_NAME_ERROR =
  "A category with that name already exists here. Pick a different name.";

/** True when a write collided with the unique active-name index (SQLSTATE 23505). */
function isDuplicateActiveName(
  error: { code?: string; message?: string; details?: string | null } | null
): boolean {
  if (!error || error.code !== "23505") return false;
  return `${error.message ?? ""} ${error.details ?? ""}`.includes(
    UNIQUE_ACTIVE_NAME_INDEX
  );
}

export async function createCategory(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    parent_id: (formData.get("parent_id") as string) ?? "",
  };

  const parsed = createCategorySchema.safeParse(raw);
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

  const parentId = parsed.data.parent_id || null;

  // If subcategory, verify parent exists in the same org
  if (parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("id, organization_id")
      .eq("id", parentId)
      .eq("organization_id", parsed.data.organization_id)
      .eq("is_active", true)
      .single();

    if (!parent) {
      return { error: "Parent category not found." };
    }
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      parent_id: parentId,
    })
    .select("id")
    .single();

  if (error) {
    if (isDuplicateActiveName(error)) {
      return { error: DUPLICATE_NAME_ERROR };
    }
    return { error: "Failed to create category. Please try again." };
  }

  const intent = formData.get("_intent") as string;
  revalidatePath("/dashboard", "layout");
  if (intent === "save_and_add_another") {
    redirect(`/organizations/${parsed.data.organization_id}/categories/new?saved=true`);
  }
  redirect(
    `/organizations/${parsed.data.organization_id}/categories/${data.id}`
  );
}

export async function updateCategory(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    parent_id: (formData.get("parent_id") as string) ?? "",
  };

  const parsed = updateCategorySchema.safeParse(raw);
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

  // Fetch current category to confirm it exists in this organization
  const { data: current } = await supabase
    .from("categories")
    .select("id, parent_id")
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!current) {
    return { error: "Category not found." };
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    if (isDuplicateActiveName(error)) {
      return { error: DUPLICATE_NAME_ERROR };
    }
    return { error: "Failed to update category. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/categories/${parsed.data.id}`
  );
}

export async function deactivateCategory(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Category ID and organization ID are required." };
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

  // Check for transaction line items referencing this category
  const { count: lineItemCount } = await supabase
    .from("transaction_line_items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (lineItemCount && lineItemCount > 0) {
    return {
      error: `Cannot deactivate: ${lineItemCount} transaction line item${lineItemCount === 1 ? "" : "s"} use this category.`,
    };
  }

  // If parent category, check for active subcategories
  const { count: childCount } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id)
    .eq("is_active", true);

  if (childCount && childCount > 0) {
    return {
      error: `Cannot deactivate: ${childCount} active subcategor${childCount === 1 ? "y" : "ies"} must be deactivated first.`,
    };
  }

  const { error } = await supabase
    .from("categories")
    .update({ is_active: false })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    return { error: "Failed to deactivate category. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/categories`);
}

export async function mergeCategory(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    source_id: formData.get("source_id") as string,
    target_id: formData.get("target_id") as string,
    organization_id: formData.get("organization_id") as string,
  };

  const parsed = mergeCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { source_id, target_id, organization_id } = parsed.data;

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
    .eq("id", organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Atomic merge via RPC — validates, reassigns line items, hard-deletes source
  const { error } = await supabase.rpc("merge_categories", {
    p_source_id: source_id,
    p_target_id: target_id,
    p_organization_id: organization_id,
  });

  if (error) {
    // RPC RAISE EXCEPTION messages come through as error.message
    return { error: error.message || "Failed to merge categories. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organization_id}/categories/${target_id}`);
}

export async function reassignCategory(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    new_parent_id: formData.get("new_parent_id") as string,
  };

  const parsed = reassignCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { id, organization_id, new_parent_id } = parsed.data;

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
    .eq("id", organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Fetch the source category
  const { data: source } = await supabase
    .from("categories")
    .select("id, parent_id, is_active")
    .eq("id", id)
    .eq("organization_id", organization_id)
    .single();

  if (!source) {
    return { error: "Category not found." };
  }

  if (source.parent_id) {
    return { error: "Only top-level categories can be reassigned." };
  }

  // Verify no active subcategories
  const { count: childCount } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id)
    .eq("is_active", true);

  if (childCount && childCount > 0) {
    return {
      error: "Cannot reassign: category has active subcategories.",
    };
  }

  // Fetch the target parent
  const { data: target } = await supabase
    .from("categories")
    .select("id, parent_id, is_active")
    .eq("id", new_parent_id)
    .eq("organization_id", organization_id)
    .single();

  if (!target) {
    return { error: "Target parent category not found." };
  }

  if (target.parent_id) {
    return { error: "Target must be a top-level category." };
  }

  if (!target.is_active) {
    return { error: "Target category is not active." };
  }

  const { error } = await supabase
    .from("categories")
    .update({ parent_id: new_parent_id })
    .eq("id", id)
    .eq("organization_id", organization_id);

  if (error) {
    if (isDuplicateActiveName(error)) {
      return { error: DUPLICATE_NAME_ERROR };
    }
    return { error: "Failed to reassign category. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organization_id}/categories/${id}`);
}

export async function createCategoryInline(
  _prevState:
    | { error: string; data?: null }
    | { data: { id: string; name: string; parent_id: string | null }; error?: null }
    | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    parent_id: (formData.get("parent_id") as string) ?? "",
  };

  const parsed = createCategorySchema.safeParse(raw);
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

  const parentId = parsed.data.parent_id || null;

  // If subcategory, verify parent exists in the same org
  if (parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("id, organization_id")
      .eq("id", parentId)
      .eq("organization_id", parsed.data.organization_id)
      .eq("is_active", true)
      .single();

    if (!parent) {
      return { error: "Parent category not found." };
    }
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      parent_id: parentId,
    })
    .select("id, name, parent_id")
    .single();

  if (error) {
    if (isDuplicateActiveName(error)) {
      return { error: DUPLICATE_NAME_ERROR };
    }
    return { error: "Failed to create category. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return { data };
}
