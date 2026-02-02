"use client";

import { useState } from "react";

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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateQuickTransaction } from "@/hooks/use-reconciliation";

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  category_type: string;
}

interface QuickTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  sessionId: string;
  orgId: string;
  statementDate: string;
  categories: Category[];
  onCreated: (txnId: string) => void;
}

export function QuickTransactionDialog({
  open,
  onOpenChange,
  accountId,
  sessionId,
  orgId,
  statementDate,
  categories,
  onCreated,
}: QuickTransactionDialogProps) {
  const [transactionType, setTransactionType] = useState<string>("expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useCreateQuickTransaction(orgId);

  // Filter categories by selected transaction type
  const filteredCategories = categories.filter(
    (c) => c.category_type === transactionType
  );

  // Build display names with parent hierarchy
  const parentMap = new Map(categories.map((c) => [c.id, c]));
  const getCategoryLabel = (cat: Category) => {
    if (cat.parent_id) {
      const parent = parentMap.get(cat.parent_id);
      return parent ? `${parent.name} → ${cat.name}` : cat.name;
    }
    return cat.name;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const description = (formData.get("description") as string)?.trim();
    const amount = parseFloat(formData.get("amount") as string);
    const transactionDate = formData.get("transaction_date") as string;

    if (!description) {
      setError("Description is required.");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (!categoryId) {
      setError("Category is required.");
      return;
    }

    try {
      const txnId = await mutation.mutateAsync({
        accountId,
        sessionId,
        transactionDate,
        description,
        amount,
        transactionType,
        categoryId,
      });
      if (txnId) {
        onCreated(txnId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transaction.");
    }
  };

  const handleTypeChange = (value: string) => {
    setTransactionType(value);
    setCategoryId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Add a transaction discovered on the statement (e.g., bank fee, interest).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick_transaction_date">Date</Label>
            <Input
              id="quick_transaction_date"
              name="transaction_date"
              type="date"
              defaultValue={statementDate}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick_description">Description</Label>
            <Input
              id="quick_description"
              name="description"
              placeholder="e.g., Bank service fee"
              maxLength={255}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick_amount">Amount</Label>
            <Input
              id="quick_amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={transactionType} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {getCategoryLabel(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Adding..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
