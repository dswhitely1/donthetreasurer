"use client";

import { useActionState, useState } from "react";

import type { Tables } from "@/types/database";
import { updateCategory, deactivateCategory, mergeCategory } from "../actions";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CategoryActions({
  category,
  orgId,
  parentCategory,
  subcategoryCount,
  lineItemCount,
  transactionCount,
  mergeTargets,
}: Readonly<{
  category: Tables<"categories">;
  orgId: string;
  parentCategory: Pick<Tables<"categories">, "id" | "name" | "category_type"> | null;
  subcategoryCount: number;
  lineItemCount: number;
  transactionCount: number;
  mergeTargets: Array<{
    id: string;
    name: string;
    parent_id: string | null;
    parent: { name: string } | null;
  }>;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState("");

  const [updateState, updateAction, updatePending] = useActionState(
    updateCategory,
    null
  );
  const [deactivateState, deactivateAction, deactivatePending] =
    useActionState(deactivateCategory, null);
  const [mergeState, mergeAction, mergePending] = useActionState(
    mergeCategory,
    null
  );

  const isSubcategory = !!category.parent_id;
  const canDeactivate = lineItemCount === 0 && subcategoryCount === 0;

  return (
    <div className="mt-6 border-t border-border pt-6">
      {isEditing ? (
        <form action={updateAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={category.id} />
          <input type="hidden" name="organization_id" value={orgId} />
          <input
            type="hidden"
            name="parent_id"
            value={category.parent_id ?? ""}
          />

          {updateState?.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {updateState.error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Category Name</Label>
            <Input
              id="edit-name"
              name="name"
              required
              maxLength={100}
              defaultValue={category.name}
            />
          </div>

          {isSubcategory ? (
            <>
              <input
                type="hidden"
                name="category_type"
                value={parentCategory?.category_type ?? category.category_type}
              />
              <div className="flex flex-col gap-1.5">
                <Label>Category Type</Label>
                <p className="text-sm text-muted-foreground">
                  {CATEGORY_TYPE_LABELS[
                    category.category_type as keyof typeof CATEGORY_TYPE_LABELS
                  ] ?? category.category_type}{" "}
                  (inherited from parent)
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-category-type">Category Type</Label>
              <Select
                name="category_type"
                defaultValue={category.category_type}
              >
                <SelectTrigger id="edit-category-type">
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
              {subcategoryCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Changing type will fail if active subcategories have a
                  different type.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={updatePending}>
              {updatePending ? "Saving\u2026" : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>

            {subcategoryCount === 0 && mergeTargets.length > 0 && (
              <Dialog open={isMergeOpen} onOpenChange={(open) => {
                setIsMergeOpen(open);
                if (!open) setSelectedTargetId("");
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline">Merge</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Merge &ldquo;{category.name}&rdquo;
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="text-sm text-muted-foreground">
                        {lineItemCount > 0 ? (
                          <p>
                            {transactionCount} transaction{transactionCount === 1 ? "" : "s"} with{" "}
                            {lineItemCount} line item{lineItemCount === 1 ? "" : "s"} will be moved
                            from &ldquo;{category.name}&rdquo;
                            {selectedTargetId
                              ? (() => {
                                  const target = mergeTargets.find((t) => t.id === selectedTargetId);
                                  return target
                                    ? <> to &ldquo;{target.parent ? `${target.parent.name} > ` : ""}{target.name}&rdquo;</>
                                    : null;
                                })()
                              : " to the selected target"}
                            .
                          </p>
                        ) : (
                          <p>No transactions use this category.</p>
                        )}
                        <p className="mt-2 font-medium text-destructive">
                          This action cannot be undone. The source category will be permanently deleted.
                        </p>
                      </div>
                    </DialogDescription>
                  </DialogHeader>

                  <form action={mergeAction} className="flex flex-col gap-4">
                    <input type="hidden" name="source_id" value={category.id} />
                    <input
                      type="hidden"
                      name="organization_id"
                      value={orgId}
                    />
                    <input
                      type="hidden"
                      name="target_id"
                      value={selectedTargetId}
                    />

                    {mergeState?.error && (
                      <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {mergeState.error}
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="merge-target">Merge into</Label>
                      <Select
                        value={selectedTargetId}
                        onValueChange={setSelectedTargetId}
                      >
                        <SelectTrigger id="merge-target">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {mergeTargets.map((target) => (
                            <SelectItem key={target.id} value={target.id}>
                              {target.parent ? `${target.parent.name} > ` : ""}{target.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsMergeOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        disabled={mergePending || !selectedTargetId}
                      >
                        {mergePending ? "Merging\u2026" : "Merge Categories"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {isConfirmingDeactivate ? (
              <>
                <form action={deactivateAction}>
                  <input type="hidden" name="id" value={category.id} />
                  <input
                    type="hidden"
                    name="organization_id"
                    value={orgId}
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={deactivatePending}
                  >
                    {deactivatePending
                      ? "Deactivating\u2026"
                      : "Confirm Deactivate"}
                  </Button>
                </form>
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmingDeactivate(false)}
                >
                  Cancel
                </Button>
                {deactivateState?.error && (
                  <span className="self-center text-sm text-destructive">
                    {deactivateState.error}
                  </span>
                )}
              </>
            ) : canDeactivate ? (
              <Button
                variant="outline"
                onClick={() => setIsConfirmingDeactivate(true)}
              >
                Deactivate
              </Button>
            ) : null}
          </div>

          {!canDeactivate && (
            <p className="text-xs text-muted-foreground">
              {subcategoryCount > 0
                ? `Cannot merge or deactivate: ${subcategoryCount} active subcategor${subcategoryCount === 1 ? "y" : "ies"} must be deactivated or merged first.`
                : `Cannot deactivate: ${lineItemCount} transaction line item${lineItemCount === 1 ? "" : "s"} use this category. Use Merge to move them to another category.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
