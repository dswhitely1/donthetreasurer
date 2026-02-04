"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createSeasonSchema,
  updateSeasonSchema,
  enrollStudentsSchema,
  paymentSchema,
  updatePaymentSchema,
} from "@/lib/validations/season";

export async function createSeason(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string,
    fee_amount: formData.get("fee_amount") as string,
    status: formData.get("status") as string,
  };

  const parsed = createSeasonSchema.safeParse(raw);
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

  const { data: season, error } = await supabase
    .from("seasons")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      fee_amount: parsed.data.fee_amount,
      status: parsed.data.status,
    })
    .select("id")
    .single();

  if (error || !season) {
    return { error: "Failed to create season. Please try again." };
  }

  const intent = formData.get("_intent") as string;
  revalidatePath("/dashboard", "layout");
  if (intent === "save_and_add_another") {
    redirect(`/organizations/${parsed.data.organization_id}/seasons/new?saved=true`);
  }
  redirect(
    `/organizations/${parsed.data.organization_id}/seasons/${season.id}`
  );
}

export async function updateSeason(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string,
    fee_amount: formData.get("fee_amount") as string,
    status: formData.get("status") as string,
  };

  const parsed = updateSeasonSchema.safeParse(raw);
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
    .from("seasons")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      fee_amount: parsed.data.fee_amount,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "Failed to update season. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(
    `/organizations/${parsed.data.organization_id}/seasons/${parsed.data.id}`
  );
}

export async function deleteSeason(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Season ID and organization ID are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { count } = await supabase
    .from("season_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("season_id", id);

  if (count && count > 0) {
    return {
      error:
        "Cannot delete a season with enrollments. Archive the season instead.",
    };
  }

  const { error } = await supabase.from("seasons").delete().eq("id", id);

  if (error) {
    return { error: "Failed to delete season. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/seasons`);
}

export async function archiveSeason(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const status = formData.get("current_status") as string;

  if (!id) {
    return { error: "Season ID is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const newStatus = status === "archived" ? "active" : "archived";

  const { error } = await supabase
    .from("seasons")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    return { error: "Failed to update season status. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function enrollStudents(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const rawJson = formData.get("enrollments") as string;
  const seasonId = formData.get("season_id") as string;

  let enrollments: unknown;
  try {
    enrollments = JSON.parse(rawJson);
  } catch {
    return { error: "Invalid enrollment data." };
  }

  const parsed = enrollStudentsSchema.safeParse({
    season_id: seasonId,
    enrollments,
  });
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

  const inserts = parsed.data.enrollments.map((e) => ({
    season_id: parsed.data.season_id,
    student_id: e.student_id,
    fee_amount: e.fee_amount,
    fee_override_reason: e.fee_override_reason || null,
  }));

  const { error } = await supabase
    .from("season_enrollments")
    .insert(inserts);

  if (error) {
    if (error.code === "23505") {
      return { error: "One or more students are already enrolled in this season." };
    }
    return { error: "Failed to enroll students. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function removeEnrollment(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;

  if (!id) {
    return { error: "Enrollment ID is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { count } = await supabase
    .from("season_payments")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", id);

  if (count && count > 0) {
    return {
      error:
        "Cannot remove an enrollment with payments. Withdraw the enrollment instead.",
    };
  }

  const { error } = await supabase
    .from("season_enrollments")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: "Failed to remove enrollment. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function withdrawEnrollment(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;

  if (!id) {
    return { error: "Enrollment ID is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("season_enrollments")
    .update({ status: "withdrawn" })
    .eq("id", id);

  if (error) {
    return { error: "Failed to withdraw enrollment. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function recordPayment(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    enrollment_id: formData.get("enrollment_id") as string,
    payment_date: formData.get("payment_date") as string,
    amount: formData.get("amount") as string,
    payment_method: formData.get("payment_method") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = paymentSchema.safeParse(raw);
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

  const { error } = await supabase.from("season_payments").insert({
    enrollment_id: parsed.data.enrollment_id,
    payment_date: parsed.data.payment_date,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_method || null,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { error: "Failed to record payment. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function updatePayment(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    enrollment_id: formData.get("enrollment_id") as string,
    payment_date: formData.get("payment_date") as string,
    amount: formData.get("amount") as string,
    payment_method: formData.get("payment_method") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = updatePaymentSchema.safeParse(raw);
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
    .from("season_payments")
    .update({
      payment_date: parsed.data.payment_date,
      amount: parsed.data.amount,
      payment_method: parsed.data.payment_method || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "Failed to update payment. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}

export async function deletePayment(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;

  if (!id) {
    return { error: "Payment ID is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("season_payments")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: "Failed to delete payment. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}
