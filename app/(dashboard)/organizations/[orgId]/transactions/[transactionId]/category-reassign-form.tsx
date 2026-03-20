"use client";

import { useActionState, useState, useId } from "react";
import { Plus, Trash2 } from "lucide-react";

import { reassignLineItemCategories } from "../actions";
import { formatCurrency } from "@/lib/utils";
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

import type { Tables } from "@/types/database";

type Category = Pick<
  Tables<"categories">,
  "id" | "name" | "category_type" | "parent_id"
>;

interface LineItemState {
  key: string;
  category_id: string;
  amount: number;
  memo: string;
}

export function CategoryReassignForm({
  transactionId,
  orgId,
  transactionAmount,
  transactionType,
  lineItems,
  categories,
  onCancel,
}: Readonly<{
  transactionId: string;
  orgId: string;
  transactionAmount: number;
  transactionType: string;
  lineItems: Array<{ category_id: string; amount: number; memo: string | null }>;
  categories: Category[];
  onCancel: () => void;
}>) {
  const formId = useId();
  const [state, formAction, isPending] = useActionState(
    reassignLineItemCategories,
    null
  );

  const [items, setItems] = useState<LineItemState[]>(() =>
    lineItems.map((li, i) => ({
      key: `li-${i}`,
      category_id: li.category_id,
      amount: li.amount,
      memo: li.memo ?? "",
    }))
  );

  let nextKey = items.length;

  // Filter categories to match transaction type
  const matchingCategories = categories.filter(
    (c) => c.category_type === transactionType
  );
  const parentCats = matchingCategories.filter((c) => !c.parent_id);
  const childrenMap = new Map<string, Category[]>();
  for (const cat of matchingCategories) {
    if (cat.parent_id) {
      const existing = childrenMap.get(cat.parent_id) ?? [];
      existing.push(cat);
      childrenMap.set(cat.parent_id, existing);
    }
  }

  function updateItem(
    key: string,
    field: keyof LineItemState,
    value: string | number
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      )
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: `li-${++nextKey}`, category_id: "", amount: 0, memo: "" },
    ]);
  }

  const lineItemsTotal = items.reduce(
    (sum, li) => sum + (Number(li.amount) || 0),
    0
  );
  const isBalanced = Math.abs(lineItemsTotal - transactionAmount) < 0.01;

  const lineItemsJson = JSON.stringify(
    items.map((li) => ({
      category_id: li.category_id,
      amount: li.amount,
      memo: li.memo,
    }))
  );

  const hasEmptyCategories = items.some((li) => !li.category_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Reassign Categories</h3>
        <p className="text-sm text-muted-foreground">
          Total: {formatCurrency(transactionAmount)}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Change how this reconciled transaction is categorized. You can split it
        across multiple categories as long as amounts sum to the total. The
        transaction amount and status will not change.
      </p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="transaction_id" value={transactionId} />
        <input type="hidden" name="organization_id" value={orgId} />
        <input type="hidden" name="line_items" value={lineItemsJson} />

        {items.map((li, index) => (
          <div
            key={li.key}
            className="rounded-md border border-border bg-muted/20 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Item {index + 1}
              </span>
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(li.key)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div>
                <Label
                  htmlFor={`${formId}-cat-${li.key}`}
                  className="text-xs"
                >
                  Category
                </Label>
                <Select
                  value={li.category_id}
                  onValueChange={(val) =>
                    updateItem(li.key, "category_id", val)
                  }
                >
                  <SelectTrigger id={`${formId}-cat-${li.key}`}>
                    <SelectValue placeholder="Select category" />
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
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label
                    htmlFor={`${formId}-amt-${li.key}`}
                    className="text-xs"
                  >
                    Amount
                  </Label>
                  <Input
                    id={`${formId}-amt-${li.key}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={li.amount || ""}
                    onChange={(e) =>
                      updateItem(
                        li.key,
                        "amount",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                </div>
                <div>
                  <Label
                    htmlFor={`${formId}-memo-${li.key}`}
                    className="text-xs"
                  >
                    Memo
                  </Label>
                  <Input
                    id={`${formId}-memo-${li.key}`}
                    value={li.memo}
                    onChange={(e) =>
                      updateItem(li.key, "memo", e.target.value)
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Line Item
        </Button>

        {/* Balance indicator */}
        <div
          className={`text-sm tabular-nums ${
            isBalanced
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          Line items: {formatCurrency(lineItemsTotal)} / {formatCurrency(transactionAmount)}
          {!isBalanced && (
            <span className="ml-2">
              (off by {formatCurrency(Math.abs(lineItemsTotal - transactionAmount))})
            </span>
          )}
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            disabled={isPending || !isBalanced || hasEmptyCategories}
          >
            {isPending ? "Saving\u2026" : "Save Categories"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
