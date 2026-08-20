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

const DUPLICATE_CODE = "23505";
// Postgres auto-names the (organization_id, name) unique constraint
// "<table>_<columns>_key"; this substring is only present in that name, never
// in the partial "one default per org" index name, so it distinguishes which
// unique constraint a 23505 came from.
const NAME_CONSTRAINT_HINT = "_name_key";

function listPath(orgId: string): string {
  return `/organizations/${orgId}/letter-templates`;
}

const CLEAR_DEFAULT_ERROR =
  "Failed to clear the previous default template. Please try again.";
const PROMOTE_DEFAULT_ERROR =
  "Saved, but the template could not be set as default. Please try again.";
const DUPLICATE_NAME_ERROR = "A template with that name already exists.";
const CONFLICT_ERROR =
  "Could not save the letter template due to a conflict. Please try again.";

/**
 * A 23505 on this table can come from either the (organization_id, name)
 * unique constraint or the partial "one default per org" index. Only the
 * former is actually a name problem — reporting the latter as a duplicate
 * name would send the treasurer off renaming a template that has no name
 * issue.
 */
function isNameConflict(error: { message?: string; details?: string }): boolean {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return text.includes(NAME_CONSTRAINT_HINT);
}

function conflictMessage(error: { message?: string; details?: string }): string {
  return isNameConflict(error) ? DUPLICATE_NAME_ERROR : CONFLICT_ERROR;
}

/**
 * Clears the organization's current default. The partial unique index allows
 * only one default per org, so the old one must be cleared before the new one
 * is written. Returns whether the clear succeeded so callers can surface a
 * distinct error instead of letting a swallowed failure masquerade as the
 * duplicate-name conflict the subsequent write would otherwise raise.
 */
async function clearDefault(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  exceptId?: string
): Promise<boolean> {
  let query = supabase
    .from("letter_templates")
    .update({ is_default: false })
    .eq("organization_id", organizationId)
    .eq("is_default", true);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { error } = await query;
  return !error;
}

/**
 * Clears the organization's other default, then promotes `id` to default.
 * Called only after the row's own write has already succeeded, so a failure
 * here never strips an existing default out from under a write that failed.
 */
async function promoteToDefault(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  id: string
): Promise<{ error: string } | null> {
  const cleared = await clearDefault(supabase, organizationId, id);
  if (!cleared) {
    return { error: CLEAR_DEFAULT_ERROR };
  }

  const { error } = await supabase
    .from("letter_templates")
    .update({ is_default: true })
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    return { error: PROMOTE_DEFAULT_ERROR };
  }

  return null;
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

  // Always insert as non-default first: the partial unique index means only
  // one row per org can have is_default true, and a promotion is a separate
  // step run after this write succeeds, so a name conflict here never clears
  // the org's existing default.
  const { data: inserted, error } = await supabase
    .from("letter_templates")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      heading: parsed.data.heading || null,
      body: parsed.data.body,
      closing: parsed.data.closing || null,
      is_default: false,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === DUPLICATE_CODE) {
      return { error: conflictMessage(error) };
    }
    return { error: "Failed to create letter template. Please try again." };
  }

  if (parsed.data.is_default) {
    const promoteError = await promoteToDefault(
      supabase,
      parsed.data.organization_id,
      inserted.id
    );
    if (promoteError) {
      return promoteError;
    }
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

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", parsed.data.organization_id)
    .single();

  if (!org) {
    return { error: "Organization not found." };
  }

  // Write the non-default fields (forcing is_default false) first, and only
  // promote afterward on success — mirrors createLetterTemplate so a name
  // conflict on this write never clears an existing default that was about
  // to be kept or replaced.
  const { error } = await supabase
    .from("letter_templates")
    .update({
      name: parsed.data.name,
      heading: parsed.data.heading || null,
      body: parsed.data.body,
      closing: parsed.data.closing || null,
      is_default: false,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    if (error.code === DUPLICATE_CODE) {
      return { error: conflictMessage(error) };
    }
    return { error: "Failed to update letter template. Please try again." };
  }

  if (parsed.data.is_default) {
    const promoteError = await promoteToDefault(
      supabase,
      parsed.data.organization_id,
      parsed.data.id
    );
    if (promoteError) {
      return promoteError;
    }
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

  const cleared = await clearDefault(
    supabase,
    parsed.data.organization_id,
    parsed.data.id
  );
  if (!cleared) {
    return { error: CLEAR_DEFAULT_ERROR };
  }

  const { error } = await supabase
    .from("letter_templates")
    .update({ is_default: true })
    .eq("id", parsed.data.id)
    .eq("organization_id", parsed.data.organization_id);

  if (error) {
    return { error: "Failed to set the default template. Please try again." };
  }

  revalidatePath(listPath(parsed.data.organization_id));
  return null;
}
