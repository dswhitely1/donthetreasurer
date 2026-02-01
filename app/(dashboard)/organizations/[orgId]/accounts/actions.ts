"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createAccountSchema,
  updateAccountSchema,
} from "@/lib/validations/account";

export async function createAccount(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    account_type: formData.get("account_type") as string,
    description: formData.get("description") as string,
    opening_balance: formData.get("opening_balance") as string,
    fee_percentage: (formData.get("fee_percentage") as string) ?? "",
    fee_flat_amount: (formData.get("fee_flat_amount") as string) ?? "",
    fee_category_id: (formData.get("fee_category_id") as string) ?? "",
  };

  const parsed = createAccountSchema.safeParse(raw);
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

  // Validate fee category if provided
  if (parsed.data.fee_category_id) {
    const { data: feeCat } = await supabase
      .from("categories")
      .select("id, category_type, organization_id, is_active")
      .eq("id", parsed.data.fee_category_id)
      .single();

    if (!feeCat) {
      return { error: "Fee category not found." };
    }
    if (!feeCat.is_active) {
      return { error: "Fee category is inactive." };
    }
    if (feeCat.organization_id !== parsed.data.organization_id) {
      return { error: "Fee category must belong to the same organization." };
    }
    if (feeCat.category_type !== "expense") {
      return { error: "Fee category must be an expense category." };
    }
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      account_type: parsed.data.account_type,
      description: parsed.data.description || null,
      opening_balance: parsed.data.opening_balance,
      fee_percentage: parsed.data.fee_percentage ?? null,
      fee_flat_amount: parsed.data.fee_flat_amount ?? null,
      fee_category_id: parsed.data.fee_category_id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create account. Please try again." };
  }

  const intent = formData.get("_intent") as string;
  revalidatePath("/dashboard", "layout");
  if (intent === "save_and_add_another") {
    redirect(`/organizations/${parsed.data.organization_id}/accounts/new?saved=true`);
  }
  redirect(
    `/organizations/${parsed.data.organization_id}/accounts/${data.id}`
  );
}

export async function updateAccount(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    account_type: formData.get("account_type") as string,
    description: formData.get("description") as string,
    opening_balance: formData.get("opening_balance") as string,
    fee_percentage: (formData.get("fee_percentage") as string) ?? "",
    fee_flat_amount: (formData.get("fee_flat_amount") as string) ?? "",
    fee_category_id: (formData.get("fee_category_id") as string) ?? "",
  };

  const parsed = updateAccountSchema.safeParse(raw);
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

  // Validate fee category if provided
  if (parsed.data.fee_category_id) {
    const { data: feeCat } = await supabase
      .from("categories")
      .select("id, category_type, organization_id, is_active")
      .eq("id", parsed.data.fee_category_id)
      .single();

    if (!feeCat) {
      return { error: "Fee category not found." };
    }
    if (!feeCat.is_active) {
      return { error: "Fee category is inactive." };
    }
    if (feeCat.organization_id !== parsed.data.organization_id) {
      return { error: "Fee category must belong to the same organization." };
    }
    if (feeCat.category_type !== "expense") {
      return { error: "Fee category must be an expense category." };
    }
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name: parsed.data.name,
      account_type: parsed.data.account_type,
      description: parsed.data.description || null,
      opening_balance: parsed.data.opening_balance,
      fee_percentage: parsed.data.fee_percentage ?? null,
      fee_flat_amount: parsed.data.fee_flat_amount ?? null,
      fee_category_id: parsed.data.fee_category_id ?? null,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    return { error: "Failed to update account. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/accounts/${parsed.data.id}`
  );
}

export async function deactivateAccount(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Account ID and organization ID are required." };
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

  const { error } = await supabase
    .from("accounts")
    .update({ is_active: false })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    return { error: "Failed to deactivate account. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/accounts`);
}
