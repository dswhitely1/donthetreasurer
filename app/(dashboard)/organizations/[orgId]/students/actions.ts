"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createStudentSchema,
  updateStudentSchema,
} from "@/lib/validations/student";

export async function createStudent(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    guardian_name: formData.get("guardian_name") as string,
    guardian_email: formData.get("guardian_email") as string,
    guardian_phone: formData.get("guardian_phone") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = createStudentSchema.safeParse(raw);
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

  const { error } = await supabase.from("students").insert({
    organization_id: parsed.data.organization_id,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    guardian_name: parsed.data.guardian_name || null,
    guardian_email: parsed.data.guardian_email || null,
    guardian_phone: parsed.data.guardian_phone || null,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { error: "Failed to create student. Please try again." };
  }

  const intent = formData.get("_intent") as string;
  revalidatePath("/dashboard", "layout");
  if (intent === "save_and_add_another") {
    redirect(`/organizations/${parsed.data.organization_id}/students/new?saved=true`);
  }
  redirect(`/organizations/${parsed.data.organization_id}/students`);
}

export async function updateStudent(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,
    guardian_name: formData.get("guardian_name") as string,
    guardian_email: formData.get("guardian_email") as string,
    guardian_phone: formData.get("guardian_phone") as string,
    notes: formData.get("notes") as string,
  };

  const parsed = updateStudentSchema.safeParse(raw);
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
    .from("students")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      guardian_name: parsed.data.guardian_name || null,
      guardian_email: parsed.data.guardian_email || null,
      guardian_phone: parsed.data.guardian_phone || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "Failed to update student. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${parsed.data.organization_id}/students`);
}

export async function deleteStudent(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const organizationId = formData.get("organization_id") as string;

  if (!id || !organizationId) {
    return { error: "Student ID and organization ID are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Check for enrollments
  const { count } = await supabase
    .from("season_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", id);

  if (count && count > 0) {
    return {
      error:
        "Cannot delete a student with enrollment history. Deactivate the student instead.",
    };
  }

  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) {
    return { error: "Failed to delete student. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/organizations/${organizationId}/students`);
}

export async function toggleStudentActive(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const id = formData.get("id") as string;
  const isActive = formData.get("is_active") === "true";

  if (!id) {
    return { error: "Student ID is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("students")
    .update({ is_active: !isActive })
    .eq("id", id);

  if (error) {
    return { error: "Failed to update student status. Please try again." };
  }

  revalidatePath("/dashboard", "layout");
  return null;
}
