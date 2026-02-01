"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function updateProfile(
  _prevState: { error: string } | { success: true } | null,
  formData: FormData
) {
  const name = (formData.get("name") as string)?.trim();

  if (!name || name.length < 1) {
    return { error: "Name is required." };
  }

  if (name.length > 100) {
    return { error: "Name must be 100 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("treasurers")
    .update({ name })
    .eq("id", user.id);

  if (error) {
    return { error: "Failed to update profile. Please try again." };
  }

  revalidatePath("/", "layout");
  return { success: true as const };
}

export async function changePassword(
  _prevState: { error: string } | { success: true } | null,
  formData: FormData
) {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Re-authenticate with current password to verify identity
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (signInError) {
    return { error: "Current password is incorrect." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: "Failed to update password. Please try again." };
  }

  return { success: true as const };
}

export async function deleteAccount(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const confirmation = (formData.get("confirmation") as string)?.trim();

  if (confirmation !== "DELETE") {
    return { error: 'Please type "DELETE" to confirm account deletion.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Delete treasurer row - cascades to organizations, accounts, transactions, etc.
  const { error } = await supabase
    .from("treasurers")
    .delete()
    .eq("id", user.id);

  if (error) {
    return { error: "Failed to delete account. Please try again." };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
