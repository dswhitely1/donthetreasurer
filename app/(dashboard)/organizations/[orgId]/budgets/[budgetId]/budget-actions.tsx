"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { deleteBudget, updateBudgetStatus } from "../actions";
import {
  BUDGET_STATUSES,
  BUDGET_STATUS_LABELS,
} from "@/lib/validations/budget";
import { useDuplicateBudget } from "@/hooks/use-budgets";
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

interface BudgetActionsProps {
  budgetId: string;
  orgId: string;
  currentStatus: string;
  budgetName: string;
}

export function BudgetDetailActions({
  budgetId,
  orgId,
  currentStatus,
  budgetName,
}: Readonly<BudgetActionsProps>) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [dupName, setDupName] = useState(`${budgetName} (Copy)`);
  const [dupStartDate, setDupStartDate] = useState("");
  const [dupEndDate, setDupEndDate] = useState("");

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteBudget,
    null
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateBudgetStatus,
    null
  );

  const duplicateMutation = useDuplicateBudget(orgId);

  function handleStatusChange(newStatus: string) {
    const formData = new FormData();
    formData.set("id", budgetId);
    formData.set("organization_id", orgId);
    formData.set("status", newStatus);
    statusAction(formData);
  }

  async function handleDuplicate() {
    if (!dupName || !dupStartDate || !dupEndDate) return;
    try {
      await duplicateMutation.mutateAsync({
        sourceBudgetId: budgetId,
        name: dupName,
        startDate: dupStartDate,
        endDate: dupEndDate,
      });
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {/* Edit */}
        <Button variant="outline" asChild>
          <Link href={`/organizations/${orgId}/budgets/${budgetId}/edit`}>
            Edit
          </Link>
        </Button>

        {/* Status Change */}
        <Select
          value={currentStatus}
          onValueChange={handleStatusChange}
          disabled={statusPending}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUDGET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {BUDGET_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Duplicate */}
        <Button
          variant="outline"
          onClick={() => setIsDuplicating(!isDuplicating)}
        >
          Duplicate
        </Button>

        {/* Delete */}
        {isConfirmingDelete ? (
          <>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={budgetId} />
              <input type="hidden" name="organization_id" value={orgId} />
              <Button
                type="submit"
                variant="destructive"
                disabled={deletePending}
              >
                {deletePending ? "Deleting\u2026" : "Confirm Delete"}
              </Button>
            </form>
            <Button
              variant="outline"
              onClick={() => setIsConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setIsConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
      </div>

      {/* Duplicate form */}
      {isDuplicating && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <Label className="text-sm font-medium">Duplicate Budget</Label>
          <Input
            placeholder="New budget name"
            value={dupName}
            onChange={(e) => setDupName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              placeholder="Start date"
              value={dupStartDate}
              onChange={(e) => setDupStartDate(e.target.value)}
            />
            <Input
              type="date"
              placeholder="End date"
              value={dupEndDate}
              onChange={(e) => setDupEndDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleDuplicate}
              disabled={
                duplicateMutation.isPending ||
                !dupName ||
                !dupStartDate ||
                !dupEndDate
              }
            >
              {duplicateMutation.isPending ? "Duplicating\u2026" : "Create Copy"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsDuplicating(false)}
            >
              Cancel
            </Button>
          </div>
          {duplicateMutation.error && (
            <span className="text-sm text-destructive">
              {duplicateMutation.error.message}
            </span>
          )}
        </div>
      )}

      {/* Error messages */}
      {deleteState?.error && (
        <span className="text-sm text-destructive">{deleteState.error}</span>
      )}
      {statusState?.error && (
        <span className="text-sm text-destructive">{statusState.error}</span>
      )}
    </div>
  );
}
