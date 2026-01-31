"use client";

import { useActionState, useState, useId } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { createTransaction, updateTransaction } from "./actions";
import {
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
} from "@/lib/validations/transaction";
import { Button } from "@/components/ui/button";
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

type Account = Pick<Tables<"accounts">, "id" | "name" | "account_type">;
type Category = Pick<
  Tables<"categories">,
  "id" | "name" | "category_type" | "parent_id"
>;

interface LineItemState {
  key: string;
  category_id: string;
  amount: string;
  memo: string;
}

interface TransactionDefaultValues {
  id: string;
  account_id: string;
  transaction_date: string;
  amount: number;
  transaction_type: string;
  description: string;
  check_number: string | null;
  status: string;
  line_items: Array<{
    category_id: string;
    amount: number;
    memo: string | null;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function generateKey(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function TransactionForm({
  mode,
  accounts,
  categories,
  defaultValues,
}: Readonly<{
  mode: "create" | "edit";
  accounts: Account[];
  categories: Category[];
  defaultValues?: TransactionDefaultValues;
}>) {
  const { orgId } = useParams<{ orgId: string }>();
  const formId = useId();

  const action = mode === "create" ? createTransaction : updateTransaction;
  const [state, formAction, pending] = useActionState(action, null);

  const [transactionType, setTransactionType] = useState<string>(
    defaultValues?.transaction_type ?? "expense"
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    defaultValues?.account_id ?? ""
  );
  const [lineItems, setLineItems] = useState<LineItemState[]>(() => {
    if (defaultValues?.line_items && defaultValues.line_items.length > 0) {
      return defaultValues.line_items.map((li) => ({
        key: generateKey(),
        category_id: li.category_id,
        amount: li.amount.toString(),
        memo: li.memo ?? "",
      }));
    }
    return [{ key: generateKey(), category_id: "", amount: "", memo: "" }];
  });

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const isCheckingAccount = selectedAccount?.account_type === "checking";

  // Filter categories by transaction type
  const filteredCategories = categories.filter(
    (c) => c.category_type === transactionType
  );
  const parentCats = filteredCategories.filter((c) => !c.parent_id);
  const childrenMap = new Map<string, Category[]>();
  for (const cat of filteredCategories) {
    if (cat.parent_id) {
      const existing = childrenMap.get(cat.parent_id) ?? [];
      existing.push(cat);
      childrenMap.set(cat.parent_id, existing);
    }
  }

  // Calculate line item total
  const lineItemTotal = lineItems.reduce((sum, li) => {
    const val = parseFloat(li.amount);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Serialize line items as JSON for the hidden input
  const lineItemsJson = JSON.stringify(
    lineItems
      .filter((li) => li.category_id && li.amount)
      .map((li) => ({
        category_id: li.category_id,
        amount: parseFloat(li.amount),
        memo: li.memo,
      }))
  );

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { key: generateKey(), category_id: "", amount: "", memo: "" },
    ]);
  }

  function removeLineItem(key: string) {
    setLineItems((prev) => prev.filter((li) => li.key !== key));
  }

  function updateLineItem(
    key: string,
    field: keyof Omit<LineItemState, "key">,
    value: string
  ) {
    setLineItems((prev) =>
      prev.map((li) => (li.key === key ? { ...li, [field]: value } : li))
    );
  }

  function handleTypeChange(type: string) {
    setTransactionType(type);
    // Clear category selections when type changes
    setLineItems((prev) =>
      prev.map((li) => ({ ...li, category_id: "" }))
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/organizations/${orgId}/transactions`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to transactions
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "create" ? "New Transaction" : "Edit Transaction"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Record a new income or expense transaction."
              : "Update this transaction's details."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            {mode === "edit" && defaultValues && (
              <input type="hidden" name="id" value={defaultValues.id} />
            )}
            <input type="hidden" name="transaction_type" value={transactionType} />
            <input type="hidden" name="line_items" value={lineItemsJson} />

            {state?.error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            {/* Transaction Type */}
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                {TRANSACTION_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={transactionType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTypeChange(type)}
                  >
                    {TRANSACTION_TYPE_LABELS[type]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Transaction Date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-date`}>Transaction Date</Label>
              <Input
                id={`${formId}-date`}
                name="transaction_date"
                type="date"
                required
                defaultValue={
                  defaultValues?.transaction_date ??
                  new Date().toISOString().split("T")[0]
                }
              />
            </div>

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

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-amount`}>Total Amount</Label>
              <Input
                id={`${formId}-amount`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                defaultValue={defaultValues?.amount ?? ""}
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
                placeholder="e.g. Office supplies purchase"
                defaultValue={defaultValues?.description ?? ""}
              />
            </div>

            {/* Check Number (conditional) */}
            {isCheckingAccount && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-check`}>Check # (optional)</Label>
                <Input
                  id={`${formId}-check`}
                  name="check_number"
                  maxLength={20}
                  placeholder="e.g. 1042"
                  defaultValue={defaultValues?.check_number ?? ""}
                />
              </div>
            )}

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-status`}>Status</Label>
              <Select
                name="status"
                defaultValue={defaultValues?.status ?? "uncleared"}
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

            {/* Line Items */}
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <LineItemTotal lineItemTotal={lineItemTotal} />
              </div>

              {filteredCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No {transactionType} categories found.{" "}
                  <Link
                    href={`/organizations/${orgId}/categories/new`}
                    className="underline hover:text-foreground"
                  >
                    Create one first
                  </Link>
                  .
                </p>
              ) : (
                <>
                  {lineItems.map((li, index) => (
                    <div
                      key={li.key}
                      className="flex flex-col gap-2 rounded-md border border-border/50 bg-muted/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Item {index + 1}
                        </span>
                        {lineItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLineItem(li.key)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label
                          htmlFor={`${formId}-li-cat-${li.key}`}
                          className="text-xs"
                        >
                          Category
                        </Label>
                        <Select
                          value={li.category_id}
                          onValueChange={(val) =>
                            updateLineItem(li.key, "category_id", val)
                          }
                        >
                          <SelectTrigger id={`${formId}-li-cat-${li.key}`}>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {parentCats.map((parent) => {
                              const children =
                                childrenMap.get(parent.id) ?? [];
                              if (children.length > 0) {
                                return (
                                  <SelectGroup key={parent.id}>
                                    <SelectLabel>{parent.name}</SelectLabel>
                                    {children.map((child) => (
                                      <SelectItem
                                        key={child.id}
                                        value={child.id}
                                      >
                                        {parent.name} → {child.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                );
                              }
                              return (
                                <SelectItem
                                  key={parent.id}
                                  value={parent.id}
                                >
                                  {parent.name}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor={`${formId}-li-amt-${li.key}`}
                            className="text-xs"
                          >
                            Amount
                          </Label>
                          <Input
                            id={`${formId}-li-amt-${li.key}`}
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={li.amount}
                            onChange={(e) =>
                              updateLineItem(li.key, "amount", e.target.value)
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor={`${formId}-li-memo-${li.key}`}
                            className="text-xs"
                          >
                            Memo (optional)
                          </Label>
                          <Input
                            id={`${formId}-li-memo-${li.key}`}
                            maxLength={255}
                            placeholder="Note"
                            value={li.memo}
                            onChange={(e) =>
                              updateLineItem(li.key, "memo", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLineItem}
                    className="self-start"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Line Item
                  </Button>
                </>
              )}
            </div>

            {/* Submit */}
            <div className="mt-2 flex gap-3">
              <Button
                type="submit"
                disabled={pending || filteredCategories.length === 0}
              >
                {pending
                  ? mode === "create"
                    ? "Creating\u2026"
                    : "Saving\u2026"
                  : mode === "create"
                    ? "Create Transaction"
                    : "Save Changes"}
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
    </div>
  );
}

function LineItemTotal({
  lineItemTotal,
}: Readonly<{ lineItemTotal: number }>) {
  return (
    <span className="text-sm font-medium tabular-nums">
      {formatCurrency(lineItemTotal)}
    </span>
  );
}
