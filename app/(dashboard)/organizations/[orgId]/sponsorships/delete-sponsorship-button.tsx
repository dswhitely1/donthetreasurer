"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { deleteSponsorship } from "./actions";

/**
 * Two-step delete control for a sponsorship row, mirroring DeleteLevelButton
 * in sponsor-levels/level-form.tsx. `deleteSponsorship` already refuses a
 * deposited sponsorship with a message pointing at its deposit transaction —
 * this is the only place in the UI that can reach it, since there is no
 * pledge stage and "log the payment" is otherwise a one-way door.
 */
export function DeleteSponsorshipButton({
  sponsorshipId,
  orgId,
}: Readonly<{ sponsorshipId: string; orgId: string }>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteSponsorship, null);

  if (isConfirming) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form action={formAction}>
          <input type="hidden" name="id" value={sponsorshipId} />
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
