"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validations/category";

export async function createCategory(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    category_type: formData.get("category_type") as string,
    parent_id: formData.get("parent_id") as string,
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

  // If subcategory, verify parent exists in same org and types match
  if (parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("id, category_type, organization_id")
      .eq("id", parentId)
      .eq("organization_id", parsed.data.organization_id)
      .eq("is_active", true)
      .single();

    if (!parent) {
      return { error: "Parent category not found." };
    }

    if (parent.category_type !== parsed.data.category_type) {
      return {
        error: "Subcategory type must match parent category type.",
      };
    }
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      category_type: parsed.data.category_type,
      parent_id: parentId,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create category. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
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
    category_type: formData.get("category_type") as string,
    parent_id: formData.get("parent_id") as string,
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

  // Fetch current category to check its structure
  const { data: current } = await supabase
    .from("categories")
    .select("id, parent_id, category_type")
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!current) {
    return { error: "Category not found." };
  }

  // If subcategory, verify new type matches parent
  if (current.parent_id) {
    const { data: parent } = await supabase
      .from("categories")
      .select("category_type")
      .eq("id", current.parent_id)
      .single();

    if (parent && parent.category_type !== parsed.data.category_type) {
      return {
        error: "Subcategory type must match parent category type.",
      };
    }
  }

  // If parent with children, verify children match new type
  if (!current.parent_id) {
    const { data: children } = await supabase
      .from("categories")
      .select("id, category_type")
      .eq("parent_id", parsed.data.id)
      .eq("is_active", true);

    if (children && children.length > 0) {
      const mismatch = children.some(
        (c) => c.category_type !== parsed.data.category_type
      );
      if (mismatch) {
        return {
          error:
            "Cannot change type: active subcategories have a different type. Update or deactivate them first.",
        };
      }
    }
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      category_type: parsed.data.category_type,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
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
