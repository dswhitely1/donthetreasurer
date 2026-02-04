"use client";

import { useActionState, useId } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEASON_STATUSES, SEASON_STATUS_LABELS } from "@/lib/validations/season";
import { createSeason, updateSeason } from "./actions";

import type { Tables } from "@/types/database";

interface SeasonFormProps {
  mode: "create" | "edit";
  orgId: string;
  defaultValues?: Tables<"seasons">;
  showSaved?: boolean;
}

export function SeasonForm({
  mode,
  orgId,
  defaultValues,
  showSaved,
}: Readonly<SeasonFormProps>) {
  const formId = useId();
  const action = mode === "create" ? createSeason : updateSeason;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && defaultValues && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}
      <input type="hidden" name="organization_id" value={orgId} />

      {showSaved && !state?.error && (
        <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Season saved successfully. Add another below.
        </div>
      )}

      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-name`}>Season Name</Label>
        <Input
          id={`${formId}-name`}
          name="name"
          required
          maxLength={150}
          placeholder='e.g. "Spring Soccer 2026"'
          defaultValue={defaultValues?.name ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-description`}>Description (optional)</Label>
        <Textarea
          id={`${formId}-description`}
          name="description"
          maxLength={2000}
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-start-date`}>Start Date</Label>
          <Input
            id={`${formId}-start-date`}
            name="start_date"
            type="date"
            required
            defaultValue={defaultValues?.start_date ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-end-date`}>End Date</Label>
          <Input
            id={`${formId}-end-date`}
            name="end_date"
            type="date"
            required
            defaultValue={defaultValues?.end_date ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-fee`}>Fee Amount</Label>
          <Input
            id={`${formId}-fee`}
            name="fee_amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultValues?.fee_amount ?? "0.00"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-status`}>Status</Label>
          <Select
            name="status"
            defaultValue={defaultValues?.status ?? "active"}
          >
            <SelectTrigger id={`${formId}-status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEASON_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {SEASON_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <Button type="submit" name="_intent" value="save" disabled={pending}>
          {pending
            ? mode === "create"
              ? "Creating\u2026"
              : "Saving\u2026"
            : mode === "create"
              ? "Create Season"
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
          <Link href={`/organizations/${orgId}/seasons`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
