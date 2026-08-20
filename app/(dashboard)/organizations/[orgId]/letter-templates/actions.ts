"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createLetterTemplateSchema,
  updateLetterTemplateSchema,
  letterTemplateIdSchema,
} from "@/lib/validations/letter-template";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const DUPLICATE_NAME_CODE = "23505";

function listPath(orgId: string): string {
  return `/organizations/${orgId}/letter-templates`;
}

/**
 * Clears the organization's current default. The partial unique index allows
 * only one default per org, so the old one must be cleared before the new one
 * is written.
 */
async function clearDefault(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  exceptId?: string
): Promise<void> {
  let query = supabase
    .from("letter_templates")
    .update({ is_default: false })
    .eq("organization_id", organizationId)
    .eq("is_default", true);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  await query;
}

export async function createLetterTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    heading: (formData.get("heading") as string) ?? "",
    body: formData.get("body") as string,
    closing: (formData.get("closing") as string) ?? "",
    is_default: formData.get("is_default") as string,
  };

  const parsed = createLetterTemplateSchema.safeParse(raw);
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

  if (parsed.data.is_default) {
    await clearDefault(supabase, parsed.data.organization_id);
  }

  const { error } = await supabase.from("letter_templates").insert({
    organization_id: parsed.data.organization_id,
    name: parsed.data.name,
    heading: parsed.data.heading || null,
    body: parsed.data.body,
    closing: parsed.data.closing || null,
    is_default: parsed.data.is_default,
  });

  if (error) {
    if (error.code === DUPLICATE_NAME_CODE) {
      return { error: "A template with that name already exists." };
    }
    return { error: "Failed to create letter template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
  redirect(listPath(parsed.data.organization_id));
}

export async function updateLetterTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = {
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    heading: (formData.get("heading") as string) ?? "",
    body: formData.get("body") as string,
    closing: (formData.get("closing") as string) ?? "",
    is_default: formData.get("is_default") as string,
  };

  const parsed = updateLetterTemplateSchema.safeParse(raw);
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

  if (parsed.data.is_default) {
    await clearDefault(supabase, parsed.data.organization_id, parsed.data.id);
  }

  const { error } = await supabase
    .from("letter_templates")
    .update({
      name: parsed.data.name,
      heading: parsed.data.heading || null,
      body: parsed.data.body,
      closing: parsed.data.closing || null,
      is_default: parsed.data.is_default,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    if (error.code === DUPLICATE_NAME_CODE) {
      return { error: "A template with that name already exists." };
    }
    return { error: "Failed to update letter template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
  redirect(listPath(parsed.data.organization_id));
}

export async function deleteLetterTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = letterTemplateIdSchema.safeParse({
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
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

  const { error } = await supabase
    .from("letter_templates")
    .delete()
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    return { error: "Failed to delete letter template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
  redirect(listPath(parsed.data.organization_id));
}

export async function setDefaultLetterTemplate(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = letterTemplateIdSchema.safeParse({
    id: formData.get("id") as string,
    organization_id: formData.get("organization_id") as string,
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

  await clearDefault(supabase, parsed.data.organization_id, parsed.data.id);

  const { error } = await supabase
    .from("letter_templates")
    .update({ is_default: true })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    return { error: "Failed to set the default template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
}
