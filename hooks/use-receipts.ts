import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import {
  uploadReceipt,
  deleteReceipt,
} from "@/app/(dashboard)/organizations/[orgId]/transactions/[transactionId]/actions";
import { receiptKeys } from "./query-keys";

import type { Tables } from "@/types/database";

export type Receipt = Tables<"receipts">;

export function useReceipts(transactionId: string) {
  return useQuery({
    queryKey: receiptKeys.list(transactionId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Receipt[];
    },
  });
}

export function useReceiptSignedUrl(orgId: string, receiptId: string) {
  return useQuery({
    queryKey: receiptKeys.signedUrl(orgId, receiptId),
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${orgId}/receipts/${receiptId}/url`
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to get signed URL");
      }
      return res.json() as Promise<{
        signedUrl: string;
        mimeType: string;
        fileName: string;
      }>;
    },
    staleTime: 4 * 60 * 1000, // 4 minutes (URL expires at 5)
  });
}

export function useUploadReceipt(transactionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      organizationId,
    }: {
      file: File;
      organizationId: string;
    }) => {
      const formData = new FormData();
      formData.set("transaction_id", transactionId);
      formData.set("organization_id", organizationId);
      formData.set("file", file);

      const result = await uploadReceipt(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: receiptKeys.list(transactionId),
      });
    },
  });
}

export function useDeleteReceipt(transactionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      organizationId,
    }: {
      receiptId: string;
      organizationId: string;
    }) => {
      const formData = new FormData();
      formData.set("receipt_id", receiptId);
      formData.set("organization_id", organizationId);

      const result = await deleteReceipt(null, formData);
      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: receiptKeys.list(transactionId),
      });
    },
  });
}
