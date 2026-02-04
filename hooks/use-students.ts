import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { studentKeys } from "./query-keys";

import type { Tables } from "@/types/database";

type Student = Tables<"students">;

export function useStudents(orgId: string) {
  return useQuery({
    queryKey: studentKeys.list(orgId),
    queryFn: async (): Promise<Student[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("organization_id", orgId)
        .order("last_name")
        .order("first_name");

      if (error) throw error;
      return data;
    },
  });
}

export function useStudent(orgId: string, studentId: string) {
  return useQuery({
    queryKey: studentKeys.detail(orgId, studentId),
    queryFn: async (): Promise<Student> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();

      if (error) throw error;
      return data;
    },
  });
}
