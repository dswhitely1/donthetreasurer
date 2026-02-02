import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  pauseTemplate,
  resumeTemplate,
  deleteTemplate,
  generateFromTemplate,
} from "@/app/(dashboard)/organizations/[orgId]/templates/actions";
import { templateKeys, transactionKeys, accountKeys } from "./query-keys";

export function usePauseTemplate(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("organization_id", orgId);

      const result = await pauseTemplate(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      router.refresh();
    },
  });
}

export function useResumeTemplate(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("organization_id", orgId);

      const result = await resumeTemplate(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      router.refresh();
    },
  });
}

export function useDeleteTemplate(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("organization_id", orgId);

      const result = await deleteTemplate(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      router.refresh();
    },
  });
}

export function useGenerateFromTemplate(orgId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const formData = new FormData();
      formData.set("template_id", id);
      formData.set("organization_id", orgId);

      const result = await generateFromTemplate(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({
        queryKey: accountKeys.balances(orgId),
      });
      router.refresh();
    },
  });
}
