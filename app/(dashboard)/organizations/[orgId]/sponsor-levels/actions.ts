"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import {
  createSponsorLevelSchema,
  updateSponsorLevelSchema,
} from "@/lib/validations/sponsor";

export async function createSponsorLevel(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = createSponsorLevelSchema.safeParse({
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    default_amount: formData.get("default_amount") as string,
    description: (formData.get("description") as string) ?? "",
    sort_order: (formData.get("sort_order") as string) || "0",
    // The hidden input mirrors state and always emits the literal string
    // "true" or "false" (see organization-actions.tsx), so a plain read is
    // reliable here.
    is_active: formData.get("is_active") === "true" ? "true" : "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const org = await fetchSponsorsOrg(supabase, parsed.data.organization_id);
  if (!org) return { error: "Sponsor tracking is not enabled." };

  const { error } = await supabase.from("sponsor_levels").insert({
    organization_id: parsed.data.organization_id,
    name: parsed.data.name,
    default_amount: parsed.data.default_amount,
    description: parsed.data.description || null,
    sort_order: parsed.data.sort_order,
    is_active: parsed.data.is_active,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A level with that name already exists." };
    }
    return { error: "Failed to create the level. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${parsed.data.organization_id}/sponsor-levels`);
}

export async function updateSponsorLevel(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = updateSponsorLevelSchema.safeParse({
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    default_amount: formData.get("default_amount") as string,
    description: (formData.get("description") as string) ?? "",
    sort_order: (formData.get("sort_order") as string) || "0",
    is_active: formData.get("is_active") === "true" ? "true" : "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const org = await fetchSponsorsOrg(supabase, parsed.data.organization_id);
  if (!org) return { error: "Sponsor tracking is not enabled." };

  const { error } = await supabase
    .from("sponsor_levels")
    .update({
      name: parsed.data.name,
      default_amount: parsed.data.default_amount,
      description: parsed.data.description || null,
      sort_order: parsed.data.sort_order,
      is_active: parsed.data.is_active,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A level with that name already exists." };
    }
    return { error: "Failed to update the level. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${parsed.data.organization_id}/sponsor-levels`);
}

export async function deleteSponsorLevel(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const org = await fetchSponsorsOrg(supabase, organizationId);
  if (!org) return { error: "Sponsor tracking is not enabled." };

  const { error } = await supabase
    .from("sponsor_levels")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    // ON DELETE RESTRICT from sponsorships. Deactivating keeps the history
    // intact, which is what the treasurer actually wants here.
    if (error.code === "23503") {
      return {
        error:
          "This level is in use by one or more sponsorships and cannot be deleted. Mark it inactive instead.",
      };
    }
    return { error: "Failed to delete the level. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/sponsor-levels`);
}
