"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";

import { createDepositFromQueue } from "./actions";
import { calculateFee } from "@/lib/validations/account";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
} from "@/lib/validations/transaction";
import {
  ELECTRONIC_PAYMENT_METHODS,
  MIXED_PAYMENT_METHODS_ERROR,
  SPONSOR_PAYMENT_METHOD_LABELS,
} from "@/lib/validations/sponsor";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Tables } from "@/types/database";

type Account = Pick<
  Tables<"accounts">,
  "id" | "name" | "account_type" | "fee_percentage" | "fee_flat_amount" | "fee_category_id"
>;
type Category = Pick<Tables<"categories">, "id" | "name" | "parent_id">;

type QueuedSponsorship = Pick<
  Tables<"sponsorships">,
  | "id"
  | "amount"
  | "payment_method"
  | "check_number"
  | "received_date"
  | "term_start_date"
  | "term_end_date"
> & {
  sponsors: { id: string; name: string; organization_id: string } | null;
  sponsor_levels: { name: string } | null;
};

function isElectronic(paymentMethod: string): boolean {
  return ELECTRONIC_PAYMENT_METHODS.includes(paymentMethod as never);
}

function buildCategoryGroups(categories: Category[]) {
  const parentCats = categories.filter((c) => !c.parent_id);
  const childrenMap = new Map<string, Category[]>();
  for (const cat of categories) {
    if (cat.parent_id) {
      const existing = childrenMap.get(cat.parent_id) ?? [];
      existing.push(cat);
      childrenMap.set(cat.parent_id, existing);
    }
  }
  return { parentCats, childrenMap };
}

