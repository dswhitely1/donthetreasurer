"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSponsor, deleteSponsor, updateSponsor } from "./actions";

import type { Tables } from "@/types/database";

interface SponsorFormProps {
  mode: "create" | "edit";
  orgId: string;
  defaultValues?: Tables<"sponsors">;
}

export function SponsorForm({
  mode,
  orgId,
  defaultValues,
}: Readonly<SponsorFormProps>) {
  const formId = useId();
  const action = mode === "create" ? createSponsor : updateSponsor;
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-name`}>Sponsor Name</Label>
        <Input
          id={`${formId}-name`}
          name="name"
          required
          maxLength={150}
          defaultValue={defaultValues?.name ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-contact-name`}>
            Contact Name (optional)
          </Label>
          <Input
            id={`${formId}-contact-name`}
            name="contact_name"
            maxLength={100}
            defaultValue={defaultValues?.contact_name ?? ""}
          />
        </div>

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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-address-line1`}>
          Address Line 1 (optional)
        </Label>
        <Input
          id={`${formId}-address-line1`}
          name="address_line1"
          maxLength={150}
          defaultValue={defaultValues?.address_line1 ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-address-line2`}>
          Address Line 2 (optional)
        </Label>
        <Input
          id={`${formId}-address-line2`}
          name="address_line2"
          maxLength={150}
          defaultValue={defaultValues?.address_line2 ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-city`}>City (optional)</Label>
          <Input
            id={`${formId}-city`}
            name="city"
            maxLength={100}
            defaultValue={defaultValues?.city ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-state`}>State (optional)</Label>
          <Input
            id={`${formId}-state`}
            name="state"
            maxLength={50}
            defaultValue={defaultValues?.state ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-postal-code`}>
            Postal Code (optional)
          </Label>
          <Input
            id={`${formId}-postal-code`}
            name="postal_code"
            maxLength={20}
            defaultValue={defaultValues?.postal_code ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-notes`}>Notes (optional)</Label>
        <Textarea
          id={`${formId}-notes`}
          name="notes"
          maxLength={1000}
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
        />
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
            Inactive sponsors stay on past sponsorships but no longer appear
            as a choice for new ones.
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
              ? "Create Sponsor"
              : "Save Changes"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/organizations/${orgId}/sponsors`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

/** Two-step delete control for a sponsor, mirroring DeleteLevelButton. */
export function DeleteSponsorButton({
  sponsorId,
  orgId,
}: Readonly<{ sponsorId: string; orgId: string }>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteSponsor, null);

  if (isConfirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <form action={formAction}>
          <input type="hidden" name="id" value={sponsorId} />
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
      Delete Sponsor
    </Button>
  );
}
