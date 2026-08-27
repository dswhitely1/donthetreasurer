"use client";

import { useActionState, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createCategory } from "./actions";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Tables } from "@/types/database";

type ParentCategory = Pick<Tables<"categories">, "id" | "name">;

export function CategoryForm({
  parentCategories,
  showSaved,
}: Readonly<{
  parentCategories: ParentCategory[];
  showSaved?: boolean;
}>) {
  const { orgId } = useParams<{ orgId: string }>();
  const [state, formAction, pending] = useActionState(createCategory, null);
  const [isSubcategory, setIsSubcategory] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState("");

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
            {state?.error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            {showSaved && !state?.error && (
              <div className="rounded-md bg-income/10 px-3 py-2 text-sm text-income">
                Category saved successfully. Add another below.
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
                    {parentCategories.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
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
                name="_intent"
                value="save"
                disabled={pending || (isSubcategory && !selectedParentId)}
              >
                {pending ? "Creating\u2026" : "Create Category"}
              </Button>
              <Button
                type="submit"
                name="_intent"
                value="save_and_add_another"
                variant="secondary"
                disabled={pending || (isSubcategory && !selectedParentId)}
              >
                {pending ? "Saving\u2026" : "Save & Add Another"}
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
