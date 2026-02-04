"use client";

import { useActionState, useState } from "react";

import type { Tables } from "@/types/database";
import { updateOrganization, deleteOrganization } from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function OrganizationActions({
  organization,
}: Readonly<{
  organization: Tables<"organizations">;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);
  const [seasonsEnabled, setSeasonsEnabled] = useState(
    organization.seasons_enabled ?? false
  );

  const [updateState, updateAction, updatePending] = useActionState(
    updateOrganization,
    null
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    deleteOrganization,
    null
  );

  return (
    <div className="mt-6 border-t border-border pt-6">
      {isEditing ? (
        <form action={updateAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={organization.id} />

          {updateState?.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {updateState.error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Organization Name</Label>
            <Input
              id="edit-name"
              name="name"
              required
              maxLength={100}
              defaultValue={organization.name}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-ein">EIN (optional)</Label>
            <Input
              id="edit-ein"
              name="ein"
              defaultValue={organization.ein ?? ""}
              placeholder="XX-XXXXXXX"
              maxLength={10}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-fiscal-month">Fiscal Year Start Month</Label>
            <Select
              name="fiscal_year_start_month"
              defaultValue={String(
                organization.fiscal_year_start_month ?? 1
              )}
            >
              <SelectTrigger id="edit-fiscal-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input
            type="hidden"
            name="seasons_enabled"
            value={seasonsEnabled ? "true" : "false"}
          />
          <div className="flex items-start gap-3">
            <Checkbox
              id="edit-seasons-enabled"
              checked={seasonsEnabled}
              onCheckedChange={(checked) =>
                setSeasonsEnabled(checked === true)
              }
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="edit-seasons-enabled">
                Enable Season Tracking
              </Label>
              <p className="text-sm text-muted-foreground">
                Track student enrollment and fee payments for seasonal programs
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={updatePending}>
              {updatePending ? "Saving\u2026" : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit
          </Button>

          {isConfirmingArchive ? (
            <>
              <form action={archiveAction}>
                <input type="hidden" name="id" value={organization.id} />
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={archivePending}
                >
                  {archivePending ? "Archiving\u2026" : "Confirm Archive"}
                </Button>
              </form>
              <Button
                variant="outline"
                onClick={() => setIsConfirmingArchive(false)}
              >
                Cancel
              </Button>
              {archiveState?.error && (
                <span className="self-center text-sm text-destructive">
                  {archiveState.error}
                </span>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsConfirmingArchive(true)}
            >
              Archive
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
