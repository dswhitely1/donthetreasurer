"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import {
  createSponsorSchema,
  updateSponsorSchema,
} from "@/lib/validations/sponsor";

export async function createSponsor(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = createSponsorSchema.safeParse({
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    contact_name: (formData.get("contact_name") as string) ?? "",
    email: (formData.get("email") as string) ?? "",
    phone: (formData.get("phone") as string) ?? "",
    address_line1: (formData.get("address_line1") as string) ?? "",
    address_line2: (formData.get("address_line2") as string) ?? "",
    city: (formData.get("city") as string) ?? "",
    state: (formData.get("state") as string) ?? "",
    postal_code: (formData.get("postal_code") as string) ?? "",
    notes: (formData.get("notes") as string) ?? "",
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

  // Generated here (rather than read back after insert) so the redirect can
  // target the new sponsor's detail page without a second round trip.
  const id = randomUUID();

  const { error } = await supabase.from("sponsors").insert({
    id,
    organization_id: parsed.data.organization_id,
    name: parsed.data.name,
    contact_name: parsed.data.contact_name || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address_line1: parsed.data.address_line1 || null,
    address_line2: parsed.data.address_line2 || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    postal_code: parsed.data.postal_code || null,
    notes: parsed.data.notes || null,
    is_active: parsed.data.is_active,
  });

  if (error) {
    return { error: "Failed to create the sponsor. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${parsed.data.organization_id}/sponsors/${id}`);
}

export async function updateSponsor(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = updateSponsorSchema.safeParse({
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    contact_name: (formData.get("contact_name") as string) ?? "",
    email: (formData.get("email") as string) ?? "",
    phone: (formData.get("phone") as string) ?? "",
    address_line1: (formData.get("address_line1") as string) ?? "",
    address_line2: (formData.get("address_line2") as string) ?? "",
    city: (formData.get("city") as string) ?? "",
    state: (formData.get("state") as string) ?? "",
    postal_code: (formData.get("postal_code") as string) ?? "",
    notes: (formData.get("notes") as string) ?? "",
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
    .from("sponsors")
    .update({
      name: parsed.data.name,
      contact_name: parsed.data.contact_name || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address_line1: parsed.data.address_line1 || null,
      address_line2: parsed.data.address_line2 || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      postal_code: parsed.data.postal_code || null,
      notes: parsed.data.notes || null,
      is_active: parsed.data.is_active,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    return { error: "Failed to update the sponsor. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/sponsors/${parsed.data.id}`
  );
}

export async function deleteSponsor(
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
    .from("sponsors")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    // ON DELETE RESTRICT from sponsorships. Deactivating keeps the history
    // intact, which is what the treasurer actually wants here.
    if (error.code === "23503") {
      return {
        error:
          "This sponsor has sponsorship history and cannot be deleted. Mark them inactive instead.",
      };
    }
    return { error: "Failed to delete the sponsor. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/sponsors`);
}
