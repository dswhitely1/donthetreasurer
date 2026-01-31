"use client";

import { useActionState, useState } from "react";

import type { Tables } from "@/types/database";
import { updateAccount, deactivateAccount } from "../actions";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
} from "@/lib/validations/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AccountActions({
  account,
  orgId,
}: Readonly<{
  account: Tables<"accounts">;
  orgId: string;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);

  const [updateState, updateAction, updatePending] = useActionState(
    updateAccount,
    null
  );
  const [deactivateState, deactivateAction, deactivatePending] =
    useActionState(deactivateAccount, null);

  return (
    <div className="mt-6 border-t border-border pt-6">
      {isEditing ? (
        <form action={updateAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="organization_id" value={orgId} />

          {updateState?.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {updateState.error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Account Name</Label>
            <Input
              id="edit-name"
              name="name"
              required
              maxLength={100}
              defaultValue={account.name}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-account-type">Account Type</Label>
            <Select
              name="account_type"
              defaultValue={account.account_type}
            >
              <SelectTrigger id="edit-account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ACCOUNT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Input
              id="edit-description"
              name="description"
              maxLength={500}
              defaultValue={account.description ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-opening-balance">Opening Balance</Label>
            <Input
              id="edit-opening-balance"
              name="opening_balance"
              type="number"
              step="0.01"
              min="0"
              defaultValue={account.opening_balance ?? 0}
            />
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

          {isConfirmingDeactivate ? (
            <>
              <form action={deactivateAction}>
                <input type="hidden" name="id" value={account.id} />
                <input
                  type="hidden"
                  name="organization_id"
                  value={orgId}
                />
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deactivatePending}
                >
                  {deactivatePending
                    ? "Deactivating\u2026"
                    : "Confirm Deactivate"}
                </Button>
              </form>
              <Button
                variant="outline"
                onClick={() => setIsConfirmingDeactivate(false)}
              >
                Cancel
              </Button>
              {deactivateState?.error && (
                <span className="self-center text-sm text-destructive">
                  {deactivateState.error}
                </span>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsConfirmingDeactivate(true)}
            >
              Deactivate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
