"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "@/lib/validations/organization";

export async function createOrganization(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    name: formData.get("name") as string,
    ein: formData.get("ein") as string,
    fiscal_year_start_month: formData.get("fiscal_year_start_month") as string,
  };

  const parsed = createOrganizationSchema.safeParse(raw);
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

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      treasurer_id: user.id,
      name: parsed.data.name,
      ein: parsed.data.ein || null,
      fiscal_year_start_month: parsed.data.fiscal_year_start_month,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to create organization. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${data.id}`);
}

export async function updateOrganization(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    name: formData.get("name") as string,
    ein: formData.get("ein") as string,
    fiscal_year_start_month: formData.get("fiscal_year_start_month") as string,
  };

  const parsed = updateOrganizationSchema.safeParse(raw);
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

  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      ein: parsed.data.ein || null,
      fiscal_year_start_month: parsed.data.fiscal_year_start_month,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "Failed to update organization. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${parsed.data.id}`);
}

export async function deleteOrganization(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;

  if (!id) {
    return { error: "Organization ID is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return { error: "Failed to archive organization. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/organizations");
}
