"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CATEGORY_DIRECTIONS } from "@/lib/validations/category";

import type { CategoryDirection } from "@/lib/validations/category";

const DIRECTION_LABELS: Record<CategoryDirection, string> = {
  income: "Income",
  expense: "Expense",
  neither: "Neither (transfers between your accounts)",
};

// Radix's <SelectItem> throws on value="", so "not set" is represented by
// this sentinel instead. onValueChange maps it back to "" before it reaches
// the caller, so the hidden input (and the action's "" -> null
// normalisation) keep working unchanged. Same idiom as report-filters.tsx's
// budget_id filter ("none" sentinel for "No Budget").
const UNSET_SENTINEL = "unset";

export function DirectionSelect({
  id = "primary_direction",
  name = "primary_direction",
  value,
  onValueChange,
}: Readonly<{
  id?: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
}>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Direction (optional)</Label>
      <input type="hidden" name={name} value={value} />
      <Select
        value={value === "" ? UNSET_SENTINEL : value}
        onValueChange={(next) =>
          onValueChange(next === UNSET_SENTINEL ? "" : next)
        }
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Leave unset for now" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET_SENTINEL}>Not set</SelectItem>
          {CATEGORY_DIRECTIONS.map((direction) => (
            <SelectItem key={direction} value={direction}>
              {DIRECTION_LABELS[direction]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Groups this category on the categories page. It does not limit
        which transactions can use it — any category can take both
        income and expenses.
      </p>
    </div>
  );
}
