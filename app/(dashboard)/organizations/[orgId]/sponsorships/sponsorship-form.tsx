"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import { createSponsorship, updateSponsorship } from "./actions";
import type { SponsorshipTerm } from "@/lib/sponsors/sponsorship-year";
import {
  SPONSOR_PAYMENT_METHODS,
  SPONSOR_PAYMENT_METHOD_LABELS,
} from "@/lib/validations/sponsor";
import { cn, formatDate } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";

import type { Tables } from "@/types/database";

type Sponsor = Pick<Tables<"sponsors">, "id" | "name">;
type SponsorLevel = Pick<Tables<"sponsor_levels">, "id" | "name" | "default_amount">;

interface SponsorshipFormProps {
  mode: "create" | "edit";
  orgId: string;
  sponsors: Sponsor[];
  levels: SponsorLevel[];
  defaultTerm: SponsorshipTerm;
  defaultValues?: Tables<"sponsorships">;
  defaultSponsorId?: string;
  /** Pre-selects a level (e.g. the previous term's level on a renewal) without copying any other field. */
  defaultLevelId?: string;
  /** The deposit transaction's date, for the post-deposit lock banner. */
  depositDate?: string;
}

export function SponsorshipForm({
  mode,
  orgId,
  sponsors,
  levels,
  defaultTerm,
  defaultValues,
  defaultSponsorId,
  defaultLevelId,
  depositDate,
}: Readonly<SponsorshipFormProps>) {
  const formId = useId();
  const action = mode === "create" ? createSponsorship : updateSponsorship;
  const [state, formAction, pending] = useActionState(action, null);

  const isLocked = mode === "edit" && Boolean(defaultValues?.transaction_id);

  const [sponsorId, setSponsorId] = useState(
    defaultValues?.sponsor_id ?? defaultSponsorId ?? ""
  );
  const [levelId, setLevelId] = useState(
    defaultValues?.level_id ?? defaultLevelId ?? ""
  );
  const [amount, setAmount] = useState(() => {
    if (defaultValues?.amount != null) return String(defaultValues.amount);
    const level = levels.find((l) => l.id === defaultLevelId);
    return level ? String(level.default_amount) : "";
  });
  const [amountTouched, setAmountTouched] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(
    defaultValues?.payment_method ?? "check"
  );

  function handleLevelChange(nextLevelId: string) {
    setLevelId(nextLevelId);
    if (!amountTouched) {
      const level = levels.find((l) => l.id === nextLevelId);
      if (level) setAmount(String(level.default_amount));
    }
  }

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

      {isLocked && (
        <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This sponsorship was deposited
          {depositDate ? ` on ${formatDate(depositDate)}` : ""}. Amount,
          level, and payment method are locked.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-sponsor`}>Sponsor</Label>
        <Select name="sponsor_id" value={sponsorId} onValueChange={setSponsorId}>
          <SelectTrigger id={`${formId}-sponsor`}>
            <SelectValue placeholder="Select a sponsor" />
          </SelectTrigger>
          <SelectContent>
            {sponsors.map((sponsor) => (
              <SelectItem key={sponsor.id} value={sponsor.id}>
                {sponsor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-level`}>Sponsorship Level</Label>
          {/* A disabled Radix Select drops its own bubbled <select> from the
              submitted form, so the locked value is carried by this hidden
              input instead — the Select itself is UI-only while locked. */}
          {isLocked && <input type="hidden" name="level_id" value={levelId} />}
          <Select
            name={isLocked ? undefined : "level_id"}
            value={levelId}
            onValueChange={handleLevelChange}
            disabled={isLocked}
          >
            <SelectTrigger id={`${formId}-level`}>
              <SelectValue placeholder="Select a level" />
            </SelectTrigger>
            <SelectContent>
              {levels.map((level) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-amount`}>Amount</Label>
          <Input
            id={`${formId}-amount`}
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            readOnly={isLocked}
            className={cn(isLocked && "cursor-not-allowed bg-muted")}
            value={amount}
            onChange={(e) => {
              setAmountTouched(true);
              setAmount(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-term-start`}>Term Start</Label>
          <Input
            id={`${formId}-term-start`}
            name="term_start_date"
            type="date"
            required
            defaultValue={defaultValues?.term_start_date ?? defaultTerm.startDate}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-term-end`}>Term End</Label>
          <Input
            id={`${formId}-term-end`}
            name="term_end_date"
            type="date"
            required
            defaultValue={defaultValues?.term_end_date ?? defaultTerm.endDate}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-payment-method`}>Payment Method</Label>
          {isLocked && (
            <input type="hidden" name="payment_method" value={paymentMethod} />
          )}
          <Select
            name={isLocked ? undefined : "payment_method"}
            value={paymentMethod}
            onValueChange={setPaymentMethod}
            disabled={isLocked}
          >
            <SelectTrigger id={`${formId}-payment-method`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPONSOR_PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {SPONSOR_PAYMENT_METHOD_LABELS[method]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {paymentMethod === "check" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-check-number`}>
              Check Number (optional)
            </Label>
            <Input
              id={`${formId}-check-number`}
              name="check_number"
              maxLength={20}
              readOnly={isLocked}
              className={cn(isLocked && "cursor-not-allowed bg-muted")}
              defaultValue={defaultValues?.check_number ?? ""}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-received-date`}>Received Date</Label>
        <Input
          id={`${formId}-received-date`}
          name="received_date"
          type="date"
          required
          defaultValue={
            defaultValues?.received_date ??
            new Date().toLocaleDateString("en-CA")
          }
        />
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

      <div className="mt-2 flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? mode === "create"
              ? "Logging…"
              : "Saving…"
            : mode === "create"
              ? "Log Payment"
              : "Save Changes"}
        </Button>
        <Button variant="outline" asChild>
          <Link
            href={
              sponsorId
                ? `/organizations/${orgId}/sponsors/${sponsorId}`
                : `/organizations/${orgId}/sponsors`
            }
          >
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}
