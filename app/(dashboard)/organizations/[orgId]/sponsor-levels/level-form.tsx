"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSponsorLevel, deleteSponsorLevel, updateSponsorLevel } from "./actions";

import type { Tables } from "@/types/database";

interface LevelFormProps {
  mode: "create" | "edit";
  orgId: string;
  defaultValues?: Tables<"sponsor_levels">;
}

export function LevelForm({
  mode,
  orgId,
  defaultValues,
}: Readonly<LevelFormProps>) {
  const formId = useId();
  const action = mode === "create" ? createSponsorLevel : updateSponsorLevel;
  const [state, formAction, pending] = useActionState(action, null);
  const [isActive, setIsActive] = useState(defaultValues?.is_active ?? true);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && defaultValues && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}
      <input type="hidden" name="organization_id" value={orgId} />

      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-name`}>Name</Label>
          <Input
            id={`${formId}-name`}
            name="name"
            required
            maxLength={100}
            defaultValue={defaultValues?.name ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-default-amount`}>Default Amount</Label>
          <Input
            id={`${formId}-default-amount`}
            name="default_amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultValues?.default_amount ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-description`}>Description (optional)</Label>
        <Textarea
          id={`${formId}-description`}
          name="description"
          maxLength={500}
          rows={2}
          defaultValue={defaultValues?.description ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-sort-order`}>Sort Order</Label>
          <Input
            id={`${formId}-sort-order`}
            name="sort_order"
            type="number"
            step="1"
            defaultValue={defaultValues?.sort_order ?? 0}
          />
        </div>
      </div>

      <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${formId}-is-active`}
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked === true)}
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={`${formId}-is-active`}>Active</Label>
          <p className="text-sm text-muted-foreground">
            Inactive levels stay on past sponsorships but no longer appear as
            a choice for new ones.
          </p>
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? "Create Level"
              : "Save Changes"}
        </Button>
        {mode === "edit" && (
          <Button variant="outline" asChild>
            <Link href={`/organizations/${orgId}/sponsor-levels`}>Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}

/** Two-step delete control for a level row, mirroring template-actions.tsx. */
export function DeleteLevelButton({
  levelId,
  orgId,
}: Readonly<{ levelId: string; orgId: string }>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteSponsorLevel, null);

  if (isConfirming) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form action={formAction}>
          <input type="hidden" name="id" value={levelId} />
          <input type="hidden" name="organization_id" value={orgId} />
          <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? "Deleting…" : "Confirm Delete"}
          </Button>
        </form>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsConfirming(false)}
        >
          Cancel
        </Button>
        {state?.error && (
          <span className="text-sm text-destructive">{state.error}</span>
        )}
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => setIsConfirming(true)}>
      Delete
    </Button>
  );
}
