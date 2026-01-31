"use client";

import { useActionState, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createCategory } from "./actions";
import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_LABELS,
} from "@/lib/validations/category";
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

type ParentCategory = Pick<
  Tables<"categories">,
  "id" | "name" | "category_type"
>;

export function CategoryForm({
  parentCategories,
}: Readonly<{
  parentCategories: ParentCategory[];
}>) {
  const { orgId } = useParams<{ orgId: string }>();
  const [state, formAction, pending] = useActionState(createCategory, null);
  const [isSubcategory, setIsSubcategory] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState("");

  const selectedParent = parentCategories.find(
    (p) => p.id === selectedParentId
  );
  const effectiveType = isSubcategory && selectedParent
    ? selectedParent.category_type
    : undefined;

  const incomeParents = parentCategories.filter(
    (p) => p.category_type === "income"
  );
  const expenseParents = parentCategories.filter(
    (p) => p.category_type === "expense"
  );

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/organizations/${orgId}/categories`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to categories
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New Category</CardTitle>
          <CardDescription>
            Add a category to organize transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="organization_id" value={orgId} />
            {isSubcategory && (
              <input
                type="hidden"
                name="parent_id"
                value={selectedParentId}
              />
            )}
            {effectiveType && (
              <input
                type="hidden"
                name="category_type"
                value={effectiveType}
              />
            )}

            {state?.error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Category Level</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!isSubcategory ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsSubcategory(false);
                    setSelectedParentId("");
                  }}
                >
                  Parent Category
                </Button>
                <Button
                  type="button"
                  variant={isSubcategory ? "default" : "outline"}
                  size="sm"
                  disabled={parentCategories.length === 0}
                  onClick={() => setIsSubcategory(true)}
                >
                  Subcategory
                </Button>
              </div>
              {parentCategories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Create a parent category first before adding subcategories.
                </p>
              )}
            </div>

            {isSubcategory && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="parent_id">Parent Category</Label>
                <Select
                  value={selectedParentId}
                  onValueChange={setSelectedParentId}
                >
                  <SelectTrigger id="parent_id">
                    <SelectValue placeholder="Select a parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeParents.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Income</SelectLabel>
                        {incomeParents.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {expenseParents.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Expense</SelectLabel>
                        {expenseParents.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                {effectiveType && (
                  <p className="text-xs text-muted-foreground">
                    Type automatically set to{" "}
                    <span className="font-medium">
                      {CATEGORY_TYPE_LABELS[effectiveType as keyof typeof CATEGORY_TYPE_LABELS]}
                    </span>{" "}
                    to match parent.
                  </p>
                )}
              </div>
            )}

            {!isSubcategory && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category_type">Category Type</Label>
                <Select name="category_type" defaultValue="expense">
                  <SelectTrigger id="category_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CATEGORY_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={100}
                placeholder={
                  isSubcategory
                    ? "e.g. Office Supplies"
                    : "e.g. Operations"
                }
              />
            </div>

            <div className="mt-2 flex gap-3">
              <Button
                type="submit"
                disabled={pending || (isSubcategory && !selectedParentId)}
              >
                {pending ? "Creating\u2026" : "Create Category"}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/organizations/${orgId}/categories`}>
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
