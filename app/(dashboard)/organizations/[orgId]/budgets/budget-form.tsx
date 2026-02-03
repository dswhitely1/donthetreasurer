"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { createBudget, updateBudget } from "./actions";
import {
  BUDGET_STATUSES,
  BUDGET_STATUS_LABELS,
} from "@/lib/validations/budget";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  amount: string;
  notes: string;
}

interface BudgetDefaults {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  line_items: Array<{
    category_id: string;
    amount: number;
    notes: string | null;
  }>;
}

interface BudgetFormProps {
  mode: "create" | "edit";
  categories: Category[];
  orgId: string;
  defaultValues?: BudgetDefaults;
  existingBudgets?: Array<{
    id: string;
    name: string;
    budget_line_items: Array<{
      category_id: string;
      amount: number;
      notes: string | null;
    }>;
  }>;
}

let keyCounter = 0;
function generateKey(): string {
  return `li-${++keyCounter}-${Date.now()}`;
}

export function BudgetForm({
  mode,
  categories,
  orgId,
  defaultValues,
  existingBudgets,
}: Readonly<BudgetFormProps>) {
  const formId = useId();
  const action = mode === "create" ? createBudget : updateBudget;
  const [state, formAction, pending] = useActionState(action, null);

  const [lineItems, setLineItems] = useState<LineItemState[]>(() => {
    if (defaultValues?.line_items?.length) {
      return defaultValues.line_items.map((li) => ({
        key: generateKey(),
        category_id: li.category_id,
        amount: String(li.amount),
        notes: li.notes ?? "",
      }));
    }
    return [{ key: generateKey(), category_id: "", amount: "", notes: "" }];
  });

  // Separate income vs expense categories
  const incomeCategories = categories.filter(
    (c) => c.category_type === "income"
  );
  const expenseCategories = categories.filter(
    (c) => c.category_type === "expense"
  );

  // Build parent/child maps for grouped display
  function buildCategoryTree(cats: Category[]) {
    const parents = cats.filter((c) => !c.parent_id);
    const childrenMap = new Map<string, Category[]>();
    for (const cat of cats) {
      if (cat.parent_id) {
        const existing = childrenMap.get(cat.parent_id) ?? [];
        existing.push(cat);
        childrenMap.set(cat.parent_id, existing);
      }
    }
    return { parents, childrenMap };
  }

  const incomeTree = buildCategoryTree(incomeCategories);
  const expenseTree = buildCategoryTree(expenseCategories);

  // Calculate subtotals
  const usedCategoryIds = new Set(
    lineItems.map((li) => li.category_id).filter(Boolean)
  );
  const categoryTypeMap = new Map(
    categories.map((c) => [c.id, c.category_type])
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  for (const li of lineItems) {
    const val = parseFloat(li.amount);
    if (isNaN(val) || !li.category_id) continue;
    const type = categoryTypeMap.get(li.category_id);
    if (type === "income") {
      totalIncome += val;
    } else {
      totalExpenses += val;
    }
  }

  // Serialize line items as JSON for the hidden input
  const lineItemsJson = JSON.stringify(
    lineItems
      .filter((li) => li.category_id && li.amount)
      .map((li) => ({
        category_id: li.category_id,
        amount: parseFloat(li.amount),
        notes: li.notes,
      }))
  );

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { key: generateKey(), category_id: "", amount: "", notes: "" },
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

  function loadFromBudget(budgetId: string) {
    const source = existingBudgets?.find((b) => b.id === budgetId);
    if (!source) return;
    setLineItems(
      source.budget_line_items.map((li) => ({
        key: generateKey(),
        category_id: li.category_id,
        amount: String(li.amount),
        notes: li.notes ?? "",
      }))
    );
  }

  function renderCategoryOptions(tree: {
    parents: Category[];
    childrenMap: Map<string, Category[]>;
  }) {
    return tree.parents.map((parent) => {
      const children = tree.childrenMap.get(parent.id) ?? [];
      if (children.length > 0) {
        return (
          <SelectGroup key={parent.id}>
            <SelectLabel>{parent.name}</SelectLabel>
            {children.map((child) => (
              <SelectItem
                key={child.id}
                value={child.id}
                disabled={
                  usedCategoryIds.has(child.id) &&
                  !lineItems.some(
                    (li) => li.category_id === child.id
                  )
                }
              >
                {parent.name} &rarr; {child.name}
              </SelectItem>
            ))}
          </SelectGroup>
        );
      }
      return (
        <SelectItem
          key={parent.id}
          value={parent.id}
          disabled={
            usedCategoryIds.has(parent.id) &&
            !lineItems.some((li) => li.category_id === parent.id)
          }
        >
          {parent.name}
        </SelectItem>
      );
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/organizations/${orgId}/budgets`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to budgets
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "create" ? "New Budget" : "Edit Budget"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a budget to plan income and expenses for a period."
              : "Update this budget's details and line items."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            {mode === "edit" && defaultValues && (
              <input type="hidden" name="id" value={defaultValues.id} />
            )}
            <input type="hidden" name="organization_id" value={orgId} />
            <input type="hidden" name="line_items" value={lineItemsJson} />

            {state?.error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-name`}>Budget Name</Label>
              <Input
                id={`${formId}-name`}
                name="name"
                required
                maxLength={150}
                placeholder="e.g. FY 2026 Annual Budget"
                defaultValue={defaultValues?.name ?? ""}
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-start`}>Start Date</Label>
                <Input
                  id={`${formId}-start`}
                  name="start_date"
                  type="date"
                  required
                  defaultValue={defaultValues?.start_date ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-end`}>End Date</Label>
                <Input
                  id={`${formId}-end`}
                  name="end_date"
                  type="date"
                  required
                  defaultValue={defaultValues?.end_date ?? ""}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-status`}>Status</Label>
              <Select
                name="status"
                defaultValue={defaultValues?.status ?? "draft"}
              >
                <SelectTrigger id={`${formId}-status`}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {BUDGET_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-notes`}>Notes (optional)</Label>
              <Textarea
                id={`${formId}-notes`}
                name="notes"
                maxLength={1000}
                placeholder="Any additional notes about this budget..."
                defaultValue={defaultValues?.notes ?? ""}
                rows={3}
              />
            </div>

            {/* Copy from existing budget */}
            {mode === "create" &&
              existingBudgets &&
              existingBudgets.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>Copy Line Items From</Label>
                  <Select onValueChange={loadFromBudget}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a budget to copy..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingBudgets.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.budget_line_items.length} items)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            {/* Line Items */}
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <Label>Budget Line Items</Label>
              </div>

              {/* Subtotals */}
              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Income: </span>
                  <span className="font-medium tabular-nums text-green-600 dark:text-green-400">
                    {formatCurrency(totalIncome)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Expenses: </span>
                  <span className="font-medium tabular-nums text-red-600 dark:text-red-400">
                    {formatCurrency(totalExpenses)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Net: </span>
                  <span
                    className={`font-medium tabular-nums ${
                      totalIncome - totalExpenses >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCurrency(totalIncome - totalExpenses)}
                  </span>
                </div>
              </div>

              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories found.{" "}
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
                            {incomeCategories.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="text-green-600 dark:text-green-400">
                                  Income
                                </SelectLabel>
                                {renderCategoryOptions(incomeTree)}
                              </SelectGroup>
                            )}
                            {expenseCategories.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="text-red-600 dark:text-red-400">
                                  Expenses
                                </SelectLabel>
                                {renderCategoryOptions(expenseTree)}
                              </SelectGroup>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1.5">
                          <Label
                            htmlFor={`${formId}-li-amt-${li.key}`}
                            className="text-xs"
                          >
                            Budgeted Amount
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
                            htmlFor={`${formId}-li-notes-${li.key}`}
                            className="text-xs"
                          >
                            Notes (optional)
                          </Label>
                          <Input
                            id={`${formId}-li-notes-${li.key}`}
                            maxLength={500}
                            placeholder="Note"
                            value={li.notes}
                            onChange={(e) =>
                              updateLineItem(li.key, "notes", e.target.value)
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
                disabled={pending || categories.length === 0}
              >
                {pending
                  ? mode === "create"
                    ? "Creating\u2026"
                    : "Saving\u2026"
                  : mode === "create"
                    ? "Create Budget"
                    : "Save Changes"}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/organizations/${orgId}/budgets`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
