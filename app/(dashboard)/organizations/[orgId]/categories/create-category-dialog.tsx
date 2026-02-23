"use client";

import { useActionState, useState, useEffect } from "react";

import { createCategoryInline } from "./actions";
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
} from "@/components/ui/dialog";

interface ParentCategory {
  id: string;
  name: string;
  category_type: string;
}

export function CreateCategoryDialog({
  open,
  onOpenChange,
  orgId,
  categoryType,
  parentCategories,
  onCreated,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  categoryType: string;
  parentCategories: ParentCategory[];
  onCreated: (category: {
    id: string;
    name: string;
    category_type: string;
    parent_id: string | null;
  }) => void;
}>) {
  const [isSubcategory, setIsSubcategory] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [name, setName] = useState("");

  const [state, formAction, pending] = useActionState(
    createCategoryInline,
    null
  );

  // Filter parent categories to match the current category type
  const eligibleParents = parentCategories.filter(
    (c) => c.category_type === categoryType
  );

  // On successful creation, call onCreated and close
  useEffect(() => {
    if (state && "data" in state && state.data) {
      onCreated(state.data);
      onOpenChange(false);
    }
  }, [state, onCreated, onOpenChange]);

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setIsSubcategory(false);
      setSelectedParentId("");
      setName("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            New {CATEGORY_TYPE_LABELS[categoryType as keyof typeof CATEGORY_TYPE_LABELS] ?? categoryType} Category
          </DialogTitle>
          <DialogDescription>
            Create a category without leaving the form.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="organization_id" value={orgId} />
          <input type="hidden" name="category_type" value={categoryType} />
          <input
            type="hidden"
            name="parent_id"
            value={isSubcategory ? selectedParentId : ""}
          />

          {state && "error" in state && state.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {eligibleParents.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Level</Label>
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
                  Parent
                </Button>
                <Button
                  type="button"
                  variant={isSubcategory ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsSubcategory(true)}
                >
                  Subcategory
                </Button>
              </div>
            </div>
          )}

          {isSubcategory && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inline-parent">Parent Category</Label>
              <Select
                value={selectedParentId}
                onValueChange={setSelectedParentId}
              >
                <SelectTrigger id="inline-parent">
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleParents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inline-name">Category Name</Label>
            <Input
              id="inline-name"
              name="name"
              required
              maxLength={100}
              placeholder="e.g. Office Supplies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !name.trim() || (isSubcategory && !selectedParentId)}
            >
              {pending ? "Creating\u2026" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
