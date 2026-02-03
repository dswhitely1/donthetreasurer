import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  deleteBudget,
  duplicateBudget,
  updateBudgetStatus,
} from "@/app/(dashboard)/organizations/[orgId]/budgets/actions";
import { budgetKeys } from "./query-keys";

import type { BudgetStatus } from "@/lib/validations/budget";

export function useDeleteBudget(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("organization_id", orgId);

      const result = await deleteBudget(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      router.refresh();
    },
  });
}

export function useDuplicateBudget(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      sourceBudgetId,
      name,
      startDate,
      endDate,
    }: {
      sourceBudgetId: string;
      name: string;
      startDate: string;
      endDate: string;
    }) => {
      const formData = new FormData();
      formData.set("source_budget_id", sourceBudgetId);
      formData.set("organization_id", orgId);
      formData.set("name", name);
      formData.set("start_date", startDate);
      formData.set("end_date", endDate);

      const result = await duplicateBudget(null, formData);
      if (result && "error" in result) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      if (result?.newBudgetId) {
        router.push(`/organizations/${orgId}/budgets/${result.newBudgetId}`);
      } else {
        router.refresh();
      }
    },
  });
}

export function useUpdateBudgetStatus(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: BudgetStatus;
    }) => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("organization_id", orgId);
      formData.set("status", status);

      const result = await updateBudgetStatus(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      router.refresh();
    },
  });
}