function CategorySelect({
  id,
  value,
  onValueChange,
  parentCats,
  childrenMap,
  placeholder = "Select category",
  disabled,
}: Readonly<{
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  parentCats: Category[];
  childrenMap: Map<string, Category[]>;
  placeholder?: string;
  disabled?: boolean;
}>) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {parentCats.map((parent) => {
          const children = childrenMap.get(parent.id) ?? [];
          if (children.length > 0) {
            return (
              <SelectGroup key={parent.id}>
                <SelectLabel>{parent.name}</SelectLabel>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {parent.name} → {child.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          }
          return (
            <SelectItem key={parent.id} value={parent.id}>
              {parent.name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function QueueRow({
  formId,
  row,
  isSelected,
  onToggle,
  categoryId,
  onCategoryChange,
  memo,
  onMemoChange,
  parentCats,
  childrenMap,
}: Readonly<{
  formId: string;
  row: QueuedSponsorship;
  isSelected: boolean;
  onToggle: () => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  memo: string;
  onMemoChange: (value: string) => void;
  parentCats: Category[];
  childrenMap: Map<string, Category[]>;
}>) {
  const checkboxId = `${formId}-select-${row.id}`;
  const sponsorName = row.sponsors?.name ?? "Unknown sponsor";
  const levelName = row.sponsor_levels?.name;
  const methodLabel =
    SPONSOR_PAYMENT_METHOD_LABELS[
      row.payment_method as keyof typeof SPONSOR_PAYMENT_METHOD_LABELS
    ] ?? row.payment_method;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/50 bg-muted/30 p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={isSelected}
          onCheckedChange={() => onToggle()}
          className="mt-1"
        />
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={checkboxId} className="cursor-pointer text-sm">
              {sponsorName}
              {levelName ? (
                <span className="text-muted-foreground"> — {levelName}</span>
              ) : null}
            </Label>
            <span className="shrink-0 text-sm font-medium tabular-nums text-income">
              +{formatCurrency(Number(row.amount))}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {methodLabel}
            {row.check_number ? ` #${row.check_number}` : ""}
            {" · "}
            {formatDate(row.received_date)}
          </p>
        </div>
      </div>

      {isSelected && (
        <div className="grid gap-2 pl-7 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-cat-${row.id}`} className="text-xs">
              Category
            </Label>
            <CategorySelect
              id={`${formId}-cat-${row.id}`}
              value={categoryId}
              onValueChange={onCategoryChange}
              parentCats={parentCats}
              childrenMap={childrenMap}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-memo-${row.id}`} className="text-xs">
              Memo
            </Label>
            <Input
              id={`${formId}-memo-${row.id}`}
              value={memo}
              maxLength={255}
              onChange={(e) => onMemoChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function DepositBuilder({
  orgId,
  queue,
  accounts,
  categories,
}: Readonly<{
  orgId: string;
  queue: QueuedSponsorship[];
  accounts: Account[];
  categories: Category[];
}>) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(
    createDepositFromQueue,
    null
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryByLine, setCategoryByLine] = useState<Record<string, string>>(
    {}
  );
  const [memoByLine, setMemoByLine] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const row of queue) {
      const sponsorName = row.sponsors?.name ?? "Unknown sponsor";
      const levelName = row.sponsor_levels?.name;
      map[row.id] = levelName ? `${sponsorName} — ${levelName}` : sponsorName;
    }
    return map;
  });
  const [applyAllCategoryId, setApplyAllCategoryId] = useState("");

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("uncleared");
  const [applyFee, setApplyFee] = useState(true);

  const { parentCats, childrenMap } = buildCategoryGroups(categories);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function applyCategoryToAll(categoryId: string) {
    setApplyAllCategoryId(categoryId);
    setCategoryByLine((prev) => {
      const next = { ...prev };
      for (const id of selected) {
        next[id] = categoryId;
      }
      return next;
    });
  }

  function updateCategory(id: string, categoryId: string) {
    setCategoryByLine((prev) => ({ ...prev, [id]: categoryId }));
  }

  function updateMemo(id: string, memo: string) {
    setMemoByLine((prev) => ({ ...prev, [id]: memo }));
  }

  const selectedRows = queue.filter((row) => selected.has(row.id));
  const selectedTotal = selectedRows.reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );
  const hasElectronic = selectedRows.some((row) => isElectronic(row.payment_method));
  const hasPhysical = selectedRows.some((row) => !isElectronic(row.payment_method));
  const mixedSelection = hasElectronic && hasPhysical;
  const missingCategory = selectedRows.some((row) => !categoryByLine[row.id]);

  const cashAndCheck = queue.filter((row) => !isElectronic(row.payment_method));
  const payPal = queue.filter((row) => isElectronic(row.payment_method));

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const accountHasFeeConfig =
    selectedAccount != null &&
    selectedAccount.fee_category_id != null &&
    ((selectedAccount.fee_percentage != null && selectedAccount.fee_percentage > 0) ||
      (selectedAccount.fee_flat_amount != null && selectedAccount.fee_flat_amount > 0));
  const showFeeCheckbox = accountHasFeeConfig;

  const feeAmount =
    showFeeCheckbox && applyFee && selectedTotal > 0
      ? calculateFee(
          selectedTotal,
          selectedAccount?.fee_percentage,
          selectedAccount?.fee_flat_amount
        )
      : 0;

  const canSubmit = selected.size > 0 && !missingCategory && !mixedSelection;

  const linesJson = JSON.stringify(
    [...selected].map((id) => ({
      sponsorship_id: id,
      category_id: categoryByLine[id] ?? "",
      memo: memoByLine[id] ?? "",
    }))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select payments to deposit</CardTitle>
        <CardDescription>
          Choose the queued payments going into this deposit, assign each a
          category, then submit to create one income transaction with a line
          per sponsor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="organization_id" value={orgId} />
          <input type="hidden" name="lines" value={linesJson} />
          <input
            type="hidden"
            name="apply_fee"
            value={showFeeCheckbox && applyFee ? "true" : "false"}
          />

          {state?.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {/* Apply category to all selected lines */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-apply-all`}>
              Apply category to all selected lines
            </Label>
            <CategorySelect
              id={`${formId}-apply-all`}
              value={applyAllCategoryId}
              onValueChange={applyCategoryToAll}
              parentCats={parentCats}
              childrenMap={childrenMap}
              disabled={selected.size === 0}
            />
          </div>

          {/* Queue groups */}
          <div className="flex flex-col gap-4">
            {cashAndCheck.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Cash &amp; Checks
                </h3>
                <div className="flex flex-col gap-2">
                  {cashAndCheck.map((row) => (
                    <QueueRow
                      key={row.id}
                      formId={formId}
                      row={row}
                      isSelected={selected.has(row.id)}
                      onToggle={() => toggleSelected(row.id)}
                      categoryId={categoryByLine[row.id] ?? ""}
                      onCategoryChange={(val) => updateCategory(row.id, val)}
                      memo={memoByLine[row.id] ?? ""}
                      onMemoChange={(val) => updateMemo(row.id, val)}
                      parentCats={parentCats}
                      childrenMap={childrenMap}
                    />
                  ))}
                </div>
              </div>
            )}

            {payPal.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  PayPal
                </h3>
                <div className="flex flex-col gap-2">
                  {payPal.map((row) => (
                    <QueueRow
                      key={row.id}
                      formId={formId}
                      row={row}
                      isSelected={selected.has(row.id)}
                      onToggle={() => toggleSelected(row.id)}
                      categoryId={categoryByLine[row.id] ?? ""}
                      onCategoryChange={(val) => updateCategory(row.id, val)}
                      memo={memoByLine[row.id] ?? ""}
                      onMemoChange={(val) => updateMemo(row.id, val)}
                      parentCats={parentCats}
                      childrenMap={childrenMap}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Running total */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>
            <span className="text-sm font-medium tabular-nums text-income">
              +{formatCurrency(selectedTotal)}
            </span>
          </div>

          {mixedSelection && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {MIXED_PAYMENT_METHODS_ERROR}
            </div>
          )}

          {/* Account */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-account`}>Account</Label>
            <Select
              name="account_id"
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
            >
              <SelectTrigger id={`${formId}-account`}>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deposit Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-date`}>Deposit Date</Label>
            <Input
              id={`${formId}-date`}
              name="transaction_date"
              type="date"
              required
              defaultValue={new Date().toLocaleDateString("en-CA")}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-description`}>Description</Label>
            <Input
              id={`${formId}-description`}
              name="description"
              required
              maxLength={255}
              defaultValue="Sponsorship deposit"
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-status`}>Status</Label>
            <Select
              name="status"
              value={selectedStatus}
              onValueChange={setSelectedStatus}
            >
              <SelectTrigger id={`${formId}-status`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {TRANSACTION_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Processing Fee */}
          {showFeeCheckbox && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${formId}-apply-fee`}
                  checked={applyFee}
                  onCheckedChange={(checked) => setApplyFee(checked === true)}
                />
                <Label
                  htmlFor={`${formId}-apply-fee`}
                  className="text-sm font-medium"
                >
                  Apply processing fee
                </Label>
              </div>
              {applyFee && feeAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Estimated fee: {formatCurrency(feeAmount)}
                </p>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? "Creating deposit…" : "Create Deposit"}
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/organizations/${orgId}/transactions`}>
                Cancel
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
