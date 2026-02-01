"use client";

import { useActionState } from "react";
import Link from "next/link";

import { createAccount } from "../actions";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "@/lib/validations/account";
import { FeeConfigFields } from "../fee-config-fields";
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

import type { ExpenseCategory } from "../fee-config-fields";

export function NewAccountForm({
  orgId,
  expenseCategories,
  showSaved,
}: Readonly<{
  orgId: string;
  expenseCategories: ExpenseCategory[];
  showSaved?: boolean;
}>) {
  const [state, formAction, pending] = useActionState(createAccount, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organization_id" value={orgId} />

      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {showSaved && !state?.error && (
        <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Account saved successfully. Add another below.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Account Name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          placeholder="e.g. Main Checking"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account_type">Account Type</Label>
        <Select name="account_type" defaultValue="checking">
          <SelectTrigger id="account_type">
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
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          name="description"
          maxLength={500}
          placeholder="e.g. Primary operating account"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="opening_balance">Opening Balance</Label>
        <Input
          id="opening_balance"
          name="opening_balance"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0.00"
        />
      </div>

      <FeeConfigFields expenseCategories={expenseCategories} />

      <div className="mt-2 flex gap-3">
        <Button type="submit" name="_intent" value="save" disabled={pending}>
          {pending ? "Creating\u2026" : "Create Account"}
        </Button>
        <Button
          type="submit"
          name="_intent"
          value="save_and_add_another"
          variant="secondary"
          disabled={pending}
        >
          {pending ? "Saving\u2026" : "Save & Add Another"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/organizations/${orgId}/accounts`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
