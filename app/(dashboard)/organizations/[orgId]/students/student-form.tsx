"use client";

import { useActionState, useId } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createStudent, updateStudent } from "./actions";

import type { Tables } from "@/types/database";

interface StudentFormProps {
  mode: "create" | "edit";
  orgId: string;
  defaultValues?: Tables<"students">;
  showSaved?: boolean;
}

export function StudentForm({
  mode,
  orgId,
  defaultValues,
  showSaved,
}: Readonly<StudentFormProps>) {
  const formId = useId();
  const action = mode === "create" ? createStudent : updateStudent;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && defaultValues && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}
      <input type="hidden" name="organization_id" value={orgId} />

      {showSaved && !state?.error && (
        <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Student saved successfully. Add another below.
        </div>
      )}

      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-first-name`}>First Name</Label>
          <Input
            id={`${formId}-first-name`}
            name="first_name"
            required
            maxLength={100}
            defaultValue={defaultValues?.first_name ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-last-name`}>Last Name</Label>
          <Input
            id={`${formId}-last-name`}
            name="last_name"
            required
            maxLength={100}
            defaultValue={defaultValues?.last_name ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-email`}>Email (optional)</Label>
          <Input
            id={`${formId}-email`}
            name="email"
            type="email"
            maxLength={255}
            defaultValue={defaultValues?.email ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-phone`}>Phone (optional)</Label>
          <Input
            id={`${formId}-phone`}
            name="phone"
            maxLength={30}
            defaultValue={defaultValues?.phone ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-guardian-name`}>
            Guardian Name (optional)
          </Label>
          <Input
            id={`${formId}-guardian-name`}
            name="guardian_name"
            maxLength={200}
            defaultValue={defaultValues?.guardian_name ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-guardian-email`}>
            Guardian Email (optional)
          </Label>
          <Input
            id={`${formId}-guardian-email`}
            name="guardian_email"
            type="email"
            maxLength={255}
            defaultValue={defaultValues?.guardian_email ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-guardian-phone`}>
          Guardian Phone (optional)
        </Label>
        <Input
          id={`${formId}-guardian-phone`}
          name="guardian_phone"
          maxLength={30}
          defaultValue={defaultValues?.guardian_phone ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-notes`}>Notes (optional)</Label>
        <Textarea
          id={`${formId}-notes`}
          name="notes"
          maxLength={2000}
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
        />
      </div>

      <div className="mt-2 flex gap-3">
        <Button type="submit" name="_intent" value="save" disabled={pending}>
          {pending
            ? mode === "create"
              ? "Creating\u2026"
              : "Saving\u2026"
            : mode === "create"
              ? "Create Student"
              : "Save Changes"}
        </Button>
        {mode === "create" && (
          <Button
            type="submit"
            name="_intent"
            value="save_and_add_another"
            variant="secondary"
            disabled={pending}
          >
            {pending ? "Saving\u2026" : "Save & Add Another"}
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/organizations/${orgId}/students`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
