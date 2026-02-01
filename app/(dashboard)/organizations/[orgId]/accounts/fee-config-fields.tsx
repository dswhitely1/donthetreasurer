"use client";

import { useState } from "react";

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

export type ExpenseCategory = {
  id: string;
  name: string;
  parent_id: string | null;
};

const NONE_SENTINEL = "__none__";

export function FeeConfigFields({
  expenseCategories,
  defaultValues,
}: Readonly<{
  expenseCategories: ExpenseCategory[];
  defaultValues?: {
    fee_percentage: number | null;
    fee_flat_amount: number | null;
    fee_category_id: string | null;
  };
}>) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    defaultValues?.fee_category_id || NONE_SENTINEL
  );

  const parentCats = expenseCategories.filter((c) => !c.parent_id);
  const childrenMap = new Map<string, ExpenseCategory[]>();
  for (const cat of expenseCategories) {
    if (cat.parent_id) {
      const existing = childrenMap.get(cat.parent_id) ?? [];
      existing.push(cat);
      childrenMap.set(cat.parent_id, existing);
    }
  }

  const formValue = selectedCategoryId === NONE_SENTINEL ? "" : selectedCategoryId;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <Label className="text-sm font-medium">
        Processing Fee Configuration (optional)
      </Label>
      <p className="text-xs text-muted-foreground">
        When configured, income transactions on this account can automatically
        create an expense for the processing fee.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fee_percentage" className="text-xs">
            Fee Percentage
          </Label>
          <Input
            id="fee_percentage"
            name="fee_percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="e.g. 1.99"
            defaultValue={defaultValues?.fee_percentage ?? ""}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fee_flat_amount" className="text-xs">
            Flat Fee Amount
          </Label>
          <Input
            id="fee_flat_amount"
            name="fee_flat_amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 0.49"
            defaultValue={defaultValues?.fee_flat_amount ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fee_category_id" className="text-xs">
          Fee Expense Category
        </Label>
        {expenseCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No expense categories available. Create one first to configure fees.
          </p>
        ) : (
          <>
            <input type="hidden" name="fee_category_id" value={formValue} />
            <Select
              value={selectedCategoryId}
              onValueChange={setSelectedCategoryId}
            >
              <SelectTrigger id="fee_category_id">
                <SelectValue placeholder="Select expense category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_SENTINEL}>None</SelectItem>
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
          </>
        )}
      </div>
    </div>
  );
}
