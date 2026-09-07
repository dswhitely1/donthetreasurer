"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { fetchSponsorsOrg } from "@/lib/sponsors/guard";
import {
  createSponsorshipSchema,
  updateSponsorshipSchema,
} from "@/lib/validations/sponsor";

export async function createSponsorship(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = createSponsorshipSchema.safeParse({
    organization_id: formData.get("organization_id") as string,
    sponsor_id: formData.get("sponsor_id") as string,
    level_id: formData.get("level_id") as string,
    term_start_date: formData.get("term_start_date") as string,
    term_end_date: formData.get("term_end_date") as string,
    amount: formData.get("amount") as string,
    payment_method: formData.get("payment_method") as string,
    check_number: (formData.get("check_number") as string) ?? "",
    received_date: formData.get("received_date") as string,
    notes: (formData.get("notes") as string) ?? "",
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

  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("id")
    .eq("id", parsed.data.sponsor_id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!sponsor) return { error: "Sponsor not found." };

  const { data: level } = await supabase
    .from("sponsor_levels")
    .select("id")
    .eq("id", parsed.data.level_id)
    .eq("organization_id", parsed.data.organization_id)
    .single();

  if (!level) return { error: "Sponsorship level not found." };

  const { error } = await supabase.from("sponsorships").insert({
    sponsor_id: parsed.data.sponsor_id,
    level_id: parsed.data.level_id,
    term_start_date: parsed.data.term_start_date,
    term_end_date: parsed.data.term_end_date,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_method,
    check_number: parsed.data.check_number || null,
    received_date: parsed.data.received_date,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { error: "Failed to log the sponsorship payment. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/sponsors/${parsed.data.sponsor_id}`
  );
}

export async function updateSponsorship(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = updateSponsorshipSchema.safeParse({
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    sponsor_id: formData.get("sponsor_id") as string,
    level_id: formData.get("level_id") as string,
    term_start_date: formData.get("term_start_date") as string,
    term_end_date: formData.get("term_end_date") as string,
    amount: formData.get("amount") as string,
    payment_method: formData.get("payment_method") as string,
    check_number: (formData.get("check_number") as string) ?? "",
    received_date: formData.get("received_date") as string,
    notes: (formData.get("notes") as string) ?? "",
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

  const { data: existing } = await supabase
    .from("sponsorships")
    .select(
      "id, amount, level_id, payment_method, transaction_id, sponsors!inner(organization_id)"
    )
    .eq("id", parsed.data.id)
    .eq("sponsors.organization_id", parsed.data.organization_id)
    .single();

  if (!existing) return { error: "Sponsorship not found." };

  // The ledger line for a deposited sponsorship already exists. Letting the
  // amount drift away from it would silently desynchronize the two, so the
  // treasurer edits the deposit instead — deleting it returns every
  // sponsorship on it to the queue.
  if (existing.transaction_id) {
    const changesLockedFields =
      Number(existing.amount) !== parsed.data.amount ||
      existing.level_id !== parsed.data.level_id ||
      existing.payment_method !== parsed.data.payment_method;

    if (changesLockedFields) {
      return {
        error:
          "This sponsorship has already been deposited. Delete or edit the deposit transaction to change its amount, level, or payment method.",
      };
    }
  }

  const { error } = await supabase
    .from("sponsorships")
    .update({
      sponsor_id: parsed.data.sponsor_id,
      level_id: parsed.data.level_id,
      term_start_date: parsed.data.term_start_date,
      term_end_date: parsed.data.term_end_date,
      amount: parsed.data.amount,
      payment_method: parsed.data.payment_method,
      check_number: parsed.data.check_number || null,
      received_date: parsed.data.received_date,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "Failed to update the sponsorship. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/sponsors/${parsed.data.sponsor_id}`
  );
}

export async function deleteSponsorship(
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

  const { data: existing } = await supabase
    .from("sponsorships")
    .select("id, sponsor_id, transaction_id, sponsors!inner(organization_id)")
    .eq("id", id)
    .eq("sponsors.organization_id", organizationId)
    .single();

  if (!existing) return { error: "Sponsorship not found." };

  if (existing.transaction_id) {
    return {
      error:
        "This sponsorship is part of a deposit. Delete the deposit transaction first — that returns its payments to the queue.",
    };
  }

  const { error } = await supabase.from("sponsorships").delete().eq("id", id);

  if (error) {
    return { error: "Failed to delete the sponsorship. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/sponsors/${existing.sponsor_id}`);
}
